// AtlasForge — custom world: paint terrain with a stylus, cut it into provinces,
// and export a plain-text atlas that an AI can reason about.
//
// The painting IS the data. Two categorical rasters on a GW×GH grid live in
// project.world (RLE + base64 so they stay small in localStorage and in the undo
// slice): `elev` (0 water, 1 lowland, 2 hills, 3 mountains) and `cover`
// (index into COVER). Rivers are polylines in grid units. Grid units are the data
// coordinates of the "world" basemap (identityFrame: 1000 × 510), so the grid,
// generated provinces and project geometry edits all share one coordinate space.
(function () {
  const App = window.App;
  const Actions = window.Actions;

  const GW = 1000, GH = 510, RS = 2;          // grid size; canvas pixels per grid cell
  const COVER = ["plains", "forest", "desert", "marsh", "tundra", "jungle"];
  const ELEV_BRUSH = { land: 1, hills: 2, mountains: 3 };
  const COVER_BRUSH = { plains: 0, forest: 1, desert: 2, marsh: 3, tundra: 4, jungle: 5 };
  const BRUSHES = ["land", "sea", "plains", "hills", "mountains", "forest", "desert", "marsh", "tundra", "jungle", "river", "eraseRiver", "smooth"];
  const BRUSH_SWATCH = {
    land: "#b9c282", sea: "#4a7aa8", plains: "#c9cf95", hills: "#b09a6c", mountains: "#8c7e70",
    forest: "#5f9150", desert: "#e2cc8e", marsh: "#849c76", tundra: "#cdd4c8", jungle: "#3f7f4a",
    river: "#3f77b3", eraseRiver: "#c65a5a", smooth: "#9aa3ad"
  };

  const World = (window.World = {
    GW, GH, RS, COVER, BRUSHES, BRUSH_SWATCH,
    elev: null, cover: null, rgb: null, hs: null,
    canvas: null, ctx: null,
    encElev: undefined, encCover: undefined,
    penSeen: false, renderRev: 0
  });

  World.newWorldData = function () {
    return { w: GW, h: GH, elev: null, cover: null, rivers: [], scaleKm: 5, cellSize: 18,
      seed: (Math.random() * 1e9) | 0, rev: 0, genRev: null };
  };

  World.active = function () {
    const p = App.project;
    const def = p && window.BASEMAPS[p.basemapId];
    return !!(p && p.world && def && def.kind === "world");
  };

  // ---------------- small utils ----------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct) {
    let t = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { t += amp * vnoise(x * f, y * f, s + i * 131); norm += amp; amp *= 0.5; f *= 2; }
    return t / norm;
  }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------------- raster encoding (RLE + varint + base64) ----------------
  function rleEncode(arr) {
    const out = [];
    const n = arr.length;
    let i = 0;
    while (i < n) {
      const v = arr[i];
      let j = i + 1;
      while (j < n && arr[j] === v) j++;
      let run = j - i;
      out.push(v);
      while (run >= 128) { out.push((run & 127) | 128); run >>>= 7; }
      out.push(run);
      i = j;
    }
    const bytes = Uint8Array.from(out);
    let s = "";
    for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
    return btoa(s);
  }
  function rleDecode(b64, n) {
    const arr = new Uint8Array(n);
    if (!b64) return arr;
    let bin;
    try { bin = atob(b64); } catch (e) { return arr; }
    let i = 0, pos = 0;
    while (i < bin.length && pos < n) {
      const v = bin.charCodeAt(i++);
      let run = 0, shift = 0, b;
      do { b = bin.charCodeAt(i++); run |= (b & 127) << shift; shift += 7; } while (b & 128);
      arr.fill(v, pos, Math.min(n, pos + run));
      pos += run;
    }
    return arr;
  }

  // ---------------- sync project <-> in-memory rasters ----------------
  function ensureBuffers() {
    if (!World.elev) World.elev = new Uint8Array(GW * GH);
    if (!World.cover) World.cover = new Uint8Array(GW * GH);
    if (!World.rgb) World.rgb = new Float32Array(GW * GH * 3);
    if (!World.hs) World.hs = new Float32Array(GW * GH);
    if (!World.canvas) {
      const cv = document.createElement("canvas");
      cv.width = GW * RS; cv.height = GH * RS;
      cv.className = "world-canvas";
      World.canvas = cv;
      World.ctx = cv.getContext("2d");
    }
  }
  // (re)decode the rasters when the project's encoded copy changed (load, undo, redo)
  World.sync = function () {
    if (!World.active()) return false;
    const w = App.project.world;
    ensureBuffers();
    if (w.elev === World.encElev && w.cover === World.encCover) return false;
    World.elev.set(rleDecode(w.elev, GW * GH));
    World.cover.set(rleDecode(w.cover, GW * GH));
    World.encElev = w.elev; World.encCover = w.cover;
    World.renderAll();
    return true;
  };
  function commitRasters() {
    const e = rleEncode(World.elev), c = rleEncode(World.cover);
    World.encElev = e; World.encCover = c;
    Actions.mut((p) => { p.world.elev = e; p.world.cover = c; p.world.rev = (p.world.rev || 0) + 1; }, { undo: false });
  }

  // ---------------- terrain rendering ----------------
  const PAL = {
    deep: hex("#4a7aa8"), shallow: hex("#86b4d2"),
    cover: [hex("#bcc486"), hex("#65965a"), hex("#e0c98c"), hex("#829b78"), hex("#cbd2c6"), hex("#43824c")],
    hills: hex("#b39c6c"), mountain: hex("#8b7d6f"), snow: hex("#eceff1")
  };
  const HV = [-0.6, 0.25, 1.15, 2.7];

  function updateDerived(x0, y0, x1, y1) {
    const elev = World.elev, cover = World.cover, hs = World.hs, rgb = World.rgb;
    // smoothed heights (3×3 box) — one cell wider than the colour region
    const hx0 = clamp(x0 - 1, 0, GW - 1), hx1 = clamp(x1 + 1, 0, GW - 1);
    const hy0 = clamp(y0 - 1, 0, GH - 1), hy1 = clamp(y1 + 1, 0, GH - 1);
    for (let y = hy0; y <= hy1; y++) {
      for (let x = hx0; x <= hx1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = clamp(y + dy, 0, GH - 1) * GW;
          for (let dx = -1; dx <= 1; dx++) s += HV[elev[yy + clamp(x + dx, 0, GW - 1)]];
        }
        hs[y * GW + x] = s / 9;
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * GW + x;
        const e = elev[i];
        let col;
        if (e === 0) {
          let n = 0;
          for (let dy = -2; dy <= 2; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= GH) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < GW && elev[yy * GW + xx] > 0) n++;
            }
          }
          col = mix(PAL.deep, PAL.shallow, Math.min(1, n / 8));
        } else {
          const cv = cover[i];
          col = PAL.cover[cv] || PAL.cover[0];
          if (e === 2) col = mix(col, PAL.hills, 0.45);
          else if (e === 3) col = cv === 4 ? mix(PAL.mountain, PAL.snow, 0.7) : mix(col, PAL.mountain, 0.72);
          const l = hs[y * GW + Math.max(0, x - 1)], r = hs[y * GW + Math.min(GW - 1, x + 1)];
          const u = hs[Math.max(0, y - 1) * GW + x], d = hs[Math.min(GH - 1, y + 1) * GW + x];
          const shade = clamp(1 + ((r - l) + (d - u)) * -0.22, 0.62, 1.3);
          col = [col[0] * shade, col[1] * shade, col[2] * shade];
          // thin darker rim along the coast
          if ((x > 0 && elev[i - 1] === 0) || (x < GW - 1 && elev[i + 1] === 0) ||
              (y > 0 && elev[i - GW] === 0) || (y < GH - 1 && elev[i + GW] === 0)) col = mix(col, [70, 80, 70], 0.28);
        }
        rgb[i * 3] = col[0]; rgb[i * 3 + 1] = col[1]; rgb[i * 3 + 2] = col[2];
      }
    }
  }

  function paintCanvas(x0, y0, x1, y1) {
    const rgb = World.rgb, elev = World.elev, cover = World.cover;
    const X0 = x0 * RS, Y0 = y0 * RS, w = (x1 - x0 + 1) * RS, h = (y1 - y0 + 1) * RS;
    const img = World.ctx.createImageData(w, h);
    const data = img.data;
    let o = 0;
    for (let py = Y0; py < Y0 + h; py++) {
      const gy = (py + 0.5) / RS - 0.5;
      const yA = clamp(Math.floor(gy), 0, GH - 1), yB = clamp(yA + 1, 0, GH - 1), fy = clamp(gy - yA, 0, 1);
      const cy = clamp((py / RS) | 0, 0, GH - 1);
      for (let px = X0; px < X0 + w; px++) {
        const gx = (px + 0.5) / RS - 0.5;
        const xA = clamp(Math.floor(gx), 0, GW - 1), xB = clamp(xA + 1, 0, GW - 1), fx = clamp(gx - xA, 0, 1);
        const a = (yA * GW + xA) * 3, b = (yA * GW + xB) * 3, c = (yB * GW + xA) * 3, d = (yB * GW + xB) * 3;
        const ci = cy * GW + clamp((px / RS) | 0, 0, GW - 1);
        const e = elev[ci];
        let grain = (hash2(px, py, 7) - 0.5) * (e === 0 ? 5 : 12);
        if (e > 0) {
          const cv = cover[ci];
          if (cv === 1 || cv === 5) grain -= vnoise(px * 0.45, py * 0.45, 3) > 0.62 ? 20 : 0;
          if (e === 3) grain += (vnoise(px * 0.6, py * 0.25, 5) - 0.5) * 34;
          else if (e === 2) grain += (vnoise(px * 0.35, py * 0.35, 9) - 0.5) * 16;
        }
        for (let k = 0; k < 3; k++) {
          const top = rgb[a + k] + (rgb[b + k] - rgb[a + k]) * fx;
          const bot = rgb[c + k] + (rgb[d + k] - rgb[c + k]) * fx;
          data[o + k] = top + (bot - top) * fy + grain;
        }
        data[o + 3] = 255;
        o += 4;
      }
    }
    World.ctx.putImageData(img, X0, Y0);
  }

  World.renderAll = function () {
    ensureBuffers();
    updateDerived(0, 0, GW - 1, GH - 1);
    paintCanvas(0, 0, GW - 1, GH - 1);
    World.renderRev++;
  };

  // dirty rectangle, flushed once per animation frame while painting
  let dirty = null, rafPending = false;
  function markDirty(x0, y0, x1, y1) {
    if (!dirty) dirty = [x0, y0, x1, y1];
    else { dirty[0] = Math.min(dirty[0], x0); dirty[1] = Math.min(dirty[1], y0); dirty[2] = Math.max(dirty[2], x1); dirty[3] = Math.max(dirty[3], y1); }
    if (!rafPending) { rafPending = true; requestAnimationFrame(flush); }
  }
  function flush() {
    rafPending = false;
    if (!dirty) return;
    // colours depend on a 2-cell neighbourhood (shallows, shading, coast rim)
    const x0 = clamp(dirty[0] - 3, 0, GW - 1), y0 = clamp(dirty[1] - 3, 0, GH - 1);
    const x1 = clamp(dirty[2] + 3, 0, GW - 1), y1 = clamp(dirty[3] + 3, 0, GH - 1);
    dirty = null;
    updateDerived(x0, y0, x1, y1);
    paintCanvas(x0, y0, x1, y1);
  }

  // ---------------- brushes ----------------
  function dab(brush, cx, cy, r) {
    const elev = World.elev, cover = World.cover;
    const reach = r * 1.15 + 1;
    const x0 = clamp(Math.floor(cx - reach), 0, GW - 1), x1 = clamp(Math.ceil(cx + reach), 0, GW - 1);
    const y0 = clamp(Math.floor(cy - reach), 0, GH - 1), y1 = clamp(Math.ceil(cy + reach), 0, GH - 1);
    const rough = App.ui.worldRough !== false;
    const nf = 1 / Math.max(2.5, r * 0.45);
    let src = null;
    if (brush === "smooth") {
      // majority filter reads from a snapshot so the dab is order-independent
      src = { e: elev.slice(), c: cover.slice() };
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const lim = rough ? r * (0.82 + 0.36 * vnoise(x * nf, y * nf, 11)) : r;
        if (dx * dx + dy * dy > lim * lim) continue;
        const i = y * GW + x;
        if (brush in ELEV_BRUSH) {
          elev[i] = brush === "land" ? Math.max(1, elev[i]) : ELEV_BRUSH[brush];
        } else if (brush === "sea") {
          elev[i] = 0; cover[i] = 0;
        } else if (brush in COVER_BRUSH) {
          if (elev[i] === 0) continue;               // cover never creates land
          cover[i] = COVER_BRUSH[brush];
          if (brush === "plains") elev[i] = 1;       // plains also flatten hills / mountains
        } else if (brush === "smooth") {
          const eh = [0, 0, 0, 0], chh = [0, 0, 0, 0, 0, 0];
          for (let oy = -1; oy <= 1; oy++) {
            const yy = clamp(y + oy, 0, GH - 1) * GW;
            for (let ox = -1; ox <= 1; ox++) {
              const j = yy + clamp(x + ox, 0, GW - 1);
              eh[src.e[j]]++; chh[src.c[j]]++;
            }
          }
          const land = eh[1] + eh[2] + eh[3];
          if (land >= 5) {
            let be = 1; for (let k = 2; k < 4; k++) if (eh[k] > eh[be]) be = k;
            elev[i] = be;
            let bc = 0; for (let k = 1; k < 6; k++) if (chh[k] > chh[bc]) bc = k;
            cover[i] = bc;
          } else {
            elev[i] = 0; cover[i] = 0;
          }
        }
      }
    }
    markDirty(x0, y0, x1, y1);
  }

  function brushRadius(pressure, pointerType) {
    const size = App.ui.worldSize || 12;
    if (pointerType === "pen" && App.ui.worldPressure !== false) {
      return Math.max(0.6, size * (0.2 + 0.95 * Math.pow(clamp(pressure || 0.5, 0, 1), 0.85)));
    }
    return size;
  }
  World.brushRadius = brushRadius;

  function riverTouches(rv, x, y, r) {
    const pts = rv.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSeg(x, y, pts[i], pts[i + 1]) <= r) return true;
    }
    return pts.length === 1 && Math.hypot(pts[0][0] - x, pts[0][1] - y) <= r;
  }
  function distToSeg(x, y, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const L = vx * vx + vy * vy;
    let t = L ? ((x - a[0]) * vx + (y - a[1]) * vy) / L : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(a[0] + vx * t - x, a[1] + vy * t - y);
  }

  let stroke = null;
  World.strokeActive = () => !!stroke;
  World.strokeStart = function (g, pressure, pointerType) {
    if (!World.active()) return;
    ensureBuffers();
    const brush = App.ui.worldBrush || "land";
    const r = brushRadius(pressure, pointerType);
    if (brush === "river") {
      stroke = { brush, pts: [g], pointerType };
      return;
    }
    Actions.beginStroke();
    stroke = { brush, last: g, lastR: r, pointerType, changed: false };
    if (brush === "eraseRiver") eraseRiversAt(g, r);
    else { dab(brush, g[0], g[1], r); stroke.changed = true; }
  };
  World.strokeMove = function (samples) {
    if (!stroke) return;
    if (stroke.brush === "river") {
      samples.forEach((s) => {
        const last = stroke.pts[stroke.pts.length - 1];
        if (Math.hypot(s.g[0] - last[0], s.g[1] - last[1]) > 0.6) stroke.pts.push(s.g);
      });
      return;
    }
    samples.forEach((s) => {
      const r = brushRadius(s.pressure, stroke.pointerType);
      if (stroke.brush === "eraseRiver") { eraseRiversAt(s.g, r); stroke.last = s.g; return; }
      const [lx, ly] = stroke.last;
      const dist = Math.hypot(s.g[0] - lx, s.g[1] - ly);
      const step = Math.max(0.5, Math.min(r, stroke.lastR) * 0.35);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        dab(stroke.brush, lx + (s.g[0] - lx) * t, ly + (s.g[1] - ly) * t, stroke.lastR + (r - stroke.lastR) * t);
      }
      stroke.last = s.g; stroke.lastR = r; stroke.changed = true;
    });
  };
  World.strokePreview = function () {
    return stroke && stroke.brush === "river" ? stroke.pts : null;
  };
  World.strokeEnd = function () {
    const s = stroke;
    stroke = null;
    if (!s) return;
    if (s.brush === "river") { finishRiver(s.pts); return; }
    if (s.changed) { flush(); commitRasters(); }
    Actions.endStroke();
  };

  function eraseRiversAt(g, r) {
    const rivers = App.project.world.rivers || [];
    if (!rivers.some((rv) => riverTouches(rv, g[0], g[1], r))) return;
    Actions.mut((p) => { p.world.rivers = p.world.rivers.filter((rv) => !riverTouches(rv, g[0], g[1], r)); }, { undo: false });
  }

  function chaikinOpen(pts, iter) {
    let out = pts;
    for (let it = 0; it < iter; it++) {
      if (out.length < 3) break;
      const nx = [out[0]];
      for (let i = 0; i < out.length - 1; i++) {
        const a = out[i], b = out[i + 1];
        nx.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      nx.push(out[out.length - 1]);
      out = nx;
    }
    return out;
  }
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let best = -1, bd = eps;
      for (let i = a + 1; i < b; i++) {
        const d = distToSeg(pts[i][0], pts[i][1], pts[a], pts[b]);
        if (d > bd) { bd = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  const r2 = (v) => Math.round(v * 100) / 100;

  function finishRiver(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (pts.length < 2 || len < 3) { App.emit(); return; }
    const smooth = rdp(chaikinOpen(pts, 2), 0.18).map((q) => [r2(q[0]), r2(q[1])]);
    Actions.mut((p) => {
      const rivers = p.world.rivers || (p.world.rivers = []);
      const n = rivers.length + 1;
      rivers.push({ id: window.uid(), name: t("world.riverDefault").replace("{n}", n), pts: smooth, width: 1 });
    });
  }

  World.renameRiver = function (id, name) {
    Actions.mut((p) => { const rv = (p.world.rivers || []).find((r) => r.id === id); if (rv) rv.name = name; }, { undo: false });
  };
  World.deleteRiver = function (id) {
    Actions.mut((p) => { p.world.rivers = (p.world.rivers || []).filter((r) => r.id !== id); });
  };
  World.setWorld = function (patch, opts) {
    Actions.mut((p) => Object.assign(p.world, patch), Object.assign({ undo: false }, opts));
  };

  // A river as a tapered ribbon polygon (thin at the source, wide at the mouth),
  // projected to map coordinates. Grid units -> map units via proj.
  World.riverPath = function (rv, proj) {
    const pts = rv.pts;
    if (!pts || pts.length < 2 || !proj) return "";
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    const wmul = rv.width || 1;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const hw = (0.4 + 1.5 * Math.pow(cum[i] / L, 0.8)) * wmul * 0.5;
      left.push(proj([pts[i][0] - ty * hw, pts[i][1] + tx * hw]));
      right.push(proj([pts[i][0] + ty * hw, pts[i][1] - tx * hw]));
    }
    const ring = left.concat(right.reverse());
    return "M" + ring.map((q) => q[0].toFixed(2) + "," + q[1].toFixed(2)).join("L") + "Z";
  };

  // Position the terrain canvas under the SVG so it tracks zoom / pan exactly:
  // grid -> map (projection) -> view transform -> viewBox -> client pixels.
  World.place = function (svg, v) {
    const cv = World.canvas, host = cv && cv.parentNode;
    const proj = App.basemap && App.basemap.proj;
    if (!cv || !host || !svg || !proj || !World.active()) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const hr = host.getBoundingClientRect();
    const p0 = proj([0, 0]), p1 = proj([GW, GH]);
    const X0 = ctm.a * (v.k * p0[0] + v.x) + ctm.e - hr.left, Y0 = ctm.d * (v.k * p0[1] + v.y) + ctm.f - hr.top;
    const X1 = ctm.a * (v.k * p1[0] + v.x) + ctm.e - hr.left, Y1 = ctm.d * (v.k * p1[1] + v.y) + ctm.f - hr.top;
    cv.style.transform = `matrix(${(X1 - X0) / cv.width},0,0,${(Y1 - Y0) / cv.height},${X0},${Y0})`;
  };
  World.mapToGrid = function (pt) {
    const proj = App.basemap && App.basemap.proj;
    return proj && proj.invert ? proj.invert(pt) : pt;
  };
  World.mapUnitsPerCell = function () {
    const proj = App.basemap && App.basemap.proj;
    if (!proj) return 1;
    return proj([1, 0])[0] - proj([0, 0])[0];
  };

  // ---------------- starters ----------------
  World.randomContinent = function () {
    ensureBuffers();
    Actions.beginStroke();
    const s = (Math.random() * 1e6) | 0;
    const elev = World.elev, cover = World.cover;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const nx = x / GW - 0.5, ny = (y / GH - 0.5) * (GH / GW);
        const falloff = Math.sqrt(nx * nx * 1.3 + ny * ny * 4) * 1.9;
        const h = fbm(x / 170, y / 170, s, 5) + 0.5 * fbm(x / 60, y / 60, s + 7, 3) * 0.35 - falloff * 0.55;
        const i = y * GW + x;
        if (h < 0.3) { elev[i] = 0; cover[i] = 0; continue; }
        const ridge = 1 - Math.abs(fbm(x / 90, y / 90, s + 3, 4) * 2 - 1);
        elev[i] = ridge > 0.93 && h > 0.37 ? 3 : ridge > 0.86 && h > 0.34 ? 2 : 1;
        const lat = Math.abs(y / GH - 0.5) * 2 + (fbm(x / 50, y / 50, s + 9, 3) - 0.5) * 0.25;
        const moist = fbm(x / 120, y / 120, s + 21, 4);
        cover[i] = lat > 0.82 ? 4 : moist > 0.56 ? (lat < 0.3 ? 5 : 1) : moist < 0.36 && lat < 0.55 ? 2 : moist > 0.5 && elev[i] === 1 && fbm(x / 40, y / 40, s + 5, 2) > 0.64 ? 3 : 0;
      }
    }
    World.renderAll();
    commitRasters();
    Actions.endStroke();
  };
  World.clearTerrain = function () {
    ensureBuffers();
    Actions.beginStroke();
    World.elev.fill(0); World.cover.fill(0);
    World.renderAll();
    commitRasters();
    Actions.mut((p) => { p.world.rivers = []; }, { undo: false });
    Actions.endStroke();
  };

  // ---------------- polygon helpers ----------------
  function ringArea(r) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    return a / 2;
  }
  function chaikinClosed(r) {
    const out = [];
    const n = r.length - (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = r[i], b = r[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    return out;
  }
  function closeRing(r) {
    if (!r.length) return r;
    const a = r[0], b = r[r.length - 1];
    return a[0] === b[0] && a[1] === b[1] ? r : r.concat([[a[0], a[1]]]);
  }
  // Sutherland–Hodgman against an axis-aligned rectangle (per ring)
  function clipRingRect(ring, x0, y0, x1, y1) {
    let pts = ring;
    const edges = [
      (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1
    ];
    const inter = [
      (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])],
      (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])],
      (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0],
      (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]
    ];
    for (let e = 0; e < 4; e++) {
      const inside = edges[e], cut = inter[e];
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
        const ci = inside(cur), pi = inside(prev);
        if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); }
        else if (pi) out.push(cut(prev, cur));
      }
      pts = out;
      if (!pts.length) break;
    }
    return pts;
  }
  function inPoly(poly, x, y) {
    if (!d3.polygonContains(poly[0], [x, y])) return false;
    for (let h = 1; h < poly.length; h++) if (d3.polygonContains(poly[h], [x, y])) return false;
    return true;
  }
  function geomPolys(g) {
    if (!g) return [];
    if (g.type === "Polygon") return [g.coordinates];
    if (g.type === "MultiPolygon") return g.coordinates;
    return [];
  }

  // Exact even-odd scanline rasterization of features onto the grid (pixel
  // centres). Returns Int32Array of feature index per cell, -1 = none.
  function rasterize(features) {
    const out = new Int32Array(GW * GH).fill(-1);
    features.forEach((f, idx) => {
      const edges = [];
      let ymin = Infinity, ymax = -Infinity;
      geomPolys(f.geometry).forEach((poly) => poly.forEach((ring) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i], b = ring[i + 1];
          if (a[1] === b[1]) continue;
          edges.push(a[0], a[1], b[0], b[1]);
          if (a[1] < ymin) ymin = a[1]; if (a[1] > ymax) ymax = a[1];
          if (b[1] < ymin) ymin = b[1]; if (b[1] > ymax) ymax = b[1];
        }
      }));
      if (!edges.length) return;
      const ya = clamp(Math.floor(ymin - 0.5), 0, GH - 1), yb = clamp(Math.ceil(ymax), 0, GH - 1);
      const xs = [];
      for (let y = ya; y <= yb; y++) {
        const sy = y + 0.5;
        xs.length = 0;
        for (let e = 0; e < edges.length; e += 4) {
          const y0 = edges[e + 1], y1 = edges[e + 3];
          if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
            xs.push(edges[e] + (sy - y0) * (edges[e + 2] - edges[e]) / (y1 - y0));
          }
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        const row = y * GW;
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = clamp(Math.ceil(xs[k] - 0.5), 0, GW), xb = clamp(Math.floor(xs[k + 1] - 0.5), -1, GW - 1);
          for (let x = xa; x <= xb; x++) out[row + x] = idx;
        }
      }
    });
    return out;
  }

  // connected components of cells where pred(i) holds; 4- or 8-connected
  function components(pred, eight) {
    const N = GW * GH;
    const comp = new Int32Array(N).fill(-1);
    const list = [];
    const queue = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1 || !pred(s)) continue;
      const id = list.length;
      const c = { id, area: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, minx: GW, miny: GH, maxx: 0, maxy: 0, edge: false };
      list.push(c);
      let qh = 0, qt = 0;
      queue[qt++] = s; comp[s] = id;
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % GW, y = (i / GW) | 0;
        c.area++; c.sx += x + 0.5; c.sy += y + 0.5;
        c.sxx += (x + 0.5) * (x + 0.5); c.syy += (y + 0.5) * (y + 0.5); c.sxy += (x + 0.5) * (y + 0.5);
        if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x;
        if (y < c.miny) c.miny = y; if (y > c.maxy) c.maxy = y;
        if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) c.edge = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (!eight && dx && dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
            const j = yy * GW + xx;
            if (comp[j] === -1 && pred(j)) { comp[j] = id; queue[qt++] = j; }
          }
        }
      }
    }
    return { comp, list };
  }

  // ---------------- analysis (shared by generation and the atlas) ----------------
  function analyze(features, rivers) {
    const elev = World.elev, cover = World.cover;
    const cellOf = rasterize(features);
    const cells = features.map(() => ({ n: 0, land: 0, sx: 0, sy: 0, elevH: [0, 0, 0, 0], coverH: [0, 0, 0, 0, 0, 0],
      waters: new Map(), nb: new Map(), lands: new Map(), ranges: new Map(), rivers: new Set() }));
    const land = components((i) => elev[i] > 0, false);
    const water = components((i) => elev[i] === 0, false);
    // mountain ranges: peaks less than ~2 cells apart belong to one range
    const near3 = new Uint8Array(GW * GH), tmp3 = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let hit = 0;
      for (let d = -2; d <= 2 && !hit; d++) { const xx = x + d; if (xx >= 0 && xx < GW && elev[y * GW + xx] === 3) hit = 1; }
      tmp3[y * GW + x] = hit;
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let hit = 0;
      for (let d = -2; d <= 2 && !hit; d++) { const yy = y + d; if (yy >= 0 && yy < GH && tmp3[yy * GW + x]) hit = 1; }
      near3[y * GW + x] = hit;
    }
    const range = components((i) => near3[i] === 1, true);
    range.list.forEach((c) => { c.area = 0; c.sx = c.sy = c.sxx = c.syy = c.sxy = 0; });
    for (let i = 0; i < GW * GH; i++) {
      const rc = range.comp[i];
      if (rc < 0) continue;
      if (elev[i] !== 3) { range.comp[i] = -1; continue; }
      const c = range.list[rc], x = (i % GW) + 0.5, y = ((i / GW) | 0) + 0.5;
      c.area++; c.sx += x; c.sy += y; c.sxx += x * x; c.syy += y * y; c.sxy += x * y;
    }
    land.list.forEach((c) => { c.cells = new Map(); });
    water.list.forEach((c) => { c.cells = new Map(); c.kind = c.edge ? "ocean" : "lake"; });
    range.list.forEach((c) => { c.cells = new Map(); });
    const inc = (m, k, v) => m.set(k, (m.get(k) || 0) + (v || 1));
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        const c = cellOf[i];
        if (c < 0) continue;
        const cell = cells[c];
        cell.n++;
        if (x < GW - 1) { const c2 = cellOf[i + 1]; if (c2 >= 0 && c2 !== c) { inc(cell.nb, c2); inc(cells[c2].nb, c); } }
        if (y < GH - 1) { const c2 = cellOf[i + GW]; if (c2 >= 0 && c2 !== c) { inc(cell.nb, c2); inc(cells[c2].nb, c); } }
        if (elev[i] === 0) continue;
        cell.land++; cell.sx += x + 0.5; cell.sy += y + 0.5;
        cell.elevH[elev[i]]++; cell.coverH[cover[i]]++;
        inc(cell.lands, land.comp[i]); inc(land.list[land.comp[i]].cells, c);
        if (range.comp[i] >= 0) { inc(cell.ranges, range.comp[i]); inc(range.list[range.comp[i]].cells, c); }
        // water within 2 cells in the 4 directions -> this cell touches that water body
        for (let d = 1; d <= 2; d++) {
          const nbrs = [x - d >= 0 ? i - d : -1, x + d < GW ? i + d : -1, y - d >= 0 ? i - d * GW : -1, y + d < GH ? i + d * GW : -1];
          for (const j of nbrs) {
            if (j >= 0 && elev[j] === 0) { const wc = water.comp[j]; inc(cell.waters, wc); inc(water.list[wc].cells, c); }
          }
        }
      }
    }
    // rivers: ordered provinces along the line, source & mouth
    const riverInfo = (rivers || []).map((rv) => {
      const seq = [];
      let len = 0;
      const pts = rv.pts || [];
      for (let k = 0; k < pts.length; k++) {
        if (k) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        const a = pts[k], b = pts[Math.min(pts.length - 1, k + 1)];
        const segL = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(segL / 0.5));
        for (let s = 0; s < n; s++) {
          const x = clamp(Math.floor(a[0] + (b[0] - a[0]) * s / n), 0, GW - 1), y = clamp(Math.floor(a[1] + (b[1] - a[1]) * s / n), 0, GH - 1);
          const c = cellOf[y * GW + x];
          if (c >= 0 && elev[y * GW + x] > 0) {
            if (seq[seq.length - 1] !== c) seq.push(c);
            cells[c].rivers.add(rv.id);
          }
        }
      }
      const waterNear = (pt) => {
        if (!pt) return -1;
        for (let rr = 0; rr <= 3; rr++) {
          for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
            const x = Math.floor(pt[0]) + dx, y = Math.floor(pt[1]) + dy;
            if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
            if (elev[y * GW + x] === 0) return water.comp[y * GW + x];
          }
        }
        return -1;
      };
      const uniq = seq.filter((c, i) => seq.indexOf(c) === i);
      return { id: rv.id, name: rv.name, len, cells: uniq, mouthWater: waterNear(pts[pts.length - 1]), sourceWater: waterNear(pts[0]) };
    });
    return { cellOf, cells, lands: land.list, landComp: land.comp, waters: water.list, waterComp: water.comp, ranges: range.list, rangeComp: range.comp, rivers: riverInfo };
  }

  function cellTerrain(cell) {
    const L = cell.land || 1;
    if (cell.elevH[3] / L >= 0.4) return "mountain";
    if ((cell.elevH[2] + cell.elevH[3]) / L >= 0.4) return "hills";
    let best = 0;
    for (let k = 1; k < 6; k++) if (cell.coverH[k] > cell.coverH[best]) best = k;
    return COVER[best];
  }

  // ---------------- province generation ----------------
  World.generate = function () {
    if (!World.active()) return;
    ensureBuffers();
    const p = App.project;
    const w = p.world;
    const elev = World.elev, cover = World.cover;
    const S = clamp(+w.cellSize || 18, 5, 60);
    const rand = mulberry32((w.seed | 0) || 12345);

    // 1) coastline polygons: contour of a lightly blurred land mask (padded so edge land closes)
    const PW = GW + 2, PH = GH + 2;
    const field = new Float64Array(PW * PH);
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        let nb = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && elev[yy * GW + xx] > 0) nb++;
        }
        field[(y + 1) * PW + x + 1] = (elev[y * GW + x] > 0 ? 0.6 : 0) + 0.4 * nb / 8;
      }
    }
    const contour = d3.contours().size([PW, PH]).thresholds([0.5])(field)[0];
    // d3.contours puts sample (i, j) at point (i, j); our cell i is centred at i + 0.5
    const OFF = -1 + 0.5;
    const landPolys = [];
    (contour ? contour.coordinates : []).forEach((poly) => {
      const rings = [];
      for (let ri = 0; ri < poly.length; ri++) {
        const shifted = poly[ri].map((q) => [q[0] + OFF, q[1] + OFF]);
        const ok = Math.abs(ringArea(shifted)) >= (ri === 0 ? 1.2 : 3);
        const sm = ok ? rdp(closeRing(chaikinClosed(shifted)), 0.12) : [];
        if (sm.length < 4) { if (ri === 0) break; continue; } // no exterior -> drop its holes too
        rings.push(closeRing(sm.map((q) => [r2(q[0]), r2(q[1])])));
      }
      if (!rings.length) return;
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      rings[0].forEach((q) => { if (q[0] < bx0) bx0 = q[0]; if (q[0] > bx1) bx1 = q[0]; if (q[1] < by0) by0 = q[1]; if (q[1] > by1) by1 = q[1]; });
      landPolys.push({ rings, bbox: [bx0, by0, bx1, by1], area: Math.abs(ringArea(rings[0])), seeds: [] });
    });
    if (!landPolys.length) { Actions.toast(t("world.noLand")); return; }

    // 2) seeds: dart throwing with terrain-dependent spacing (big provinces in
    //    mountains / deserts / tundra, small ones in fertile lowland)
    const factorAt = (x, y) => {
      const i = clamp(y | 0, 0, GH - 1) * GW + clamp(x | 0, 0, GW - 1);
      const e = elev[i], c = cover[i];
      let f = 1;
      if (e === 3) f = 1.5; else if (e === 2) f = 1.15;
      if (c === 2) f = Math.max(f, 1.6); else if (c === 4) f = Math.max(f, 1.4); else if (c === 3) f = Math.max(f, 1.15);
      return f;
    };
    const step = S * 0.33;
    const cand = [];
    for (let y = step / 2; y < GH; y += step) {
      for (let x = step / 2; x < GW; x += step) {
        const jx = x + (rand() - 0.5) * step, jy = y + (rand() - 0.5) * step;
        const i = clamp(jy | 0, 0, GH - 1) * GW + clamp(jx | 0, 0, GW - 1);
        if (elev[i] > 0) cand.push([jx, jy]);
      }
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp; }
    const HC = S;
    const hash = new Map();
    const seeds = [];
    cand.forEach((c) => {
      const fc = factorAt(c[0], c[1]);
      const hx = Math.floor(c[0] / HC), hy = Math.floor(c[1] / HC);
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const b = hash.get((hx + ox) + "," + (hy + oy));
        if (!b) continue;
        for (const q of b) {
          const need = (fc + q.f) * 0.5 * S * 0.92;
          if ((q.x - c[0]) ** 2 + (q.y - c[1]) ** 2 < need * need) return;
        }
      }
      const s = { x: c[0], y: c[1], f: fc };
      seeds.push(s);
      const key = hx + "," + hy;
      if (!hash.has(key)) hash.set(key, []);
      hash.get(key).push(s);
    });
    // each seed belongs to the landmass polygon that contains it
    seeds.forEach((s) => {
      for (const lp of landPolys) {
        if (s.x < lp.bbox[0] || s.x > lp.bbox[2] || s.y < lp.bbox[1] || s.y > lp.bbox[3]) continue;
        if (inPoly(lp.rings, s.x, s.y)) { lp.seeds.push([s.x, s.y]); return; }
      }
    });

    // 3) relax (Lloyd, 2 passes), then push seeds off rivers so borders follow them
    const rivers = w.rivers || [];
    landPolys.forEach((lp) => {
      if (lp.seeds.length < 3) return;
      const bounds = [lp.bbox[0] - 1, lp.bbox[1] - 1, lp.bbox[2] + 1, lp.bbox[3] + 1];
      for (let it = 0; it < 2; it++) {
        const vor = d3.Delaunay.from(lp.seeds).voronoi(bounds);
        lp.seeds = lp.seeds.map((s, i) => {
          const cell = vor.cellPolygon(i);
          if (!cell) return s;
          const c = d3.polygonCentroid(cell);
          return inPoly(lp.rings, c[0], c[1]) ? [s[0] * 0.3 + c[0] * 0.7, s[1] * 0.3 + c[1] * 0.7] : s;
        });
      }
      if (!rivers.length) return;
      lp.seeds = lp.seeds.map((s) => {
        let best = null, bd = S * 0.42;
        rivers.forEach((rv) => {
          for (let k = 0; k < rv.pts.length - 1; k++) {
            const d = distToSeg(s[0], s[1], rv.pts[k], rv.pts[k + 1]);
            if (d < bd) { bd = d; best = [rv.pts[k], rv.pts[k + 1]]; }
          }
        });
        if (!best) return s;
        const [a, b] = best;
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const side = (s[0] - a[0]) * nx + (s[1] - a[1]) * ny >= 0 ? 1 : -1;
        const push = S * 0.42 - bd;
        const q = [s[0] + nx * side * push, s[1] + ny * side * push];
        return inPoly(lp.rings, q[0], q[1]) ? q : s;
      });
    });

    // 4) Voronoi per landmass, clipped to the coastline
    const features = [];
    const pushCell = (rings) => {
      if (!rings || !rings.length) return;
      const clean = rings.map((poly) => poly.map((ring) => closeRing(ring.map((q) => [r2(q[0]), r2(q[1])]))).filter((ring) => ring.length >= 4))
        .filter((poly) => poly.length && Math.abs(ringArea(poly[0])) > 0.05);
      if (!clean.length) return;
      features.push({ type: "Feature", geometry: clean.length === 1 ? { type: "Polygon", coordinates: clean[0] } : { type: "MultiPolygon", coordinates: clean }, properties: {} });
    };
    landPolys.forEach((lp) => {
      if (lp.seeds.length <= 1) { pushCell([lp.rings]); return; }
      // bucket the coastline vertices so "cell fully inland" is a cheap test
      const B = S;
      const buckets = new Set();
      lp.rings.forEach((ring) => ring.forEach((q) => buckets.add(Math.floor(q[0] / B) + "," + Math.floor(q[1] / B))));
      const vor = d3.Delaunay.from(lp.seeds).voronoi([lp.bbox[0] - 2, lp.bbox[1] - 2, lp.bbox[2] + 2, lp.bbox[3] + 2]);
      lp.seeds.forEach((s, i) => {
        const cell = vor.cellPolygon(i);
        if (!cell) return;
        let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
        cell.forEach((q) => { if (q[0] < cx0) cx0 = q[0]; if (q[0] > cx1) cx1 = q[0]; if (q[1] < cy0) cy0 = q[1]; if (q[1] > cy1) cy1 = q[1]; });
        let touchesCoast = false;
        for (let by = Math.floor(cy0 / B); by <= Math.floor(cy1 / B) && !touchesCoast; by++) {
          for (let bx = Math.floor(cx0 / B); bx <= Math.floor(cx1 / B); bx++) if (buckets.has(bx + "," + by)) { touchesCoast = true; break; }
        }
        if (!touchesCoast && cell.every((q) => inPoly(lp.rings, q[0], q[1]))) { pushCell([[cell]]); return; }
        let res = null;
        try {
          const local = lp.rings.map((ring) => clipRingRect(ring.slice(0, -1), cx0 - 0.5, cy0 - 0.5, cx1 + 0.5, cy1 + 0.5))
            .filter((ring) => ring.length >= 3).map(closeRing);
          if (local.length) res = polygonClipping.intersection([cell], local);
        } catch (e) {
          try { res = polygonClipping.intersection([cell], lp.rings); } catch (e2) { res = null; console.warn("world: clip failed", e2); }
        }
        if (res && res.length) pushCell(res);
      });
    });

    // number provinces reading-order (north-west first)
    features.forEach((f) => {
      const poly = geomPolys(f.geometry).sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0];
      f._c = d3.polygonCentroid(poly[0]);
    });
    features.sort((a, b) => (Math.floor(a._c[1] / (S * 1.5)) - Math.floor(b._c[1] / (S * 1.5))) || (a._c[0] - b._c[0]));
    const prefix = t("world.provinceDefault");
    features.forEach((f, i) => {
      const id = "p" + (i + 1);
      f.id = id;
      delete f._c;
      f.properties = { id, name: prefix.replace("{n}", i + 1) };
    });

    // 5) per-province terrain / coast from the rasters
    const an = analyze(features, rivers);
    features.forEach((f, i) => {
      const c = an.cells[i];
      f.properties.terrain = cellTerrain(c);
      f.properties.coastal = [...c.waters.keys()].some((wc) => an.waters[wc].kind === "ocean");
    });

    // 6) carry the political map over from the previous cut by pixel overlap.
    //    Each new province takes the owner holding most of its area (a vote over
    //    all old provinces it covers), copying the record of the biggest of them.
    const oldFeats = (App.basemap.raw && App.basemap.raw.features) || [];
    let pairs = null, bestNewForOld = null;
    if (oldFeats.length) {
      const oldR = rasterize(oldFeats);
      const overlap = new Map();
      for (let i = 0; i < GW * GH; i++) {
        const n = an.cellOf[i], o = oldR[i];
        if (n >= 0 && o >= 0) { const k = n * 1e6 + o; overlap.set(k, (overlap.get(k) || 0) + 1); }
      }
      pairs = [];
      const bestNew = new Int32Array(oldFeats.length).fill(-1), bestNewV = new Float64Array(oldFeats.length);
      overlap.forEach((v, k) => {
        const n = Math.floor(k / 1e6), o = k - n * 1e6;
        pairs.push([n, String(oldFeats[o].id), v]);
        if (v > bestNewV[o]) { bestNewV[o] = v; bestNew[o] = n; }
      });
      bestNewForOld = {};
      oldFeats.forEach((f, o) => { if (bestNew[o] >= 0) bestNewForOld[String(f.id)] = features[bestNew[o]].id; });
    }
    const remapRegions = (regions, groups) => {
      const out = {};
      if (!pairs) return out;
      const effOf = (oid) => {
        const src = regions[oid];
        return src && src.group && groups && groups[src.group] ? groups[src.group] : src;
      };
      const votes = features.map(() => new Map());   // owner -> { area, best oid, best area }
      pairs.forEach(([n, oid, v]) => {
        const e = effOf(oid);
        const owner = (e && e.owner) || "";
        const m = votes[n];
        const cur = m.get(owner) || { area: 0, oid: null, v: 0 };
        cur.area += v;
        if (v > cur.v) { cur.v = v; cur.oid = oid; }
        m.set(owner, cur);
      });
      features.forEach((f, n) => {
        let win = null, winOwner = "";
        votes[n].forEach((c, owner) => { if (!win || c.area > win.area) { win = c; winOwner = owner; } });
        if (!win || !winOwner) return;
        const rec = JSON.parse(JSON.stringify(effOf(win.oid)));
        delete rec.group; delete rec.members; delete rec.id;
        const src = regions[win.oid];
        rec.name = bestNewForOld[win.oid] === f.id && src && src.name ? src.name : null;
        out[f.id] = rec;
      });
      return out;
    };
    const remapStates = (states) => {
      for (const sid in states) {
        const st = states[sid];
        if (st.capitalRegion) st.capitalRegion = (bestNewForOld && bestNewForOld[st.capitalRegion]) || null;
      }
    };

    const gj = { type: "FeatureCollection", features };
    const p2 = App.project;
    p2.regions = remapRegions(p2.regions || {}, p2.groups);
    remapStates(p2.states || {});
    Object.keys(p2.snapshots || {}).forEach((y) => {
      const snap = p2.snapshots[y];
      snap.regions = remapRegions(snap.regions || {}, snap.groups);
      snap.groups = {};
      remapStates(snap.states || {});
    });
    p2.groups = {};
    p2.featLabels = {};
    p2.regionGeomEdits = { removed: {}, features: {} };
    p2.customGeo = gj;
    p2.world.genRev = p2.world.rev || 0;
    App.undoStack.length = 0;
    App.redoStack.length = 0;
    App.ui.selection = [];
    App.terrVersion++;
    window.scheduleSave();
    Actions.toast(t("world.generated").replace("{n}", features.length));
    window.Geo.load(p2);
  };

  // ---------------- text atlas ----------------
  const DIRS = {
    ru: ["востоке", "северо-востоке", "севере", "северо-западе", "западе", "юго-западе", "юге", "юго-востоке"],
    en: ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
  };
  const TERR = {
    ru: { plains: "равнины", forest: "леса", desert: "пустыня", marsh: "болота", tundra: "тундра", jungle: "джунгли", hills: "холмы", mountain: "горы", lowland: "низменности" },
    en: { plains: "plains", forest: "forest", desert: "desert", marsh: "marsh", tundra: "tundra", jungle: "jungle", hills: "hills", mountain: "mountains", lowland: "lowland" }
  };
  function dirWord(lang, dx, dy) {
    const a = Math.atan2(-dy, dx);
    const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return DIRS[lang][k];
  }
  function mapPosition(lang, x, y) {
    const col = x < GW / 3 ? 0 : x > (2 * GW) / 3 ? 2 : 1;
    const row = y < GH / 3 ? 0 : y > (2 * GH) / 3 ? 2 : 1;
    const ru = [["северо-запад", "север", "северо-восток"], ["запад", "центр", "восток"], ["юго-запад", "юг", "юго-восток"]];
    const en = [["north-west", "north", "north-east"], ["west", "centre", "east"], ["south-west", "south", "south-east"]];
    return (lang === "ru" ? ru : en)[row][col];
  }
  function axisOf(c) {
    const mx = c.sx / c.area, my = c.sy / c.area;
    const cxx = c.sxx / c.area - mx * mx, cyy = c.syy / c.area - my * my, cxy = c.sxy / c.area - mx * my;
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy); // y down
    return { len: Math.sqrt(12 * Math.max(0, l1)), ang };
  }
  function orientation(lang, ang) {
    const deg = ang * 180 / Math.PI; // (-90, 90], y down: positive = right & down
    const ru = lang === "ru";
    if (Math.abs(deg) < 22.5) return ru ? "с запада на восток" : "west to east";
    if (Math.abs(deg) > 67.5) return ru ? "с севера на юг" : "north to south";
    return deg > 0 ? (ru ? "с северо-запада на юго-восток" : "north-west to south-east") : (ru ? "с юго-запада на северо-восток" : "south-west to north-east");
  }

  World.buildAtlas = function (opts) {
    opts = opts || {};
    const p = App.project, bm = App.basemap;
    if (!World.active() || !bm || bm.status !== "ready") return "";
    ensureBuffers();
    const lang = App.ui.lang === "ru" ? "ru" : "en";
    const ru = lang === "ru";
    const w = p.world;
    const km = +w.scaleKm || 5;
    const fmt = (v) => Math.round(v).toLocaleString(ru ? "ru-RU" : "en-US");
    const feats = (bm.raw && bm.raw.features) || [];
    const an = analyze(feats, w.rivers || []);
    const idx = {};
    feats.forEach((f, i) => { idx[String(f.id)] = i; });
    const eff = (id) => window.effRegion(p, id) || {};
    const provName = (i) => {
      const f = feats[i]; const id = String(f.id);
      const r = p.regions[id];
      return (r && r.name) || (f.properties && f.properties.name) || id;
    };
    const ownerOf = (i) => { const e = eff(String(feats[i].id)); return e.owner && p.states[e.owner] ? e.owner : null; };
    const stName = (sid) => (sid ? p.states[sid].name : (ru ? "ничейные земли" : "unclaimed land"));
    const cellC = (i) => { const c = an.cells[i]; return c.land ? [c.sx / c.land, c.sy / c.land] : [0, 0]; };
    const terrainPct = (list) => {
      const h = { plains: 0, forest: 0, desert: 0, marsh: 0, tundra: 0, jungle: 0, hills: 0, mountain: 0 };
      let tot = 0;
      list.forEach((i) => {
        const c = an.cells[i];
        tot += c.land;
        h.mountain += c.elevH[3]; h.hills += c.elevH[2];
        for (let k = 0; k < 6; k++) {
          // cover of lowland only, so hills/mountains are not counted twice
          h[COVER[k]] += c.coverH[k] * (c.land ? c.elevH[1] / c.land : 0);
        }
      });
      if (!tot) return "";
      return Object.keys(h).map((k) => [k, h[k] / tot]).filter((e) => e[1] >= 0.05).sort((a, b) => b[1] - a[1])
        .map((e) => TERR[lang][e[0]] + " " + Math.round(e[1] * 100) + "%").join(", ");
    };

    // names from map labels: on water -> that sea/lake, on mountains -> range, on land -> landmass
    const stateNames = new Set(Object.values(p.states).map((s) => s.name.trim().toLowerCase()));
    const waterName = {}, rangeName = {}, landName = {};
    (p.labels || []).forEach((l) => {
      const g = World.mapToGrid([l.x, l.y]);
      const x = Math.floor(g[0]), y = Math.floor(g[1]);
      if (x < 0 || y < 0 || x >= GW || y >= GH || !l.text) return;
      const i = y * GW + x;
      if (World.elev[i] === 0) { if (!waterName[an.waterComp[i]]) waterName[an.waterComp[i]] = l.text; return; }
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        const rc = an.rangeComp[yy * GW + xx];
        if (rc >= 0) { if (!rangeName[rc]) rangeName[rc] = l.text; return; }
      }
      if (stateNames.has(l.text.trim().toLowerCase())) return;
      const lc = an.landComp[i];
      if (!landName[lc]) landName[lc] = l.text;
    });

    const totalLand = an.lands.reduce((s, c) => s + c.area, 0) || 1;
    const lands = an.lands.filter((c) => c.area >= 4).sort((a, b) => b.area - a.area);
    const landLabel = {};
    let li = 0, ii = 0;
    lands.forEach((c) => {
      const big = c.area >= totalLand * 0.08;
      landLabel[c.id] = landName[c.id] || (big ? (ru ? "Материк " : "Continent ") + (++li) : (ru ? "Остров " : "Island ") + (++ii));
    });
    const waters = an.waters.filter((c) => c.area >= 6).sort((a, b) => b.area - a.area);
    const waterLabel = {};
    let oi = 0, lk = 0;
    waters.forEach((c) => {
      waterLabel[c.id] = waterName[c.id] || (c.kind === "ocean" ? (ru ? "Внешнее море " : "Open sea ") + (++oi) : (ru ? "Озеро " : "Lake ") + (++lk));
    });
    const ranges = an.ranges.filter((c) => c.area >= 20).sort((a, b) => b.area - a.area);
    const rangeLabel = {};
    ranges.forEach((c, i) => { rangeLabel[c.id] = rangeName[c.id] || (ru ? "Горы " : "Mountains ") + (i + 1); });

    // states
    const stateCells = {};
    feats.forEach((f, i) => { const o = ownerOf(i); if (o) (stateCells[o] = stateCells[o] || []).push(i); });
    const stateCentre = (sid) => {
      const st = p.states[sid];
      if (st.capitalRegion && idx[st.capitalRegion] != null) return cellC(idx[st.capitalRegion]);
      let sx = 0, sy = 0, sw = 0;
      stateCells[sid].forEach((i) => { const c = an.cells[i]; sx += c.sx; sy += c.sy; sw += c.land; });
      return sw ? [sx / sw, sy / sw] : [0, 0];
    };
    const distTxt = (a, b) => {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) * km;
      return ru ? `~${fmt(d)} км по прямой (≈${Math.max(1, Math.round(d / 25))} дн. пешком, ≈${Math.max(1, Math.round(d / 50))} дн. верхом)`
        : `~${fmt(d)} km as the crow flies (≈${Math.max(1, Math.round(d / 25))} days on foot, ≈${Math.max(1, Math.round(d / 50))} days on horseback)`;
    };
    const listJoin = (arr) => arr.filter(Boolean).join(", ");

    const L = [];
    const title = p.name || (ru ? "Мир" : "World");
    L.push(ru ? `# Атлас мира «${title}»` : `# World atlas: ${title}`);
    L.push("");
    if (ru) {
      L.push(`Это текстовое описание карты вымышленного мира. Север сверху. Координаты (x, y) — километры от западного и северного края карты. Карта ${fmt(GW * km)} × ${fmt(GH * km)} км, суша ≈ ${fmt(totalLand * km * km)} км². Расстояния — по прямой, дни пути — грубая оценка (25 км/день пешком, 50 км/день верхом).`);
      if (p.currentYear != null) L.push(`Политическая карта — на ${p.currentYear} год.`);
      if (w.genRev != null && w.genRev !== w.rev) L.push("⚠ Рельеф менялся после нарезки провинций — границы провинций могут не совпадать с берегами.");
    } else {
      L.push(`This is a text description of a fictional world map. North is up. Coordinates (x, y) are kilometres from the map's west and north edges. The map is ${fmt(GW * km)} × ${fmt(GH * km)} km, land ≈ ${fmt(totalLand * km * km)} km². Distances are straight-line; travel days are rough (25 km/day on foot, 50 km/day riding).`);
      if (p.currentYear != null) L.push(`Political map as of year ${p.currentYear}.`);
      if (w.genRev != null && w.genRev !== w.rev) L.push("⚠ Terrain was edited after provinces were generated — province borders may not match coasts.");
    }
    L.push("");

    // ---- geography ----
    L.push(ru ? "## География" : "## Geography");
    L.push("");
    L.push(ru ? "### Материки и острова" : "### Landmasses");
    lands.forEach((c) => {
      const cx = c.sx / c.area, cy = c.sy / c.area;
      const cellsHere = [...c.cells.keys()];
      const owners = {};
      cellsHere.forEach((ci) => { const o = ownerOf(ci); if (o) owners[o] = (owners[o] || 0) + c.cells.get(ci); });
      const ownerList = Object.keys(owners).sort((a, b) => owners[b] - owners[a]).map((o) => p.states[o].name);
      const rangesHere = ranges.filter((r) => an.landComp[Math.floor(r.sy / r.area) * GW + Math.floor(r.sx / r.area)] === c.id).map((r) => rangeLabel[r.id]);
      const seas = waters.filter((wc) => cellsHere.some((ci) => an.cells[ci].waters.has(wc.id))).map((wc) => waterLabel[wc.id]);
      L.push(ru
        ? `- **${landLabel[c.id]}** — ${mapPosition(lang, cx, cy)} карты, центр (${fmt(cx * km)}, ${fmt(cy * km)}), ≈${fmt(c.area * km * km)} км², ${fmt((c.maxx - c.minx + 1) * km)} × ${fmt((c.maxy - c.miny + 1) * km)} км. ${cellsHere.length ? `Провинций: ${cellsHere.length}. Рельеф: ${terrainPct(cellsHere)}.` : ""}${ownerList.length ? ` Государства: ${listJoin(ownerList)}.` : ""}${rangesHere.length ? ` Горы: ${listJoin(rangesHere)}.` : ""}${seas.length ? ` Омывается: ${listJoin(seas)}.` : ""}`
        : `- **${landLabel[c.id]}** — ${mapPosition(lang, cx, cy)} of the map, centre (${fmt(cx * km)}, ${fmt(cy * km)}), ≈${fmt(c.area * km * km)} km², ${fmt((c.maxx - c.minx + 1) * km)} × ${fmt((c.maxy - c.miny + 1) * km)} km. ${cellsHere.length ? `Provinces: ${cellsHere.length}. Terrain: ${terrainPct(cellsHere)}.` : ""}${ownerList.length ? ` States: ${listJoin(ownerList)}.` : ""}${rangesHere.length ? ` Mountains: ${listJoin(rangesHere)}.` : ""}${seas.length ? ` Coasts on: ${listJoin(seas)}.` : ""}`);
    });
    L.push("");
    if (waters.length) {
      L.push(ru ? "### Моря и озёра" : "### Seas and lakes");
      waters.forEach((c) => {
        const cellsHere = [...c.cells.keys()];
        const owners = [...new Set(cellsHere.map(ownerOf).filter(Boolean))].map((o) => p.states[o].name);
        const cx = c.sx / c.area, cy = c.sy / c.area;
        const kind = c.kind === "ocean" ? (ru ? "море/океан (выходит к краю карты)" : "sea/ocean (reaches the map edge)") : (ru ? "озеро (внутреннее)" : "lake (landlocked)");
        L.push(ru
          ? `- **${waterLabel[c.id]}** — ${kind}, ${mapPosition(lang, cx, cy)} карты, ≈${fmt(c.area * km * km)} км².${owners.length ? ` Берега: ${listJoin(owners)}.` : ""}`
          : `- **${waterLabel[c.id]}** — ${kind}, ${mapPosition(lang, cx, cy)} of the map, ≈${fmt(c.area * km * km)} km².${owners.length ? ` Shores: ${listJoin(owners)}.` : ""}`);
      });
      L.push("");
    }
    if (ranges.length) {
      L.push(ru ? "### Горы" : "### Mountain ranges");
      ranges.forEach((c) => {
        const ax = axisOf(c);
        const cx = c.sx / c.area, cy = c.sy / c.area;
        const cellsHere = [...c.cells.keys()].sort((a, b) => c.cells.get(b) - c.cells.get(a));
        const owners = [...new Set(cellsHere.map(ownerOf).filter(Boolean))].map((o) => p.states[o].name);
        L.push(ru
          ? `- **${rangeLabel[c.id]}** — ${mapPosition(lang, cx, cy)} карты, тянутся ${orientation(lang, ax.ang)} на ~${fmt(Math.max(ax.len, 1) * km)} км, центр (${fmt(cx * km)}, ${fmt(cy * km)}).${cellsHere.length ? ` Провинции: ${listJoin(cellsHere.slice(0, 12).map(provName))}${cellsHere.length > 12 ? " и др" : ""}.` : ""}${owners.length ? ` Государства: ${listJoin(owners)}.` : ""}`
          : `- **${rangeLabel[c.id]}** — ${mapPosition(lang, cx, cy)} of the map, running ${orientation(lang, ax.ang)} for ~${fmt(Math.max(ax.len, 1) * km)} km, centre (${fmt(cx * km)}, ${fmt(cy * km)}).${cellsHere.length ? ` Provinces: ${listJoin(cellsHere.slice(0, 12).map(provName))}${cellsHere.length > 12 ? " etc" : ""}.` : ""}${owners.length ? ` States: ${listJoin(owners)}.` : ""}`);
      });
      L.push("");
    }
    if (an.rivers.length) {
      L.push(ru ? "### Реки" : "### Rivers");
      an.rivers.forEach((rv) => {
        const path = rv.cells.map((i) => `${provName(i)} (${stName(ownerOf(i))})`);
        const mouth = rv.mouthWater >= 0 ? (waterLabel[rv.mouthWater] || (ru ? "водоём" : "a body of water")) : null;
        const src = rv.sourceWater >= 0 && rv.sourceWater !== rv.mouthWater ? waterLabel[rv.sourceWater] : null;
        L.push(ru
          ? `- **${rv.name}** — ~${fmt(rv.len * km)} км. ${src ? `Вытекает из: ${src}. ` : ""}${path.length ? `Течёт от истока к устью через: ${path.join(" → ")}. ` : ""}${mouth ? `Впадает в: ${mouth}.` : "Устье не у воды."}`
          : `- **${rv.name}** — ~${fmt(rv.len * km)} km. ${src ? `Flows out of: ${src}. ` : ""}${path.length ? `From source to mouth through: ${path.join(" → ")}. ` : ""}${mouth ? `Mouth: ${mouth}.` : "Does not reach water."}`);
      });
      L.push("");
    }

    // ---- states ----
    const neighborsOf = (list) => {
      const own = new Set(list);
      const out = {};
      list.forEach((i) => an.cells[i].nb.forEach((cnt, j) => {
        if (own.has(j)) return;
        const o = ownerOf(j) || "__none";
        out[o] = (out[o] || 0) + cnt;
      }));
      return out;
    };
    const sids = p.stateOrder.filter((sid) => p.states[sid] && stateCells[sid]);
    if (sids.length) {
      L.push(ru ? "## Государства" : "## States");
      L.push("");
      sids.forEach((sid) => {
        const st = p.states[sid];
        const list = stateCells[sid];
        const area = list.reduce((s, i) => s + an.cells[i].land, 0);
        const cen = stateCentre(sid);
        L.push(`### ${st.name}`);
        const facts = [];
        const fld = (lab, v) => { if (v != null && String(v).trim()) facts.push(`${lab}: ${String(v).trim()}`); };
        if (ru) {
          fld("Форма правления", st.gov); fld("Идеология", st.ideology); fld("Культура", st.culture); fld("Религия", st.religion);
          fld("Язык", st.language); fld("Население", st.population); fld("Экономика", st.economy); fld("Армия", st.army);
          if (st.vassalOf && p.states[st.vassalOf]) facts.push(`Вассал: ${p.states[st.vassalOf].name}`);
        } else {
          fld("Government", st.gov); fld("Ideology", st.ideology); fld("Culture", st.culture); fld("Religion", st.religion);
          fld("Language", st.language); fld("Population", st.population); fld("Economy", st.economy); fld("Army", st.army);
          if (st.vassalOf && p.states[st.vassalOf]) facts.push(`Vassal of: ${p.states[st.vassalOf].name}`);
        }
        if (facts.length) L.push("- " + facts.join("; "));
        const capName = st.capitalRegion && idx[st.capitalRegion] != null ? provName(idx[st.capitalRegion]) : null;
        const capital = st.capital && capName && capName !== st.capital ? `${st.capital} (${capName})` : (st.capital || capName || "");
        L.push(ru
          ? `- Территория: ${list.length} пров., ≈${fmt(area * km * km)} км², ${mapPosition(lang, cen[0], cen[1])} карты, центр (${fmt(cen[0] * km)}, ${fmt(cen[1] * km)}).${capital ? ` Столица: ${capital}.` : ""}`
          : `- Territory: ${list.length} provinces, ≈${fmt(area * km * km)} km², ${mapPosition(lang, cen[0], cen[1])} of the map, centre (${fmt(cen[0] * km)}, ${fmt(cen[1] * km)}).${capital ? ` Capital: ${capital}.` : ""}`);
        const landsHere = [...new Set(list.map((i) => { const m = an.cells[i].lands; let b = -1, bv = 0; m.forEach((v, k) => { if (v > bv) { bv = v; b = k; } }); return b; }))]
          .filter((k) => landLabel[k]).map((k) => landLabel[k]);
        L.push(ru ? `- Рельеф: ${terrainPct(list)}.${landsHere.length ? ` Расположено на: ${listJoin(landsHere)}.` : ""}` : `- Terrain: ${terrainPct(list)}.${landsHere.length ? ` Located on: ${listJoin(landsHere)}.` : ""}`);
        const coastWaters = new Map();
        list.forEach((i) => an.cells[i].waters.forEach((v, wc) => { if (waterLabel[wc]) coastWaters.set(wc, (coastWaters.get(wc) || 0) + 1); }));
        const coastCount = list.filter((i) => [...an.cells[i].waters.keys()].some((wc) => waterLabel[wc])).length;
        if (coastWaters.size) {
          L.push(ru ? `- Выход к воде: ${[...coastWaters.keys()].map((wc) => waterLabel[wc]).join(", ")} (прибрежных провинций: ${coastCount}).`
            : `- Coast on: ${[...coastWaters.keys()].map((wc) => waterLabel[wc]).join(", ")} (${coastCount} coastal provinces).`);
        } else {
          L.push(ru ? "- Выхода к морю нет." : "- Landlocked.");
        }
        const rivers = (w.rivers || []).filter((rv) => list.some((i) => an.cells[i].rivers.has(rv.id))).map((rv) => rv.name);
        const rng = ranges.filter((r) => list.some((i) => r.cells.has(i))).map((r) => rangeLabel[r.id]);
        if (rivers.length || rng.length) {
          L.push(ru ? `- ${rivers.length ? `Реки: ${listJoin(rivers)}. ` : ""}${rng.length ? `Горы: ${listJoin(rng)}.` : ""}`
            : `- ${rivers.length ? `Rivers: ${listJoin(rivers)}. ` : ""}${rng.length ? `Mountains: ${listJoin(rng)}.` : ""}`);
        }
        const nb = neighborsOf(list);
        const nbKeys = Object.keys(nb).sort((a, b) => nb[b] - nb[a]);
        if (nbKeys.length) {
          L.push(ru ? "- Сухопутные соседи:" : "- Land neighbours:");
          nbKeys.forEach((o) => {
            const border = fmt(nb[o] * 0.8 * km);
            if (o === "__none") { L.push(ru ? `  - ничейные земли (граница ~${border} км)` : `  - unclaimed land (border ~${border} km)`); return; }
            const oc = stateCentre(o);
            L.push(ru
              ? `  - ${p.states[o].name} — на ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, общая граница ~${border} км; от столицы до столицы ${distTxt(cen, oc)}`
              : `  - ${p.states[o].name} — to the ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, shared border ~${border} km; capital to capital ${distTxt(cen, oc)}`);
          });
        } else {
          L.push(ru ? "- Сухопутных соседей нет." : "- No land neighbours.");
        }
        const sea = new Set();
        coastWaters.forEach((v, wc) => an.waters[wc].cells.forEach((cnt, ci) => { const o = ownerOf(ci); if (o && o !== sid && !nb[o]) sea.add(o); }));
        if (sea.size) {
          L.push(ru ? "- Соседи через воду:" : "- Across the water:");
          [...sea].forEach((o) => {
            const oc = stateCentre(o);
            L.push(ru ? `  - ${p.states[o].name} — на ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, ${distTxt(cen, oc)}`
              : `  - ${p.states[o].name} — to the ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, ${distTxt(cen, oc)}`);
          });
        }
        if (st.notes && String(st.notes).trim()) L.push((ru ? "- Заметки: " : "- Notes: ") + String(st.notes).trim().replace(/\s+/g, " "));
        L.push("");
      });
    }
    const unowned = feats.map((f, i) => i).filter((i) => !ownerOf(i) && an.cells[i].land);
    if (unowned.length && sids.length) {
      L.push(ru ? `Ничейные земли: ${unowned.length} пров., ≈${fmt(unowned.reduce((s, i) => s + an.cells[i].land, 0) * km * km)} км².` : `Unclaimed land: ${unowned.length} provinces, ≈${fmt(unowned.reduce((s, i) => s + an.cells[i].land, 0) * km * km)} km².`);
      L.push("");
    }

    // ---- provinces ----
    if (opts.provinces !== false && feats.length) {
      L.push(ru ? "## Провинции" : "## Provinces");
      L.push(ru ? "Формат: название [id] — владелец; рельеф; центр (x, y) км; побережье; реки; соседи." : "Format: name [id] — owner; terrain; centre (x, y) km; coast; rivers; neighbours.");
      L.push("");
      feats.forEach((f, i) => {
        const c = an.cells[i];
        if (!c.land) return;
        const cc = cellC(i);
        const e = eff(String(f.id));
        const parts = [stName(ownerOf(i))];
        if (e.status && e.status !== "core" && ownerOf(i)) parts[0] += ` (${e.status})`;
        parts.push(terrainPct([i]));
        parts.push(`(${fmt(cc[0] * km)}, ${fmt(cc[1] * km)})`);
        const wn = [...c.waters.keys()].filter((wc) => waterLabel[wc]).map((wc) => waterLabel[wc]);
        if (wn.length) parts.push((ru ? "берег: " : "coast: ") + wn.join(", "));
        const rn = (w.rivers || []).filter((rv) => c.rivers.has(rv.id)).map((rv) => rv.name);
        if (rn.length) parts.push((ru ? "реки: " : "rivers: ") + rn.join(", "));
        const extra = [e.culture, e.religion, e.language].filter((v) => v && String(v).trim());
        if (extra.length) parts.push(extra.join(" / "));
        const nbs = [...c.nb.keys()].map((j) => provName(j));
        if (nbs.length) parts.push((ru ? "соседи: " : "neighbours: ") + nbs.join(", "));
        L.push(`- ${provName(i)} [${f.id}] — ${parts.filter(Boolean).join("; ")}`);
      });
      L.push("");
    }
    return L.join("\n");
  };
})();
