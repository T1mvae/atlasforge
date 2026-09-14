// AtlasForge — custom world: paint terrain with a stylus, simulate climate and rivers,
// cut the land into provinces that respect ridges, export a text atlas for AI.
//
// Model (project.world, version 2):
//   height — Int16 metres above datum on a RW×RH raster (RES cells per data unit);
//            water is where height ≤ seaLevel
//   cover  — Uint8 painted land cover per raster cell, 0 = follow the climate (biome)
//   rivers — hand-drawn river guides (polylines in data units); with automatic rivers
//            on they are carved into the terrain and lend their names to the flow
// The rasters live in memory (World.height / World.cover); they are copied into
// project.world.rasters only when the project is saved (World.pack) and never enter
// the JSON undo slice — raster edits have their own diff entries in the undo stack.
// Analysis (climate, hydrology, provinces, atlas) runs on the data grid GW×GH
// (1000 × 510, one cell per data unit) in js/terrain.worker.js.
(function () {
  const App = window.App;
  const Actions = window.Actions;
  const TA = window.TerrainAlgos;

  const GW = 1000, GH = 510;          // analysis grid = world basemap data units
  const RES = 2;                      // painted raster cells per data unit
  const RW = GW * RES, RH = GH * RES;
  const HMIN = -8000, HMAX = 9000;

  // painted cover values (0 = climate decides)
  const COVER = ["auto", "plains", "forest", "desert", "marsh", "tundra", "jungle"];
  const COVER_CLASSES = ["plains", "forest", "desert", "marsh", "tundra", "jungle"]; // analysis classes

  const RELIEF_BRUSHES = ["land", "sea", "plains", "hills", "mountains", "peaks", "ridge", "valley", "raise", "lower", "smooth"];
  const COVER_BRUSHES = ["autoCover", "meadow", "forest", "desert", "marsh", "tundra", "jungle"];
  const WATER_BRUSHES = ["river", "eraseRiver"];
  const BRUSHES = RELIEF_BRUSHES.concat(COVER_BRUSHES, WATER_BRUSHES);
  const COVER_OF_BRUSH = { autoCover: 0, meadow: 1, forest: 2, desert: 3, marsh: 4, tundra: 5, jungle: 6 };
  const LINE_BRUSHES = { ridge: 1, valley: 1, river: 1 };
  const BRUSH_SWATCH = {
    land: "#b9c282", sea: "#4a7aa8", plains: "#c9cf95", hills: "#b09a6c", mountains: "#8c7e70", peaks: "#eef1f3",
    ridge: "#7a6b5c", valley: "#9dbb86", raise: "#c2a878", lower: "#7d9fb8", smooth: "#9aa3ad",
    autoCover: "#a8b98a", meadow: "#b9c47f", forest: "#5f9150", desert: "#e2cc8e", marsh: "#849c76", tundra: "#cdd4c8", jungle: "#3f7f4a",
    river: "#3f77b3", eraseRiver: "#c65a5a"
  };

  const World = (window.World = {
    GW, GH, RES, RW, RH, COVER, COVER_CLASSES, BRUSHES, RELIEF_BRUSHES, COVER_BRUSHES, WATER_BRUSHES, BRUSH_SWATCH,
    height: null, cover: null, canvas: null, ctx: null,
    hydro: null,          // latest worker result (see onHydro)
    rasterRev: 0,         // bumps on every raster change
    penSeen: false, renderRev: 0
  });

  World.newWorldData = function () {
    return {
      version: 2, rivers: [], riverNames: {}, scaleKm: 5, cellSize: 18,
      seed: (Math.random() * 1e9) | 0, rev: 0, genRev: null,
      seaLevel: 0,
      climate: { latTop: 70, latBottom: -10, tEquator: 27, tPole: -28 },
      autoRivers: true, riverThreshold: 60,
      provinceOpts: { mountains: "sides", riversAsBorders: false, citySeeds: true },
      rasters: null
    };
  };

  World.active = function () {
    const p = App.project;
    const def = p && window.BASEMAPS[p.basemapId];
    return !!(p && p.world && def && def.kind === "world");
  };
  const W0 = () => App.project.world;
  const sea = () => (+W0().seaLevel || 0);

  // ---------------- small utils ----------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
  const ridged = (x, y, s, oct) => 1 - Math.abs(fbm(x, y, s, oct) * 2 - 1);
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const r2 = (v) => Math.round(v * 100) / 100;

  function b64FromBuffer(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
    return btoa(s);
  }
  function bufferFromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  // v1 worlds stored categorical rasters as RLE + base64
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

  // ---------------- buffers, loading, saving ----------------
  function ensureBuffers() {
    if (!World.height) World.height = new Int16Array(RW * RH).fill(-1500);
    if (!World.cover) World.cover = new Uint8Array(RW * RH);
    if (!World.canvas) {
      const cv = document.createElement("canvas");
      cv.width = RW; cv.height = RH;
      cv.className = "world-canvas";
      World.canvas = cv;
      World.ctx = cv.getContext("2d");
    }
  }

  function ensureDefaults(w) {
    const d = World.newWorldData();
    for (const k in d) if (w[k] === undefined && k !== "rasters") w[k] = d[k];
    w.climate = Object.assign({}, d.climate, w.climate || {});
    w.provinceOpts = Object.assign({}, d.provinceOpts, w.provinceOpts || {});
    if (!w.riverNames) w.riverNames = {};
  }

  // v1 (categorical 1000×510 elev + cover) → v2 heights, upsampled with natural noise
  function migrateV1(w) {
    const n1 = GW * GH;
    const elev = rleDecode(w.elev, n1), cov = rleDecode(w.cover, n1);
    const s = (w.seed | 0) || 7;
    const H = World.height, C = World.cover;
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const gx = x / RES, gy = y / RES;
        const i1 = Math.min(GH - 1, (y / RES) | 0) * GW + Math.min(GW - 1, (x / RES) | 0);
        const e = elev[i1];
        const n = fbm(gx / 12, gy / 12, s, 3);
        let h;
        if (e === 0) h = -250 - 900 * n;
        else if (e === 1) h = 60 + 260 * n;
        else if (e === 2) h = 650 + 600 * ridged(gx / 9, gy / 9, s + 3, 3);
        else h = 2000 + 2400 * ridged(gx / 7, gy / 7, s + 5, 4);
        H[y * RW + x] = clamp(Math.round(h), HMIN, HMAX);
        C[y * RW + x] = e === 0 ? 0 : (cov[i1] + 1);
      }
    }
    // soften the blocky class borders
    blur(0, 0, RW - 1, RH - 1, 2);
    delete w.elev; delete w.cover; delete w.w; delete w.h;
    w.version = 2;
    ensureDefaults(w);
    w.autoRivers = !(w.rivers && w.rivers.length); // keep a hand-drawn river network as it was
  }

  function blur(x0, y0, x1, y1, passes) {
    const H = World.height;
    for (let p = 0; p < passes; p++) {
      for (let y = Math.max(1, y0); y <= Math.min(RH - 2, y1); y++) {
        for (let x = Math.max(1, x0); x <= Math.min(RW - 2, x1); x++) {
          const i = y * RW + x;
          H[i] = (H[i] * 4 + H[i - 1] + H[i + 1] + H[i - RW] + H[i + RW]) / 8;
        }
      }
    }
  }

  let loadedFor = null, settingsKey = "";
  const keyOf = (w) => JSON.stringify([w.seaLevel, w.climate, w.autoRivers, w.riverThreshold]);
  // bring the in-memory rasters in line with the open project (open, import, undo)
  World.sync = function (force) {
    if (!World.active()) return false;
    const p = App.project, w = p.world;
    ensureBuffers();
    if (force || loadedFor !== p) {
      loadedFor = p;
      if (w.version !== 2) {
        ensureBuffers();
        World.height.fill(-1500); World.cover.fill(0);
        migrateV1(w);
      } else {
        ensureDefaults(w);
        const ras = w.rasters;
        let ok = false;
        if (ras && ras.w === RW && ras.h === RH) {
          try {
            const hb = typeof ras.height === "string" ? bufferFromB64(ras.height) : ras.height;
            const cb = typeof ras.cover === "string" ? bufferFromB64(ras.cover) : ras.cover;
            if (hb && hb.byteLength === RW * RH * 2 && cb && cb.byteLength === RW * RH) {
              World.height.set(new Int16Array(hb));
              World.cover.set(new Uint8Array(cb));
              ok = true;
            }
          } catch (e) { console.warn("world rasters unreadable", e); }
        }
        if (!ok) { World.height.fill(-1500); World.cover.fill(0); }
      }
      World.rasterRev++;
      packedRev = ras0(w) ? World.rasterRev : -1;
      World.hydro = null;
      settingsKey = keyOf(w);
      World.renderAll();
      World.requestHydro(0);
      return true;
    }
    const k = keyOf(w);
    if (k !== settingsKey) {
      settingsKey = k;
      World.renderAll();
      World.requestHydro(150);
    }
    return false;
  };
  const ras0 = (w) => w.version === 2 && w.rasters && w.rasters.w === RW;

  // copy the rasters into the project right before it is stored (core.js saveNow)
  let packedRev = -1;
  World.pack = function (p) {
    if (!p || !p.world || p !== loadedFor || !World.height) return;
    if (packedRev === World.rasterRev && p.world.rasters && typeof p.world.rasters.height !== "string") return;
    p.world.rasters = { w: RW, h: RH, height: World.height.slice().buffer, cover: World.cover.slice().buffer };
    packedRev = World.rasterRev;
  };
  // a JSON-safe copy of a project (rasters as base64) for files and localStorage
  World.exportable = function (p) {
    if (!p || !p.world) return p;
    if (p === loadedFor) World.pack(p);
    const ras = p.world.rasters;
    const copy = Object.assign({}, p, { world: Object.assign({}, p.world) });
    if (ras && typeof ras.height !== "string") {
      copy.world.rasters = { w: ras.w, h: ras.h, height: b64FromBuffer(ras.height), cover: b64FromBuffer(ras.cover) };
    }
    return copy;
  };
  // the undo slice must not carry the rasters (they are big and have their own undo)
  World.sliceWorld = function (w) {
    if (!w) return null;
    const copy = Object.assign({}, w);
    delete copy.rasters;
    return copy;
  };

  function changed(x0, y0, x1, y1) {
    World.rasterRev++;
    markDirty(x0, y0, x1, y1);
    World.requestHydro(450);
    if (App.project && App.project.world) App.project.world.rev = (App.project.world.rev || 0) + 1;
    window.scheduleSave();
  }

  // ---------------- raster undo ----------------
  function pushRasterUndo(x0, y0, x1, y1, hBefore, cBefore, extra) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const hb = new Int16Array(w * h), ha = new Int16Array(w * h), cb = new Uint8Array(w * h), ca = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const src = (y0 + y) * RW + x0;
      hb.set(hBefore.subarray(src, src + w), y * w);
      ha.set(World.height.subarray(src, src + w), y * w);
      cb.set(cBefore.subarray(src, src + w), y * w);
      ca.set(World.cover.subarray(src, src + w), y * w);
    }
    const project = App.project;
    const apply = (hs, cs, rivers) => {
      if (App.project !== project) return;
      for (let y = 0; y < h; y++) {
        World.height.set(hs.subarray(y * w, (y + 1) * w), (y0 + y) * RW + x0);
        World.cover.set(cs.subarray(y * w, (y + 1) * w), (y0 + y) * RW + x0);
      }
      if (rivers) { const v = JSON.parse(rivers); project.world.rivers = v.rivers; project.world.riverNames = v.names; }
      changed(x0, y0, x1, y1);
    };
    Actions.pushUndoEntry({
      kind: "raster",
      bytes: w * h * 6,
      undo: () => apply(hb, cb, extra && extra.riversBefore),
      redo: () => apply(ha, ca, extra && extra.riversAfter)
    });
  }

  // ---------------- rendering ----------------
  const BIOME_COLOR = [null, "#eef3f6", "#b9c0ae", "#5f8160", "#c9c2a3", "#d8c79c", "#b7c47e",
    "#6e9a57", "#4d8a56", "#e4cc8e", "#cdbd78", "#7ea655", "#3f7d46", "#7f9c7b"].map((c) => (c ? hex(c) : null));
  const COVER_COLOR = [null, "#b9c47f", "#638f53", "#e0c98c", "#809a76", "#c6cdc0", "#43824c"].map((c) => (c ? hex(c) : null));
  const ROCK = hex("#8f8173"), SNOW = hex("#f3f6f8"), SHALLOW = hex("#90c1da"), MID = hex("#5d9bc5"), DEEP = hex("#35699a"), LAKE = hex("#78abd0");

  function paintRect(x0, y0, x1, y1) {
    ensureBuffers();
    x0 = clamp(x0, 0, RW - 1); y0 = clamp(y0, 0, RH - 1); x1 = clamp(x1, 0, RW - 1); y1 = clamp(y1, 0, RH - 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const img = World.ctx.createImageData(w, h);
    const data = img.data;
    const Hh = World.height, C = World.cover;
    const sl = sea();
    const hy = World.hydro;
    const cellM = ((+W0().scaleKm || 5) * 1000) / RES;
    const zf = 5.5 / cellM; // exaggerated relief
    let o = 0;
    for (let y = y0; y <= y1; y++) {
      const ym = y > 0 ? y - 1 : y, yp = y < RH - 1 ? y + 1 : y;
      for (let x = x0; x <= x1; x++) {
        const i = y * RW + x;
        const hr = Hh[i] - sl;
        const di = (y >> 1) * GW + (x >> 1);
        let r, g, b;
        const grain = (hash2(x, y, 7) - 0.5);
        if (hr <= 0) {
          const d = -hr;
          const t1 = smoothstep(0, 350, d), t2 = smoothstep(350, 3500, d);
          r = SHALLOW[0] + (MID[0] - SHALLOW[0]) * t1 + (DEEP[0] - MID[0]) * t2;
          g = SHALLOW[1] + (MID[1] - SHALLOW[1]) * t1 + (DEEP[1] - MID[1]) * t2;
          b = SHALLOW[2] + (MID[2] - SHALLOW[2]) * t1 + (DEEP[2] - MID[2]) * t2;
          const k = grain * 4;
          r += k; g += k; b += k;
        } else if (hy && hy.lake[di]) {
          r = LAKE[0]; g = LAKE[1]; b = LAKE[2];
        } else {
          const cv = C[i];
          const bio = hy ? hy.biome[di] : 0;
          let base = cv ? COVER_COLOR[cv] : (bio ? BIOME_COLOR[bio] : COVER_COLOR[1]);
          r = base[0]; g = base[1]; b = base[2];
          // bare rock with altitude
          const rt = smoothstep(1100, 3400, hr) * 0.78;
          r += (ROCK[0] - r) * rt; g += (ROCK[1] - g) * rt; b += (ROCK[2] - b) * rt;
          // snow: cold enough at this height (climate), else a plain height snowline
          let snow;
          if (hy) {
            const t = hy.temp[di] - 6.5 * (hr - Math.max(0, hy.hgrid ? hy.hgrid[di] : hr)) / 1000;
            snow = 0.92 * smoothstep(-4, -11, t + (vnoise(x / 3, y / 3, 11) - 0.5) * 4);
          } else {
            snow = smoothstep(3800, 5200, hr + (vnoise(x / 3, y / 3, 11) - 0.5) * 600);
          }
          if (snow > 0) { r += (SNOW[0] - r) * snow; g += (SNOW[1] - g) * snow; b += (SNOW[2] - b) * snow; }
          // Horn hillshade, light from the north-west
          const xm = x > 0 ? x - 1 : x, xp = x < RW - 1 ? x + 1 : x;
          const a1 = Hh[ym * RW + xm], a2 = Hh[ym * RW + x], a3 = Hh[ym * RW + xp];
          const a4 = Hh[y * RW + xm], a6 = Hh[y * RW + xp];
          const a7 = Hh[yp * RW + xm], a8 = Hh[yp * RW + x], a9 = Hh[yp * RW + xp];
          const dzdx = ((a3 + 2 * a6 + a9) - (a1 + 2 * a4 + a7)) / 8 * zf;
          const dzdy = ((a7 + 2 * a8 + a9) - (a1 + 2 * a2 + a3)) / 8 * zf;
          const len = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
          // light vector (-1, -1, 1.4) normalised
          const lambert = (dzdx * 0.5 + dzdy * 0.5 + 0.7) / len;
          const shade = clamp(0.35 + lambert * 0.95, 0.45, 1.3);
          r *= shade; g *= shade; b *= shade;
          // thin dark rim along coasts
          if ((x > 0 && Hh[i - 1] <= sl) || (x < RW - 1 && Hh[i + 1] <= sl) || (y > 0 && Hh[i - RW] <= sl) || (y < RH - 1 && Hh[i + RW] <= sl)) {
            r = r * 0.72 + 20; g = g * 0.72 + 22; b = b * 0.72 + 20;
          }
          const k = grain * (cv === 2 || cv === 6 || bio === 3 || bio === 7 || bio === 8 || bio === 11 || bio === 12 ? 18 : 9);
          r += k; g += k; b += k;
        }
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        o += 4;
      }
    }
    World.ctx.putImageData(img, x0, y0);
  }

  World.renderAll = function () {
    ensureBuffers();
    // in horizontal bands so a long render never allocates one huge ImageData
    for (let y = 0; y < RH; y += 256) paintRect(0, y, RW - 1, Math.min(RH - 1, y + 255));
    World.renderRev++;
  };

  let dirty = null, rafPending = false;
  function markDirty(x0, y0, x1, y1) {
    if (!dirty) dirty = [x0, y0, x1, y1];
    else { dirty[0] = Math.min(dirty[0], x0); dirty[1] = Math.min(dirty[1], y0); dirty[2] = Math.max(dirty[2], x1); dirty[3] = Math.max(dirty[3], y1); }
    if (!rafPending) { rafPending = true; requestAnimationFrame(flush); }
  }
  function flush() {
    rafPending = false;
    if (!dirty) return;
    const d = dirty;
    dirty = null;
    paintRect(d[0] - 2, d[1] - 2, d[2] + 2, d[3] + 2);
    World.renderRev++;
  }

  // ---------------- brushes ----------------
  // One stroke = one undoable change. The raster at stroke start is kept (base) and
  // every cell takes the strongest weight any dab gave it, so dragging back and forth
  // does not pile up — a stroke paints "up to" its target.
  let stroke = null;
  let baseH = null, baseC = null, weight = null;

  function strokeBuffers() {
    if (!baseH) { baseH = new Int16Array(RW * RH); baseC = new Uint8Array(RW * RH); weight = new Float32Array(RW * RH); }
    baseH.set(World.height); baseC.set(World.cover);
  }

  function targetOf(brush, x, y, b, w, sl, salt) {
    const gx = x / RES, gy = y / RES;
    switch (brush) {
      case "land": return Math.max(b, sl + 60 + 240 * fbm(gx / 14, gy / 14, salt, 3));
      case "sea": return Math.min(b, sl - 120 - 900 * fbm(gx / 18, gy / 18, salt + 1, 3));
      case "plains": return b <= sl ? b : sl + 60 + 200 * fbm(gx / 10, gy / 10, salt + 2, 3);
      case "hills": return Math.max(b, sl + 500 + 950 * ridged(gx / 7, gy / 7, salt + 3, 3));
      case "mountains": return Math.max(b, sl + 1700 + 2800 * Math.pow(ridged(gx / 6, gy / 6, salt + 4, 4), 1.3));
      case "peaks": return Math.max(b, sl + 4000 + 4600 * Math.pow(ridged(gx / 5, gy / 5, salt + 5, 4), 1.6));
      case "raise": return b + 420;
      case "lower": return b - 420;
      default: return b;
    }
  }

  function dab(brush, cx, cy, r, strength) {
    const Hh = World.height, C = World.cover;
    const reach = r * 1.2 + 1;
    const x0 = clamp(Math.floor(cx - reach), 0, RW - 1), x1 = clamp(Math.ceil(cx + reach), 0, RW - 1);
    const y0 = clamp(Math.floor(cy - reach), 0, RH - 1), y1 = clamp(Math.ceil(cy + reach), 0, RH - 1);
    const rough = App.ui.worldRough !== false;
    const nf = 1 / Math.max(3, r * 0.45);
    const sl = sea();
    const salt = ((W0().seed | 0) % 100000) + 17;
    const coverVal = COVER_OF_BRUSH[brush];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        let d = Math.sqrt(dx * dx + dy * dy) / r;
        if (rough) d /= 0.8 + 0.4 * vnoise(x * nf, y * nf, 11);
        if (d >= 1) continue;
        const i = y * RW + x;
        const wgt = strength * (1 - smoothstep(0.45, 1, d));
        if (wgt <= weight[i]) continue;
        weight[i] = wgt;
        if (coverVal !== undefined) {
          if (baseH[i] > sl && wgt > 0.3) C[i] = coverVal;
          continue;
        }
        const b = baseH[i];
        let v;
        if (brush === "smooth") {
          if (x === 0 || y === 0 || x === RW - 1 || y === RH - 1) continue;
          let sum = 0, n = 0;
          for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
            const xx = x + ox, yy = y + oy;
            if (xx < 0 || yy < 0 || xx >= RW || yy >= RH) continue;
            sum += baseH[yy * RW + xx]; n++;
          }
          v = b + (sum / n - b) * wgt;
        } else {
          const t = targetOf(brush, x, y, b, wgt, sl, salt);
          v = b + (t - b) * wgt;
        }
        Hh[i] = clamp(Math.round(v), HMIN, HMAX);
      }
    }
    stroke.bbox[0] = Math.min(stroke.bbox[0], x0); stroke.bbox[1] = Math.min(stroke.bbox[1], y0);
    stroke.bbox[2] = Math.max(stroke.bbox[2], x1); stroke.bbox[3] = Math.max(stroke.bbox[3], y1);
    markDirty(x0, y0, x1, y1);
  }

  // Many iPad styluses (Apple Pencil USB-C, Logitech Crayon) report no pressure: a
  // constant value. Watch pen samples; once they never vary, size ignores pressure.
  const pressureProbe = { n: 0, min: 1, max: 0 };
  World.pressureSupport = function () {
    if (pressureProbe.n < 40) return "unknown";
    return pressureProbe.max - pressureProbe.min > 0.02 ? "yes" : "no";
  };
  function notePressure(pressure, pointerType) {
    if (pointerType !== "pen" || pressure == null) return;
    pressureProbe.n++;
    if (pressure < pressureProbe.min) pressureProbe.min = pressure;
    if (pressure > pressureProbe.max) pressureProbe.max = pressure;
  }
  // radius in DATA units (App.ui.worldSize); raster radius = × RES
  function brushRadius(pressure, pointerType, altitude) {
    const size = App.ui.worldSize || 12;
    let r = size;
    if (pointerType === "pen" && App.ui.worldPressure !== false && World.pressureSupport() !== "no") {
      r = size * (0.2 + 0.95 * Math.pow(clamp(pressure || 0.5, 0, 1), 0.85));
    }
    if (pointerType === "pen" && App.ui.tiltSize && altitude != null) {
      r *= 0.7 + 1.1 * (1 - clamp(altitude / (Math.PI / 2), 0, 1));
    }
    return Math.max(0.5, r);
  }
  World.brushRadius = brushRadius;
  const strengthOf = (brush) => (brush === "raise" || brush === "lower" || brush === "smooth" ? clamp(+App.ui.worldStrength || 0.6, 0.05, 1) : 1);

  World.strokeActive = () => !!stroke;
  World.strokeStart = function (g, pressure, pointerType, altitude) {
    if (!World.active()) return;
    ensureBuffers();
    notePressure(pressure, pointerType);
    const brush = App.ui.worldBrush || "land";
    const r = brushRadius(pressure, pointerType, altitude);
    strokeBuffers();
    weight.fill(0);
    stroke = { brush, pts: [g], lastR: r, pointerType, pos: g, last: g, bbox: [RW, RH, -1, -1], changed: false,
      riversBefore: JSON.stringify({ rivers: W0().rivers || [], names: W0().riverNames || {} }), radius: r };
    if (LINE_BRUSHES[brush]) return;
    if (brush === "eraseRiver") { eraseRiversAt(g, r); return; }
    dab(brush, g[0] * RES, g[1] * RES, r * RES, strengthOf(brush));
    stroke.changed = true;
  };
  World.strokeMove = function (samples) {
    if (!stroke) return;
    const lag = clamp(+App.ui.worldStabilizer || 0, 0, 0.85);
    samples.forEach((s0) => {
      notePressure(s0.pressure, stroke.pointerType);
      const target = s0.final || !lag ? s0.g : [stroke.pos[0] + (s0.g[0] - stroke.pos[0]) * (1 - lag), stroke.pos[1] + (s0.g[1] - stroke.pos[1]) * (1 - lag)];
      stroke.pos = target;
      const r = brushRadius(s0.pressure, stroke.pointerType, s0.altitude);
      if (LINE_BRUSHES[stroke.brush]) {
        const last = stroke.pts[stroke.pts.length - 1];
        if (Math.hypot(target[0] - last[0], target[1] - last[1]) > 0.6) { stroke.pts.push(target); stroke.radius = Math.max(stroke.radius, r); }
        return;
      }
      if (stroke.brush === "eraseRiver") { eraseRiversAt(target, r); return; }
      const [lx, ly] = stroke.last;
      const dist = Math.hypot(target[0] - lx, target[1] - ly);
      const step = Math.max(0.35, Math.min(r, stroke.lastR) * 0.3);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const rr = stroke.lastR + (r - stroke.lastR) * t;
        dab(stroke.brush, (lx + (target[0] - lx) * t) * RES, (ly + (target[1] - ly) * t) * RES, rr * RES, strengthOf(stroke.brush));
      }
      stroke.last = target; stroke.lastR = r; stroke.changed = true;
    });
  };
  World.strokePreview = function () {
    return stroke && LINE_BRUSHES[stroke.brush] ? stroke.pts : null;
  };
  // abandon the stroke in progress (a second finger arrived: it was a gesture)
  World.strokeCancel = function () {
    const s = stroke;
    stroke = null;
    if (!s) return;
    if (s.bbox[2] >= 0) {
      const [x0, y0, x1, y1] = s.bbox;
      for (let y = y0; y <= y1; y++) {
        World.height.set(baseH.subarray(y * RW + x0, y * RW + x1 + 1), y * RW + x0);
        World.cover.set(baseC.subarray(y * RW + x0, y * RW + x1 + 1), y * RW + x0);
      }
      markDirty(x0, y0, x1, y1);
    }
    const rb = JSON.parse(s.riversBefore);
    App.project.world.rivers = rb.rivers;
    App.project.world.riverNames = rb.names;
    App.emit();
  };
  World.strokeEnd = function () {
    const s = stroke;
    stroke = null;
    if (!s) return;
    const w = W0();
    if (s.brush === "river") finishRiver(s);
    else if (s.brush === "ridge" || s.brush === "valley") finishLine(s);
    const riversAfter = JSON.stringify({ rivers: w.rivers || [], names: w.riverNames || {} });
    const riversChanged = riversAfter !== s.riversBefore;
    if (s.bbox[2] < 0) {
      if (riversChanged) {
        const put = (json) => { const v = JSON.parse(json); w.rivers = v.rivers; w.riverNames = v.names; World.requestHydro(100); window.scheduleSave(); };
        Actions.pushUndoEntry({ kind: "rivers", bytes: riversAfter.length * 2, undo: () => put(s.riversBefore), redo: () => put(riversAfter) });
        World.requestHydro(100);
        window.scheduleSave();
      }
      App.emit();
      return;
    }
    flush();
    const [x0, y0, x1, y1] = s.bbox;
    pushRasterUndo(x0, y0, x1, y1, baseH, baseC, riversChanged ? { riversBefore: s.riversBefore, riversAfter } : null);
    changed(x0, y0, x1, y1);
    App.emit();
  };

  function eraseRiversAt(g, r) {
    const rivers = W0().rivers || [];
    const hit = (rv) => rv.pts.some((p, i) => i < rv.pts.length - 1 && TA.distToSeg(g[0], g[1], p, rv.pts[i + 1]) <= r);
    if (!rivers.some(hit)) return;
    W0().rivers = rivers.filter((rv) => !hit(rv));
    App.emit();
  }

  function polylineLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return len;
  }

  // distance from raster cell centre to a polyline in data units, with the position
  // along it (0..1) — used by the line tools
  function lineField(pts, radiusData, fn) {
    const L = polylineLength(pts) || 1;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const bx0 = Math.min(...pts.map((p) => p[0])) - radiusData, by0 = Math.min(...pts.map((p) => p[1])) - radiusData;
    const bx1 = Math.max(...pts.map((p) => p[0])) + radiusData, by1 = Math.max(...pts.map((p) => p[1])) + radiusData;
    const x0 = clamp(Math.floor(bx0 * RES), 0, RW - 1), x1 = clamp(Math.ceil(bx1 * RES), 0, RW - 1);
    const y0 = clamp(Math.floor(by0 * RES), 0, RH - 1), y1 = clamp(Math.ceil(by1 * RES), 0, RH - 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) / RES, py = (y + 0.5) / RES;
        let best = Infinity, along = 0;
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1];
          const vx = b[0] - a[0], vy = b[1] - a[1];
          const l2 = vx * vx + vy * vy;
          let t = l2 ? ((px - a[0]) * vx + (py - a[1]) * vy) / l2 : 0;
          t = clamp(t, 0, 1);
          const d = Math.hypot(a[0] + vx * t - px, a[1] + vy * t - py);
          if (d < best) { best = d; along = (cum[k] + Math.sqrt(l2) * t) / L; }
        }
        if (best <= radiusData) fn(y * RW + x, best / radiusData, along, x, y);
      }
    }
    return [x0, y0, x1, y1];
  }

  function finishLine(s) {
    if (s.pts.length < 2 || polylineLength(s.pts) < 2) return;
    const pts = TA.rdp(TA.chaikin(s.pts, 2, false), 0.15);
    const sl = sea();
    const salt = ((W0().seed | 0) % 100000) + 41;
    const Hh = World.height;
    const radius = Math.max(2, s.radius);
    let bbox;
    if (s.brush === "ridge") {
      // a crest along the line: high in the middle, spurs and notches from noise
      bbox = lineField(pts, radius * 1.25, (i, dn, along, x, y) => {
        const wob = (vnoise(x / (radius * 0.9), y / (radius * 0.9), salt) - 0.5) * 0.5;
        const d = clamp(dn + wob * dn, 0, 1);
        if (d >= 1) return;
        const peak = 2600 + 3800 * Math.pow(ridged(along * 9, 0.5, salt + 1, 3), 1.4);
        const profile = Math.pow(1 - d, 1.7);
        const v = sl + peak * profile + 350 * (ridged(x / 5, y / 5, salt + 2, 3) - 0.5) * profile;
        if (v > Hh[i]) Hh[i] = clamp(Math.round(v), HMIN, HMAX);
      });
    } else {
      // a valley: pull the ground down toward a floor just above sea level
      bbox = lineField(pts, radius, (i, d) => {
        const floor = sl + 30;
        if (Hh[i] <= floor) return;
        const k = Math.pow(d, 1.3);
        Hh[i] = Math.round(floor + (Hh[i] - floor) * (0.15 + 0.85 * k));
      });
    }
    s.bbox = [Math.min(s.bbox[0], bbox[0]), Math.min(s.bbox[1], bbox[1]), Math.max(s.bbox[2], bbox[2]), Math.max(s.bbox[3], bbox[3])];
  }

  function finishRiver(s) {
    const pts0 = s.pts;
    if (pts0.length < 2 || polylineLength(pts0) < 3) return;
    const pts = TA.rdp(TA.chaikin(pts0, 2, false), 0.18).map((q) => [r2(q[0]), r2(q[1])]);
    const w = W0();
    const n = (w.rivers || []).length + 1;
    const name = t("world.riverDefault").replace("{n}", n);
    w.rivers = (w.rivers || []).concat([{ id: window.uid(), name, pts, width: 1 }]);
    // carve a bed that keeps falling from source to mouth, so the simulated flow follows it
    const Hh = World.height, sl = sea();
    const L = polylineLength(pts);
    const samples = Math.max(2, Math.ceil(L * RES * 2));
    const bed = new Float32Array(samples + 1);
    let cur = Infinity;
    const at = (tt) => {
      let acc = 0;
      for (let k = 1; k < pts.length; k++) {
        const seg = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        if (acc + seg >= tt * L) { const u = seg ? (tt * L - acc) / seg : 0; return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]; }
        acc += seg;
      }
      return pts[pts.length - 1];
    };
    for (let k = 0; k <= samples; k++) {
      const p = at(k / samples);
      const x = clamp(Math.floor(p[0] * RES), 0, RW - 1), y = clamp(Math.floor(p[1] * RES), 0, RH - 1);
      cur = Math.min(cur - 2, Hh[y * RW + x] - 6);
      bed[k] = cur;
    }
    const bbox = lineField(pts, 1.2, (i, d, along) => {
      const target = bed[Math.round(along * samples)];
      if (Hh[i] > target && Hh[i] > sl) Hh[i] = Math.max(Math.round(target + (Hh[i] - target) * d * 0.7), sl + 1);
    });
    s.bbox = [Math.min(s.bbox[0], bbox[0]), Math.min(s.bbox[1], bbox[1]), Math.max(s.bbox[2], bbox[2]), Math.max(s.bbox[3], bbox[3])];
    // with simulated rivers on, the stroke names the river that forms along it
    if (w.autoRivers) {
      const mid = pts[Math.floor(pts.length * 0.6)];
      w.riverNames = Object.assign({}, w.riverNames, { ["h" + Date.now().toString(36)]: { name, anchor: [r2(mid[0]), r2(mid[1])] } });
    }
  }

  // the brush that would paint what is under a data point (finger long-press)
  World.pickBrush = function (g) {
    if (!World.height) return null;
    const x = clamp(Math.floor(g[0] * RES), 0, RW - 1), y = clamp(Math.floor(g[1] * RES), 0, RH - 1);
    const i = y * RW + x;
    const hr = World.height[i] - sea();
    if (hr <= 0) return "sea";
    if (World.cover[i]) return COVER_BRUSHES[World.cover[i]] || "meadow";
    if (hr >= 3500) return "peaks";
    if (hr >= 1500) return "mountains";
    if (hr >= 500) return "hills";
    return "plains";
  };
  World.heightAt = function (g) {
    if (!World.height) return null;
    const x = clamp(Math.floor(g[0] * RES), 0, RW - 1), y = clamp(Math.floor(g[1] * RES), 0, RH - 1);
    return World.height[y * RW + x] - sea();
  };

  World.setWorld = function (patch, opts) {
    Actions.mut((p) => Object.assign(p.world, patch), Object.assign({ undo: false }, opts));
    World.sync();
  };

  // ---------------- whole-map operations ----------------
  function wholeMapChange(fn) {
    ensureBuffers();
    const hb = World.height.slice(), cb = World.cover.slice();
    const riversBefore = JSON.stringify({ rivers: W0().rivers || [], names: W0().riverNames || {} });
    fn();
    World.renderAll();
    const riversAfter = JSON.stringify({ rivers: W0().rivers || [], names: W0().riverNames || {} });
    pushRasterUndo(0, 0, RW - 1, RH - 1, hb, cb, riversAfter !== riversBefore ? { riversBefore, riversAfter } : null);
    World.rasterRev++;
    W0().rev = (W0().rev || 0) + 1;
    World.requestHydro(50);
    window.scheduleSave();
    App.emit();
  }

  World.randomContinent = function () {
    wholeMapChange(() => {
      const s = (Math.random() * 1e6) | 0;
      const Hh = World.height, C = World.cover;
      const sl = sea();
      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          const gx = x / RES, gy = y / RES;
          const nx = gx / GW - 0.5, ny = (gy / GH - 0.5) * (GH / GW);
          const fall = Math.sqrt(nx * nx * 1.3 + ny * ny * 4) * 1.9;
          const base = fbm(gx / 170, gy / 170, s, 5) + 0.18 * fbm(gx / 45, gy / 45, s + 7, 3) - fall * 0.55;
          const ridge = ridged(gx / 90, gy / 90, s + 3, 5);
          let hgt;
          if (base < 0.3) hgt = -150 - 3200 * smoothstep(0.3, -0.1, base);
          else {
            // ground rises steadily inland (no bowls that would all fill up as lakes)
            const inland = smoothstep(0.3, 0.6, base);
            hgt = 30 + 450 * inland + 120 * inland * fbm(gx / 40, gy / 40, s + 9, 2);
            if (ridge > 0.9) hgt += 1600 + 4200 * Math.pow((ridge - 0.9) / 0.1, 2) * (0.5 + inland);
            else if (ridge > 0.78) hgt += 1600 * smoothstep(0.78, 0.9, ridge) * (0.4 + inland);
          }
          Hh[y * RW + x] = clamp(Math.round(sl + hgt), HMIN, HMAX);
          C[y * RW + x] = 0;
        }
      }
    });
  };
  World.clearTerrain = function () {
    wholeMapChange(() => {
      World.height.fill(Math.round(sea() - 1500));
      World.cover.fill(0);
      W0().rivers = [];
      W0().riverNames = {};
    });
  };

  // ---------------- terrain worker ----------------
  let worker = null, workerReady = null, hydroTimer = null, hydroRev = 0;
  const pending = new Map(); // job rev -> resolve
  function scriptUrl(part) {
    const el = [...document.scripts].find((s) => s.src && s.src.indexOf(part) >= 0) ||
      [...document.querySelectorAll("link[href]")].find((l) => l.href.indexOf(part) >= 0);
    return el ? (el.src || el.href) : new URL("js/" + part, location.href).href;
  }
  function getWorker() {
    if (workerReady) return workerReady;
    workerReady = new Promise((resolve, reject) => {
      try {
        worker = new Worker(scriptUrl("terrain.worker.js"));
      } catch (e) { reject(e); return; }
      worker.onmessage = (ev) => {
        const m = ev.data;
        if (m.type === "ready") { resolve(worker); return; }
        if (m.type === "error") { console.warn("terrain worker:", m.message); const p = pending.get(m.job + ":" + m.rev); if (p) { pending.delete(m.job + ":" + m.rev); p.reject(new Error(m.message)); } return; }
        const p = pending.get(m.type + ":" + m.rev);
        if (p) { pending.delete(m.type + ":" + m.rev); p.resolve(m); }
      };
      worker.onerror = (e) => { console.warn("terrain worker failed", e); reject(e); };
      worker.postMessage({ type: "init", scripts: [scriptUrl("terrain-algos.js"), scriptUrl("topojson-server"), scriptUrl("topojson-client")] });
    });
    return workerReady;
  }
  function runJob(msg, transfer) {
    return getWorker().then((wk) => new Promise((resolve, reject) => {
      pending.set(msg.type + ":" + msg.rev, { resolve, reject });
      wk.postMessage(msg, transfer || []);
    }));
  }

  // data-grid heights (metres above sea level)
  World.dataHeights = function () {
    ensureBuffers();
    const sl = sea();
    const rel = new Float32Array(RW * RH);
    const Hh = World.height;
    for (let i = 0; i < rel.length; i++) rel[i] = Hh[i] - sl;
    return TA.downsample(rel, RW, RH, RES, GW, GH);
  };

  World.requestHydro = function (delay) {
    if (!World.active()) return;
    clearTimeout(hydroTimer);
    hydroTimer = setTimeout(() => { World.runHydro().catch((e) => console.warn(e)); }, delay == null ? 450 : delay);
  };
  World.runHydro = function () {
    if (!World.active()) return Promise.resolve(null);
    const project = App.project, w = project.world;
    const rev = ++hydroRev;
    const forRaster = World.rasterRev;
    const heights = World.dataHeights();
    const hgrid = heights.slice();
    // hand-drawn rivers are already carved into the terrain; nothing else to send
    return runJob({ type: "hydro", rev, W: GW, H: GH, heights: heights.buffer, climate: w.climate,
      riverThreshold: +w.riverThreshold || 60 }, [heights.buffer]).then((m) => {
      if (rev !== hydroRev || App.project !== project) return null; // superseded
      const prev = World.hydro;
      World.hydro = {
        rev, rasterRev: forRaster, hgrid,
        temp: new Float32Array(m.temp), prec: new Float32Array(m.prec), biome: new Uint8Array(m.biome),
        lake: new Uint8Array(m.lake), basin: new Int32Array(m.basin), down: new Int32Array(m.down), acc: new Float32Array(m.acc),
        rivers: m.rivers
      };
      riverGeomCache = null;
      repaintClimateChanges(prev, World.hydro);
      App.emit();
      return World.hydro;
    });
  };
  // repaint only the tiles whose biome, lake or snow picture changed
  function repaintClimateChanges(prev, next) {
    if (!prev) { World.renderAll(); return; }
    const T = 16; // data cells per tile
    for (let ty = 0; ty < GH; ty += T) {
      for (let tx = 0; tx < GW; tx += T) {
        let diff = false;
        for (let y = ty; y < Math.min(GH, ty + T) && !diff; y++) {
          for (let x = tx; x < Math.min(GW, tx + T); x++) {
            const i = y * GW + x;
            if (prev.biome[i] !== next.biome[i] || prev.lake[i] !== next.lake[i] || Math.abs(prev.temp[i] - next.temp[i]) > 1.5) { diff = true; break; }
          }
        }
        if (diff) paintRect(tx * RES, ty * RES, (tx + T) * RES - 1, (ty + T) * RES - 1);
      }
    }
    World.renderRev++;
  }

  // ---------------- rivers for display / cards ----------------
  let riverGeomCache = null;
  // [{ index, name, key, pts, widths, flux, order, … }] in data units
  World.displayRivers = function () {
    if (!World.active()) return [];
    const w = W0();
    if (!w.autoRivers) {
      return (w.rivers || []).map((rv, index) => ({ index, hand: true, id: rv.id, name: rv.name, pts: rv.pts,
        widths: rv.pts.map((_, k) => 0.2 + 0.8 * Math.pow(k / Math.max(1, rv.pts.length - 1), 0.8)) }));
    }
    const hy = World.hydro;
    if (!hy) return [];
    if (riverGeomCache && riverGeomCache.rev === hy.rev && riverGeomCache.names === w.riverNames) return riverGeomCache.list;
    const thr = +w.riverThreshold || 60;
    const list = hy.rivers.map((r, index) => {
      let pts = r.cells.map((c) => [c % GW + 0.5, ((c / GW) | 0) + 0.5]);
      if (r.mouth >= 0) pts.push([r.mouth % GW + 0.5, ((r.mouth / GW) | 0) + 0.5]);
      const flux = r.cells.map((c) => hy.acc[c]);
      if (r.mouth >= 0) flux.push(flux[flux.length - 1]);
      // smooth with a gentle meander
      const sm = TA.chaikin(pts, 2, false);
      const fl = sm.map((_, k) => flux[Math.min(flux.length - 1, Math.round(k / Math.max(1, sm.length - 1) * (flux.length - 1)))]);
      const widths = fl.map((f) => clamp(0.12 + 0.2 * Math.sqrt(f / thr), 0.12, 2.4));
      return { index, pts: sm, widths, flux: r.flux, order: r.order, cells: r.cells, mouthType: r.mouthType, into: r.into, sourceType: r.sourceType, mouth: r.mouth };
    });
    // names: each named anchor labels the biggest river passing near it
    Object.entries(w.riverNames || {}).forEach(([key, nm]) => {
      if (!nm || !nm.anchor) return;
      const ax = nm.anchor[0], ay = nm.anchor[1];
      let best = null, bf = -1;
      list.forEach((rv) => {
        for (const c of rv.cells) {
          const x = c % GW + 0.5, y = ((c / GW) | 0) + 0.5;
          if (Math.abs(x - ax) <= 4 && Math.abs(y - ay) <= 4) { if (rv.flux > bf) { bf = rv.flux; best = rv; } break; }
        }
      });
      if (best && !best.name) { best.name = nm.name; best.key = key; best.notes = nm.notes || ""; }
    });
    riverGeomCache = { rev: hy.rev, names: w.riverNames, list };
    return list;
  };

  // nearest displayed river to a data point, within tol data units
  World.riverAt = function (g, tol) {
    let best = null, bd = tol;
    World.displayRivers().forEach((rv) => {
      const pts = rv.pts;
      for (let k = 0; k < pts.length - 1; k++) {
        const d = TA.distToSeg(g[0], g[1], pts[k], pts[k + 1]);
        if (d < bd || (best && d <= bd + 0.01 && (rv.flux || 0) > (best.flux || 0))) { bd = d; best = rv; }
      }
    });
    return best;
  };

  // tapered ribbon polygon in map coordinates
  World.riverPath = function (rv, proj) {
    const pts = rv.pts;
    if (!pts || pts.length < 2 || !proj) return "";
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const hw = (rv.widths ? rv.widths[i] : 0.6) * 0.5;
      left.push(proj([pts[i][0] - ty * hw, pts[i][1] + tx * hw]));
      right.push(proj([pts[i][0] + ty * hw, pts[i][1] - tx * hw]));
    }
    const ring = left.concat(right.reverse());
    return "M" + ring.map((q) => q[0].toFixed(2) + "," + q[1].toFixed(2)).join("L") + "Z";
  };

  // name a simulated river (anchored near its middle so the name survives edits)
  World.nameRiver = function (rv, name, notes) {
    const w = W0();
    const names = Object.assign({}, w.riverNames || {});
    if (rv.key && names[rv.key]) {
      names[rv.key] = Object.assign({}, names[rv.key], { name: name != null ? name : names[rv.key].name, notes: notes != null ? notes : names[rv.key].notes });
    } else {
      const c = rv.cells[Math.floor(rv.cells.length * 0.6)];
      names["r" + Date.now().toString(36)] = { name: name || "", notes: notes || "", anchor: [c % GW + 0.5, ((c / GW) | 0) + 0.5] };
    }
    Actions.mut((p) => { p.world.riverNames = names; }, {});
  };
  World.renameRiver = function (id, name) {
    Actions.mut((p) => { const rv = (p.world.rivers || []).find((r) => r.id === id); if (rv) rv.name = name; }, { undo: false });
  };
  World.deleteRiver = function (id) {
    Actions.mut((p) => { p.world.rivers = (p.world.rivers || []).filter((r) => r.id !== id); });
    World.requestHydro(100);
  };

  // ---------------- canvas placement ----------------
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

  // ---------------- data grid for analysis (atlas, province properties) ----------------
  let dgCache = null;
  World.dataGrid = function () {
    const hy = World.hydro;
    const key = World.rasterRev + ":" + (hy ? hy.rev : 0) + ":" + sea();
    if (dgCache && dgCache.key === key) return dgCache;
    const h = hy && hy.rasterRev === World.rasterRev ? hy.hgrid : World.dataHeights();
    const N = GW * GH;
    const band = new Uint8Array(N), coverClass = new Uint8Array(N);
    const C = World.cover;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        band[i] = TA.bandOf(h[i]);
        // painted cover wins (most common in the block), else the biome's class
        const counts = [0, 0, 0, 0, 0, 0, 0];
        for (let dy = 0; dy < RES; dy++) for (let dx = 0; dx < RES; dx++) counts[C[(y * RES + dy) * RW + x * RES + dx]]++;
        let best = 0;
        for (let k = 1; k < 7; k++) if (counts[k] > counts[best]) best = k;
        if (best > 0 && counts[best] >= 2) coverClass[i] = best - 1;
        else {
          const bio = hy ? hy.biome[i] : 0;
          const cls = TA.BIOME_COVER[bio];
          coverClass[i] = cls ? COVER_CLASSES.indexOf(cls) : 0;
        }
      }
    }
    dgCache = { key, h, band, coverClass, lake: hy ? hy.lake : new Uint8Array(N), biome: hy ? hy.biome : null, temp: hy ? hy.temp : null, prec: hy ? hy.prec : null };
    return dgCache;
  };
  World.sea = sea;
  World.riverCellsOf = function (rv) {
    // cells of a display river on the data grid (hand rivers are sampled)
    if (rv.cells) return rv.cells;
    const out = [];
    for (let k = 0; k < rv.pts.length - 1; k++) {
      const a = rv.pts[k], b = rv.pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let s = 0; s < n; s++) {
        const x = clamp(Math.floor(a[0] + (b[0] - a[0]) * s / n), 0, GW - 1), y = clamp(Math.floor(a[1] + (b[1] - a[1]) * s / n), 0, GH - 1);
        const c = y * GW + x;
        if (out[out.length - 1] !== c) out.push(c);
      }
    }
    return out;
  };

  // ---------------- province generation (smart, in the worker) ----------------
  World.generating = false;
  World.generate = async function () {
    if (!World.active() || World.generating) return;
    World.generating = true;
    App.emit();
    try {
      const project = App.project, w = project.world;
      let hy = World.hydro;
      if (!hy || hy.rasterRev !== World.rasterRev) hy = await World.runHydro();
      if (!hy || App.project !== project) return;
      const dg = World.dataGrid();
      let anyLand = false;
      for (let i = 0; i < dg.h.length; i++) if (dg.h[i] > 0) { anyLand = true; break; }
      if (!anyLand) { Actions.toast(t("world.noLand")); return; }
      const opts = Object.assign({}, w.provinceOpts);
      const riverMask = new Uint8Array(GW * GH);
      if (opts.riversAsBorders) {
        World.displayRivers().forEach((rv) => { if (rv.hand || rv.order >= 3) World.riverCellsOf(rv).forEach((c) => { riverMask[c] = 1; }); });
      }
      const seeds = opts.citySeeds && window.Objects ? Objects.citySeeds(project) : [];
      const S = clamp(+w.cellSize || 18, 5, 60);
      const heights = dg.h.slice();
      const basin = hy.basin.slice();
      const m = await runJob({ type: "provinces", rev: ++hydroRev, W: GW, H: GH, heights: heights.buffer, basin: basin.buffer,
        riverMask: riverMask.buffer, target: S * S, seed: w.seed, seeds, opts }, [heights.buffer, basin.buffer, riverMask.buffer]);
      if (App.project !== project) return;
      applyGenerated(project, m);
    } catch (e) {
      console.error("province generation failed", e);
      Actions.toast(t("world.generateFailed"));
    } finally {
      World.generating = false;
      App.emit();
    }
  };

  function applyGenerated(project, m) {
    const features = m.geometries.map((g) => ({ type: "Feature", geometry: g, properties: {} }))
      .filter((f) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length);
    // number provinces in reading order (north-west first)
    const S = clamp(+project.world.cellSize || 18, 5, 60);
    features.forEach((f) => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      let best = polys[0], ba = -1;
      polys.forEach((poly) => { const a = Math.abs(d3.polygonArea(poly[0])); if (a > ba) { ba = a; best = poly; } });
      f._c = d3.polygonCentroid(best[0]);
    });
    features.sort((a, b) => (Math.floor(a._c[1] / (S * 1.5)) - Math.floor(b._c[1] / (S * 1.5))) || (a._c[0] - b._c[0]));
    const prefix = t("world.provinceDefault");
    features.forEach((f, i) => {
      const id = "p" + (i + 1);
      f.id = id;
      delete f._c;
      f.properties = { id, name: prefix.replace("{n}", i + 1) };
    });
    const an = window.Atlas.analyze(features, World.displayRivers());
    features.forEach((f, i) => {
      const c = an.cells[i];
      f.properties.terrain = window.Atlas.cellTerrain(c);
      f.properties.coastal = [...c.waters.keys()].some((wc) => an.waters[wc].kind === "ocean");
    });
    window.Atlas.remapPolitics(project, features, an.cellOf);
    project.customGeo = { type: "FeatureCollection", features };
    project.world.genRev = project.world.rev || 0;
    App.undoStack.length = 0;
    App.redoStack.length = 0;
    App.ui.selection = [];
    App.terrVersion++;
    window.scheduleSave();
    Actions.toast(t("world.generated").replace("{n}", features.length));
    window.Geo.load(project);
  }
})();
