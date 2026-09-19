// AtlasForge — custom world: paint terrain with a stylus, make it geographically plausible
// on request, cut the land into provinces that respect ridges, export a text atlas for AI.
//
// What is painted is what the map shows: nothing is simulated behind the painter's back.
// Model (project.world, version 2):
//   height — Int16 metres above datum on a RW×RH raster (RES cells per data unit);
//            water (seas and lakes) is where height ≤ seaLevel
//   cover  — Uint8 painted land cover per raster cell (COVER), 0 = nothing painted
//   rivers — rivers as polylines in data units, source → mouth; the eraser removes any
//            of them. `auto: true` marks rivers the geography pass added.
// "Поправить географию" (World.runGeography → TA.geography in the worker) returns edited
// copies of all three; they are previewed on a second canvas and committed as one undo
// step (World.applyGeography) — or thrown away.
// The rasters live in memory (World.height / World.cover); they are copied into
// project.world.rasters only when the project is saved (World.pack) and never enter
// the JSON undo slice — raster edits have their own diff entries in the undo stack.
// Analysis (basins for provinces, climate for the atlas) runs on demand on the data
// grid GW×GH (1000 × 510, one cell per data unit) in js/terrain.worker.js.
(function () {
  const App = window.App;
  const Actions = window.Actions;
  const TA = window.TerrainAlgos;

  const GW = 1000, GH = 510;          // analysis grid = world basemap data units
  const RES = 2;                      // painted raster cells per data unit
  const RW = GW * RES, RH = GH * RES;
  const HMIN = -8000, HMAX = 9000;

  // painted cover values (0 = nothing painted); indices match TA.COVER_OF_BIOME
  const COVER = ["none", "plains", "forest", "desert", "marsh", "tundra", "jungle", "taiga", "savanna", "glacier"];
  const COVER_CLASSES = COVER.slice(1); // analysis classes (unpainted land counts as plains)

  const RELIEF_BRUSHES = ["land", "sea", "plains", "hills", "mountains", "peaks", "ridge", "valley", "raise", "lower", "smooth"];
  // index in this list = the cover value the brush paints ("autoCover" erases the cover)
  const COVER_BRUSHES = ["autoCover", "meadow", "forest", "desert", "marsh", "tundra", "jungle", "taiga", "savanna", "glacier"];
  const WATER_BRUSHES = ["river", "eraseRiver"];
  const BRUSHES = RELIEF_BRUSHES.concat(COVER_BRUSHES, WATER_BRUSHES);
  const COVER_OF_BRUSH = {};
  COVER_BRUSHES.forEach((b, i) => { COVER_OF_BRUSH[b] = i; });
  const LINE_BRUSHES = { ridge: 1, valley: 1, river: 1 };
  const BRUSH_SWATCH = {
    land: "#b9c282", sea: "#4a7aa8", plains: "#c9cf95", hills: "#b09a6c", mountains: "#8c7e70", peaks: "#eef1f3",
    ridge: "#7a6b5c", valley: "#9dbb86", raise: "#c2a878", lower: "#7d9fb8", smooth: "#9aa3ad",
    autoCover: "#c4c795", meadow: "#b9c47f", forest: "#5f9150", desert: "#e2cc8e", marsh: "#849c76", tundra: "#cdd4c8", jungle: "#3f7f4a",
    taiga: "#4f7a5a", savanna: "#cdbd78", glacier: "#e9f0f5",
    river: "#3f77b3", eraseRiver: "#c65a5a"
  };
  // the options of the geography pass and their defaults
  const GEO_DEFAULTS = { fixRivers: true, addRivers: true, density: 0.5, lakes: true, biomes: true, foothills: true, erosion: false };

  const World = (window.World = {
    GW, GH, RES, RW, RH, COVER, COVER_CLASSES, BRUSHES, RELIEF_BRUSHES, COVER_BRUSHES, WATER_BRUSHES, BRUSH_SWATCH,
    height: null, cover: null, canvas: null, ctx: null,
    hydro: null,          // latest analysis from the worker (basins, climate) — never drawn
    rasterRev: 0,         // bumps on every raster change
    preview: null,        // pending geography pass: { height, cover, rivers, report, opts }
    compare: false,       // while previewing: show the map as it was
    geoBusy: false,
    previewCanvas: null,
    penSeen: false, renderRev: 0
  });

  World.newWorldData = function () {
    return {
      version: 2, rivers: [], riverNames: {}, scaleKm: 5, cellSize: 18,
      seed: (Math.random() * 1e9) | 0, rev: 0, genRev: null,
      seaLevel: 0, snowline: 4200,
      climate: { latTop: 70, latBottom: -10, tEquator: 27, tPole: -28 },
      geoOpts: Object.assign({}, GEO_DEFAULTS),
      provinceOpts: { mountains: "sides", riversAsBorders: false, citySeeds: true, joinIslets: false },
      rasters: null
    };
  };
  World.GEO_DEFAULTS = GEO_DEFAULTS;

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
    // worlds from the version that simulated rivers, lakes and biomes on every stroke:
    // those now appear only through the geography pass (the palette explains it once)
    if ("autoRivers" in w) w.legacyAuto = true;
    delete w.autoRivers;
    delete w.riverThreshold;
    const d = World.newWorldData();
    for (const k in d) if (w[k] === undefined && k !== "rasters") w[k] = d[k];
    w.climate = Object.assign({}, d.climate, w.climate || {});
    w.provinceOpts = Object.assign({}, d.provinceOpts, w.provinceOpts || {});
    w.geoOpts = Object.assign({}, GEO_DEFAULTS, w.geoOpts || {});
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
  const keyOf = (w) => JSON.stringify([w.seaLevel, w.snowline]); // settings the picture depends on
  // bring the in-memory rasters in line with the open project (open, import, undo)
  World.sync = function (force) {
    if (!World.active()) return false;
    const p = App.project, w = p.world;
    ensureBuffers();
    if (force || loadedFor !== p) {
      loadedFor = p;
      World.preview = null;
      World.compare = false;
      World.cutPreview = null;
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
      return true;
    }
    const k = keyOf(w);
    if (k !== settingsKey) {
      settingsKey = k;
      World.renderAll();
      if (World.preview) renderPreview();
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
    if (App.project && App.project.world) App.project.world.rev = (App.project.world.rev || 0) + 1;
    window.scheduleSave();
  }

  // ---------------- river list undo ----------------
  const riversJSON = (w) => JSON.stringify({ rivers: w.rivers || [], names: w.riverNames || {} });
  // one undo step for a change of the river list; a JSON-slice undo in between may have
  // replaced project.world, so the entry writes into whatever world the project has then
  function pushRiversUndo(before, after) {
    const project = App.project;
    const put = (json) => {
      if (App.project !== project || !project.world) return;
      const v = JSON.parse(json);
      project.world.rivers = v.rivers;
      project.world.riverNames = v.names;
      window.scheduleSave();
    };
    Actions.pushUndoEntry({ kind: "rivers", bytes: after.length * 2, undo: () => put(before), redo: () => put(after) });
  }
  // replace the river list (always a new array, so caches keyed by it notice) as one step
  function commitRivers(next) {
    const w = W0();
    const before = riversJSON(w);
    w.rivers = next;
    const after = riversJSON(w);
    if (after === before) return false;
    pushRiversUndo(before, after);
    window.scheduleSave();
    App.emit();
    return true;
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
  // purely a picture of the rasters: unpainted land takes a neutral tone, snow lies above
  // the snow line, lakes are water like the sea
  const COVER_COLOR = [hex("#c4c795"), "#b9c47f", "#638f53", "#e0c98c", "#809a76", "#c6cdc0", "#43824c", "#58805f", "#cbbd7a", "#e8eef2"]
    .map((c) => (typeof c === "string" ? hex(c) : c));
  const ROCK = hex("#8f8173"), SNOW = hex("#f3f6f8"), SHALLOW = hex("#90c1da"), MID = hex("#5d9bc5"), DEEP = hex("#35699a");
  const GLACIER = 9;

  // colour of a land cell before the coast rim and the grain: cover, bare rock with
  // altitude, snow above the snow line, Horn hillshade with light from the north-west.
  // Water next to the shore counts as level ground, so a lake high in the hills throws
  // no cliff shadow.
  function landRGB(i, x, y, Hh, C, sl, snowline, zf, out) {
    const hr = Hh[i] - sl;
    const cv = C[i];
    const base = COVER_COLOR[cv] || COVER_COLOR[0];
    let r = base[0], g = base[1], b = base[2];
    // bare rock with altitude (not under a glacier)
    const rt = cv === GLACIER ? 0 : smoothstep(1100, 3400, hr) * 0.78;
    r += (ROCK[0] - r) * rt; g += (ROCK[1] - g) * rt; b += (ROCK[2] - b) * rt;
    const snow = smoothstep(snowline - 400, snowline + 900, hr + (vnoise(x / 3, y / 3, 11) - 0.5) * 600);
    if (snow > 0) { r += (SNOW[0] - r) * snow; g += (SNOW[1] - g) * snow; b += (SNOW[2] - b) * snow; }
    const ym = y > 0 ? y - 1 : y, yp = y < RH - 1 ? y + 1 : y;
    const xm = x > 0 ? x - 1 : x, xp = x < RW - 1 ? x + 1 : x;
    const hc = Hh[i];
    const at = (j) => (Hh[j] <= sl ? hc : Hh[j]);
    const a1 = at(ym * RW + xm), a2 = at(ym * RW + x), a3 = at(ym * RW + xp);
    const a4 = at(y * RW + xm), a6 = at(y * RW + xp);
    const a7 = at(yp * RW + xm), a8 = at(yp * RW + x), a9 = at(yp * RW + xp);
    const dzdx = ((a3 + 2 * a6 + a9) - (a1 + 2 * a4 + a7)) / 8 * zf;
    const dzdy = ((a7 + 2 * a8 + a9) - (a1 + 2 * a2 + a3)) / 8 * zf;
    const len = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
    // light vector (-1, -1, 1.4) normalised
    const lambert = (dzdx * 0.5 + dzdy * 0.5 + 0.7) / len;
    const shade = clamp(0.35 + lambert * 0.95, 0.45, 1.3);
    out[0] = r * shade; out[1] = g * shade; out[2] = b * shade;
  }
  // colour of water d metres deep
  function waterRGB(d, out) {
    const t1 = smoothstep(0, 350, d), t2 = smoothstep(350, 3500, d);
    out[0] = SHALLOW[0] + (MID[0] - SHALLOW[0]) * t1 + (DEEP[0] - MID[0]) * t2;
    out[1] = SHALLOW[1] + (MID[1] - SHALLOW[1]) * t1 + (DEEP[1] - MID[1]) * t2;
    out[2] = SHALLOW[2] + (MID[2] - SHALLOW[2]) * t1 + (DEEP[2] - MID[2]) * t2;
  }
  const grainOf = (cv) => (cv === 2 || cv === 6 || cv === 7 ? 18 : 9); // forests look rougher

  // paint a raster rectangle of heights Hh / cover C into ctx (the terrain canvas or the preview)
  function paintRect(x0, y0, x1, y1, Hh, C, ctx) {
    ensureBuffers();
    Hh = Hh || World.height; C = C || World.cover; ctx = ctx || World.ctx;
    x0 = clamp(x0, 0, RW - 1); y0 = clamp(y0, 0, RH - 1); x1 = clamp(x1, 0, RW - 1); y1 = clamp(y1, 0, RH - 1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const sl = sea();
    const snowline = +W0().snowline || 4200;
    const cellM = ((+W0().scaleKm || 5) * 1000) / RES;
    const zf = 5.5 / cellM; // exaggerated relief
    const col = [0, 0, 0];
    let o = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * RW + x;
        const hr = Hh[i] - sl;
        const grain = (hash2(x, y, 7) - 0.5);
        let r, g, b;
        if (hr <= 0) {
          waterRGB(-hr, col);
          const k = grain * 4;
          r = col[0] + k; g = col[1] + k; b = col[2] + k;
        } else {
          landRGB(i, x, y, Hh, C, sl, snowline, zf, col);
          r = col[0]; g = col[1]; b = col[2];
          // thin dark rim along coasts
          if ((x > 0 && Hh[i - 1] <= sl) || (x < RW - 1 && Hh[i + 1] <= sl) || (y > 0 && Hh[i - RW] <= sl) || (y < RH - 1 && Hh[i + RW] <= sl)) {
            r = r * 0.72 + 20; g = g * 0.72 + 22; b = b * 0.72 + 20;
          }
          const k = grain * grainOf(C[i]);
          r += k; g += k; b += k;
        }
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  // ---------------- terrain at any size (image export) ----------------
  // Every raster cell's colour is worked out once, as the screen shows it but without the
  // pixel-wide coast rim; each output pixel then blends its four nearest cells. Land and
  // water blend apart and the interpolated height decides which of them a pixel shows, so
  // the coast stays one sharp line at any size, with a thin dark rim drawn along it.
  let hiRes = null;
  function hiResColors() {
    ensureBuffers();
    const w = W0();
    const key = World.renderRev + ":" + keyOf(w) + ":" + (+w.scaleKm || 5);
    if (hiRes && hiRes.key === key) return hiRes;
    const Hh = World.height, C = World.cover, sl = sea();
    const snowline = +w.snowline || 4200;
    const zf = 5.5 / (((+w.scaleKm || 5) * 1000) / RES);
    const N = RW * RH;
    const land = new Uint8ClampedArray(N * 3), water = new Uint8ClampedArray(N * 3), isLand = new Uint8Array(N);
    const col = [0, 0, 0];
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const i = y * RW + x, o = i * 3;
        const grain = hash2(x, y, 7) - 0.5;
        if (Hh[i] > sl) {
          isLand[i] = 1;
          landRGB(i, x, y, Hh, C, sl, snowline, zf, col);
          const k = grain * grainOf(C[i]);
          land[o] = col[0] + k; land[o + 1] = col[1] + k; land[o + 2] = col[2] + k;
          waterRGB(0, col);
        } else {
          waterRGB(sl - Hh[i], col);
          const k = grain * 4;
          col[0] += k; col[1] += k; col[2] += k;
        }
        water[o] = col[0]; water[o + 1] = col[1]; water[o + 2] = col[2];
      }
    }
    // water cells next to land take their neighbours' land colour, so a pixel just on the
    // land side of the coast blends real land colours only
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const i = y * RW + x;
        if (isLand[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= RH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= RW || !isLand[yy * RW + xx]) continue;
            const j = (yy * RW + xx) * 3;
            r += land[j]; g += land[j + 1]; b += land[j + 2]; n++;
          }
        }
        const o = i * 3;
        if (n) { land[o] = r / n; land[o + 1] = g / n; land[o + 2] = b / n; }
        else { land[o] = COVER_COLOR[0][0]; land[o + 1] = COVER_COLOR[0][1]; land[o + 2] = COVER_COLOR[0][2]; }
      }
    }
    hiRes = { key, land, water };
    return hiRes;
  }
  World.releaseHiRes = function () { hiRes = null; };

  // Draw into ctx at (0, 0) a dw × dh picture of the map-unit rectangle starting at
  // (mapX0, mapY0), ppm pixels per map unit. Outside the painted world: seaRGB.
  World.renderTerrain = function (ctx, dw, dh, mapX0, mapY0, ppm, seaRGB) {
    if (!World.active() || !App.basemap || !App.basemap.proj) return;
    const hr = hiResColors();
    const L = hr.land, Wt = hr.water;
    const Hh = World.height, sl = sea();
    const proj = App.basemap.proj;
    const p0 = proj([0, 0]), p1 = proj([GW, GH]);
    const kx = RW / (p1[0] - p0[0]), ky = RH / (p1[1] - p0[1]); // raster cells per map unit
    const cellPx = ppm / kx;                                      // output pixels per raster cell
    const rimPx = Math.max(1, Math.min(2.2, cellPx * 0.35));       // the dark coast line
    const sr = seaRGB ? seaRGB[0] : 0, sg = seaRGB ? seaRGB[1] : 0, sb = seaRGB ? seaRGB[2] : 0;
    const img = ctx.createImageData(dw, dh);
    const d = img.data;
    for (let py = 0; py < dh; py++) {
      const ry = (mapY0 + (py + 0.5) / ppm - p0[1]) * ky - 0.5;
      const outY = ry < -0.5 || ry > RH - 0.5;
      const y0 = Math.floor(ry), fy = ry - y0;
      const ya = clamp(y0, 0, RH - 1) * RW, yb = clamp(y0 + 1, 0, RH - 1) * RW;
      let o = py * dw * 4;
      for (let px = 0; px < dw; px++, o += 4) {
        const rx = (mapX0 + (px + 0.5) / ppm - p0[0]) * kx - 0.5;
        if (outY || rx < -0.5 || rx > RW - 0.5) { d[o] = sr; d[o + 1] = sg; d[o + 2] = sb; d[o + 3] = 255; continue; }
        const x0 = Math.floor(rx), fx = rx - x0;
        const xa = clamp(x0, 0, RW - 1), xb = clamp(x0 + 1, 0, RW - 1);
        const i00 = ya + xa, i10 = ya + xb, i01 = yb + xa, i11 = yb + xb;
        const h00 = Hh[i00] - sl, h10 = Hh[i10] - sl, h01 = Hh[i01] - sl, h11 = Hh[i11] - sl;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const j00 = i00 * 3, j10 = i10 * 3, j01 = i01 * 3, j11 = i11 * 3;
        const allLand = h00 > 0 && h10 > 0 && h01 > 0 && h11 > 0;
        const allWater = h00 <= 0 && h10 <= 0 && h01 <= 0 && h11 <= 0;
        if (allWater) {
          d[o] = Wt[j00] * w00 + Wt[j10] * w10 + Wt[j01] * w01 + Wt[j11] * w11;
          d[o + 1] = Wt[j00 + 1] * w00 + Wt[j10 + 1] * w10 + Wt[j01 + 1] * w01 + Wt[j11 + 1] * w11;
          d[o + 2] = Wt[j00 + 2] * w00 + Wt[j10 + 2] * w10 + Wt[j01 + 2] * w01 + Wt[j11 + 2] * w11;
          d[o + 3] = 255;
          continue;
        }
        let r = L[j00] * w00 + L[j10] * w10 + L[j01] * w01 + L[j11] * w11;
        let g = L[j00 + 1] * w00 + L[j10 + 1] * w10 + L[j01 + 1] * w01 + L[j11 + 1] * w11;
        let b = L[j00 + 2] * w00 + L[j10 + 2] * w10 + L[j01 + 2] * w01 + L[j11 + 2] * w11;
        if (!allLand) {
          // the coast crosses this cell: signed distance to it in output pixels from the
          // bilinear height and its slope
          const h = h00 * w00 + h10 * w10 + h01 * w01 + h11 * w11;
          const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy, gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
          const dist = h / (Math.sqrt(gx * gx + gy * gy) || 1e-6) * cellPx;
          if (dist > 0) {
            const rim = clamp(1 - dist / rimPx, 0, 1);
            r = r * (1 - 0.28 * rim) + 20 * rim; g = g * (1 - 0.28 * rim) + 22 * rim; b = b * (1 - 0.28 * rim) + 20 * rim;
          }
          const cover = clamp(0.5 + dist, 0, 1); // antialiased shore
          if (cover < 1) {
            const wr = Wt[j00] * w00 + Wt[j10] * w10 + Wt[j01] * w01 + Wt[j11] * w11;
            const wg = Wt[j00 + 1] * w00 + Wt[j10 + 1] * w10 + Wt[j01 + 1] * w01 + Wt[j11 + 1] * w11;
            const wb = Wt[j00 + 2] * w00 + Wt[j10 + 2] * w10 + Wt[j01 + 2] * w01 + Wt[j11 + 2] * w11;
            r = wr + (r - wr) * cover; g = wg + (g - wg) * cover; b = wb + (b - wb) * cover;
          }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

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
    if (World.preview || World.geoBusy) { Actions.toast(t("world.geo.busyPaint")); return; }
    if (World.cutPreview) { Actions.toast(t("world.cut.busyPaint")); return; }
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
        pushRiversUndo(s.riversBefore, riversAfter);
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

  // is there water (sea or lake) within rad data units of a data point?
  function waterNear(p, rad) {
    const Hh = World.height, sl = sea();
    if (!Hh) return false;
    const r = Math.ceil(rad * RES), cx = Math.floor(p[0] * RES), cy = Math.floor(p[1] * RES);
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= RH) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= RW || dx * dx + dy * dy > r * r) continue;
        if (Hh[y * RW + x] <= sl) return true;
      }
    }
    return false;
  }
  function nearestRiverPoint(rivers, p, tol) {
    let best = null;
    rivers.forEach((rv) => {
      const hit = TA.nearestOnPolyline(rv.pts, p, best ? best.d : tol);
      if (hit && (!best || hit.d < best.d)) best = hit;
    });
    return best;
  }

  // A drawn river is just a line: nothing is carved. It is read the way it was meant —
  // a stroke that starts at the sea or on another river and ends inland was drawn from
  // the mouth, so it is turned round; a mouth on another river joins it exactly.
  function finishRiver(s) {
    const pts0 = s.pts;
    if (pts0.length < 2 || polylineLength(pts0) < 3) return;
    let pts = TA.rdp(TA.chaikin(pts0, 2, false), 0.18).map((q) => [r2(q[0]), r2(q[1])]);
    const w = W0();
    const others = w.rivers || [];
    const startsOnWater = waterNear(pts[0], 1.2) || !!nearestRiverPoint(others, pts[0], 1.2);
    const endsOnWater = waterNear(pts[pts.length - 1], 1.2) || !!nearestRiverPoint(others, pts[pts.length - 1], 1.2);
    if (startsOnWater && !endsOnWater) pts.reverse();
    const join = nearestRiverPoint(others, pts[pts.length - 1], 1.2);
    if (join) pts[pts.length - 1] = [r2(join.point[0]), r2(join.point[1])];
    const n = others.filter((r) => r.name).length + 1;
    const name = t("world.riverDefault").replace("{n}", n);
    w.rivers = others.concat([{ id: window.uid(), name, pts, width: 1 }]);
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
  let worker = null, workerReady = null, hydroRev = 0, geoRev = 0;
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

  // Analysis of the terrain as it is (basins for smart provinces, climate for the atlas).
  // It runs on demand and is never drawn.
  const climateKey = () => JSON.stringify(W0().climate || {});
  World.hydroFresh = function () {
    const hy = World.hydro;
    return !!(hy && hy.rasterRev === World.rasterRev && hy.climateKey === climateKey() && hy.sea === sea());
  };
  World.ensureAnalysis = function () {
    return World.hydroFresh() ? Promise.resolve(World.hydro) : World.runHydro();
  };
  World.runHydro = function () {
    if (!World.active()) return Promise.resolve(null);
    const project = App.project, w = project.world;
    const rev = ++hydroRev;
    const forRaster = World.rasterRev, key = climateKey(), sl = sea();
    const heights = World.dataHeights();
    const hgrid = heights.slice();
    return runJob({ type: "hydro", rev, W: GW, H: GH, heights: heights.buffer, climate: w.climate, riverThreshold: 60 },
      [heights.buffer]).then((m) => {
      if (rev !== hydroRev || App.project !== project) return null; // superseded
      World.hydro = {
        rev, rasterRev: forRaster, climateKey: key, sea: sl, hgrid,
        temp: new Float32Array(m.temp), prec: new Float32Array(m.prec),
        basin: new Int32Array(m.basin), down: new Int32Array(m.down), acc: new Float32Array(m.acc)
      };
      App.emit();
      return World.hydro;
    });
  };

  // ---------------- rivers for display / cards ----------------
  // Every river is a drawn polyline (source → mouth). Their network — which river flows
  // into which, Strahler order, length with tributaries — follows from the drawing.
  // size class from the length of the network above the mouth (km):
  // 0 stream · 1 river · 2 large river · 3 great river
  const SIZE_KM = [80, 400, 1500];
  const sizeOfKm = (kmLen) => (kmLen < SIZE_KM[0] ? 0 : kmLen < SIZE_KM[1] ? 1 : kmLen < SIZE_KM[2] ? 2 : 3);
  const SIZE_WIDTH = [0.45, 0.85, 1.45, 2.2]; // mouth width (data units) of a size set by hand
  World.SIZE_KM = SIZE_KM;
  let netCache = null;
  function riverList(rivers) {
    const km = +W0().scaleKm || 5;
    if (netCache && netCache.rivers === rivers && netCache.rasterRev === World.rasterRev && netCache.sea === sea() && netCache.km === km) return netCache.list;
    const net = TA.riverNetwork(rivers.map((rv) => rv.pts), 1.3);
    const list = rivers.map((rv, index) => {
      const pts = rv.pts;
      const up = net.upLen[index];
      const src = pts[0], mouth = pts[pts.length - 1];
      const atEdge = mouth[0] <= 1 || mouth[1] <= 1 || mouth[0] >= GW - 1 || mouth[1] >= GH - 1;
      const mouthType = net.into[index] >= 0 ? "river" : waterNear(mouth, 1.2) ? "water" : atEdge ? "edge" : "land";
      // parameters: computed from the drawing unless set by hand in the river card
      const man = rv.manual || {};
      const orderAuto = net.order[index], sizeAuto = sizeOfKm(up * km);
      const order = man.order != null ? +man.order : orderAuto;
      const size = man.size != null ? +man.size : sizeAuto;
      const navigableAuto = order >= 4 || size >= 2;
      const navigable = man.navigable != null ? !!man.navigable : navigableAuto;
      // wider downstream, and wider still below each tributary
      const joins = net.kids[index].map((c) => [net.joinAt[c], net.upLen[c]]).sort((a, b) => a[0] - b[0]);
      const wMouth = man.size != null ? SIZE_WIDTH[size] : clamp(0.3 + 0.09 * Math.sqrt(up), 0.3, 2.4);
      let along = 0, j = 0, inflow = 0;
      const widths = pts.map((p, k) => {
        if (k) along += Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]);
        while (j < joins.length && joins[j][0] <= along) inflow += joins[j++][1];
        return 0.14 + (wMouth - 0.14) * Math.pow(clamp((along + inflow) / (up || 1), 0, 1), 0.7);
      });
      return {
        index, hand: true, id: rv.id, auto: !!rv.auto, pts, widths,
        into: net.into[index], len: net.len[index], upLen: up,
        order, orderAuto, size, sizeAuto, navigable, navigableAuto,
        major: size >= 2 || order >= 3, // borders between provinces, obstacles for roads
        mouthType, sourceType: waterNear(src, 1.2) ? "lake" : "spring"
      };
    });
    netCache = { rivers, rasterRev: World.rasterRev, sea: sea(), km, list };
    return list;
  }
  // [{ index, id, name, notes, pts, widths, into, order, upLen, major, … }] in data units
  World.displayRivers = function () {
    if (!World.active()) return [];
    World.sync(); // the network reads the terrain (river mouths at water): make sure it is loaded
    const w = W0();
    const rivers = World.preview && !World.compare ? World.preview.rivers : (w.rivers || []);
    return riverList(rivers).map((r) => Object.assign({}, r, { name: rivers[r.index].name, notes: rivers[r.index].notes || "" }));
  };

  // size class and navigability of a displayed river (set by hand or computed)
  World.riverSize = (rv, km) => (rv.size != null ? rv.size : sizeOfKm((rv.upLen || 0) * km));
  World.riverNavigable = (rv, km) => (rv.navigable != null ? rv.navigable : (rv.order || 0) >= 4 || World.riverSize(rv, km) >= 2);

  // nearest displayed river to a data point, within tol data units
  World.riverAt = function (g, tol) {
    let best = null, bd = tol;
    World.displayRivers().forEach((rv) => {
      const pts = rv.pts;
      for (let k = 0; k < pts.length - 1; k++) {
        const d = TA.distToSeg(g[0], g[1], pts[k], pts[k + 1]);
        if (d < bd || (best && d <= bd + 0.01 && rv.upLen > best.upLen)) { bd = d; best = rv; }
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

  World.renameRiver = function (id, name) {
    Actions.mut((p) => { const rv = (p.world.rivers || []).find((r) => r.id === id); if (rv) rv.name = name; }, { undo: false });
  };
  World.setRiverNotes = function (id, notes) {
    Actions.mut((p) => { const rv = (p.world.rivers || []).find((r) => r.id === id); if (rv) rv.notes = notes; }, { undo: false });
  };
  World.deleteRiver = function (id) {
    if (App.ui.card && App.ui.card.kind === "river") App.ui.card = null;
    commitRivers((W0().rivers || []).filter((r) => r.id !== id));
  };
  // manual parameters of a river: { order, size, navigable }; null/undefined = automatic
  World.setRiverManual = function (id, patch) {
    commitRivers((W0().rivers || []).map((r) => {
      if (r.id !== id) return r;
      const manual = Object.assign({}, r.manual || {});
      Object.keys(patch).forEach((k) => { if (patch[k] == null) delete manual[k]; else manual[k] = patch[k]; });
      const out = Object.assign({}, r);
      if (Object.keys(manual).length) out.manual = manual; else delete out.manual;
      return out;
    }));
  };
  // swap source and mouth
  World.reverseRiver = function (id) {
    if (commitRivers((W0().rivers || []).map((r) => (r.id === id ? Object.assign({}, r, { pts: r.pts.slice().reverse() }) : r)))) {
      Actions.toast(t("card.reversedToast"));
    }
  };

  // ---------------- moving a river's source or mouth ----------------
  // Drag an end handle: along the river it slides (shortening the river, or giving back
  // what was cut); pulled off the river it lays a new course behind the pen or finger.
  // A mouth released on another river joins it.
  let endEdit = null;
  World.endEditActive = () => !!endEdit;
  World.endEditStart = function (index, end, g, tol) {
    const rv = (W0().rivers || [])[index];
    if (!World.active() || World.preview || !rv || rv.pts.length < 2) return false;
    const base = (end === "source" ? rv.pts.slice().reverse() : rv.pts).map((q) => [q[0], q[1]]);
    const L = TA.polylineLength(base);
    endEdit = { id: rv.id, end, base, L, cut: L, drawn: [], mode: "slide", tol: Math.max(0.6, tol || 1) };
    return true;
  };
  World.endEditMove = function (g) {
    const s = endEdit;
    if (!s) return null;
    const hit = TA.nearestOnPolyline(s.base, g, s.tol);
    if (s.mode === "slide") {
      if (hit) s.cut = hit.along;
      else { s.mode = "draw"; s.drawn = [[g[0], g[1]]]; }
    } else {
      const cutPt = TA.cutPolyline(s.base, s.cut).pop();
      if (hit && TA.polylineLength([cutPt].concat(s.drawn)) < s.tol * 3) { s.mode = "slide"; s.drawn = []; s.cut = hit.along; }
      else {
        const last = s.drawn[s.drawn.length - 1];
        if (Math.hypot(g[0] - last[0], g[1] - last[1]) > 0.3) s.drawn.push([g[0], g[1]]);
      }
    }
    return World.endEditPreview();
  };
  // the course as it would be (source → mouth)
  World.endEditPreview = function () {
    const s = endEdit;
    if (!s) return null;
    let pts = TA.cutPolyline(s.base, s.cut);
    if (s.mode === "draw") pts = pts.concat(s.drawn);
    return s.end === "source" ? pts.reverse() : pts;
  };
  World.endEditCancel = function () { endEdit = null; };
  World.endEditEnd = function () {
    const s = endEdit;
    endEdit = null;
    if (!s || !World.active()) return false;
    let pts = TA.cutPolyline(s.base, s.cut);
    if (s.mode === "draw" && s.drawn.length) {
      const from = pts[pts.length - 1];
      pts = pts.concat(TA.rdp(TA.chaikin([from].concat(s.drawn), 2, false), 0.15).slice(1));
    } else if (s.L - s.cut < 0.05) {
      return false; // a tap on the handle: nothing changed
    }
    if (pts.length < 2 || TA.polylineLength(pts) < 2) { Actions.toast(t("card.tooShort")); App.emit(); return false; }
    const rivers = W0().rivers || [];
    if (s.end === "mouth") {
      const join = nearestRiverPoint(rivers.filter((r) => r.id !== s.id), pts[pts.length - 1], Math.max(1.2, s.tol));
      if (join) pts[pts.length - 1] = join.point;
    }
    pts = pts.map((q) => [r2(q[0]), r2(q[1])]);
    if (s.end === "source") pts.reverse();
    return commitRivers(rivers.map((r) => (r.id === s.id ? Object.assign({}, r, { pts }) : r)));
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
    const tf = `matrix(${(X1 - X0) / cv.width},0,0,${(Y1 - Y0) / cv.height},${X0},${Y0})`;
    cv.style.transform = tf;
    const pv = World.previewCanvas;
    if (pv) {
      if (pv.parentNode !== host) host.appendChild(pv);
      pv.style.transform = tf;
      pv.style.display = World.preview && !World.compare ? "block" : "none";
    }
    const wc = World.whyCanvas;
    if (wc) {
      if (wc.parentNode !== host) host.appendChild(wc);
      wc.style.transform = `matrix(${(X1 - X0) / wc.width},0,0,${(Y1 - Y0) / wc.height},${X0},${Y0})`;
      wc.style.display = World.cutPreview && World.cutWhy ? "block" : "none";
    }
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
  // landmasses as painted: found on the raster, so a strait narrower than a data cell
  // still parts two lands (TA.landTopology)
  let topoCache = null;
  World.landTopology = function () {
    ensureBuffers();
    const key = World.rasterRev + ":" + sea();
    if (!topoCache || topoCache.key !== key) topoCache = Object.assign({ key }, TA.landTopology(World.height, sea(), RW, RH, RES, GW, GH));
    return topoCache;
  };
  let dgCache = null;
  // what is on the map: heights, bands, painted cover classes (unpainted land = plains);
  // climate only when a fresh analysis exists. Lakes are water in the heights, so the
  // lake layer stays empty (kept for callers that treat lakes separately). landId: the
  // landmass of each cell (-1 water, see World.landTopology).
  World.dataGrid = function () {
    const fresh = World.hydroFresh();
    const hy = fresh ? World.hydro : null;
    const key = World.rasterRev + ":" + (hy ? hy.rev : 0) + ":" + sea();
    if (dgCache && dgCache.key === key) return dgCache;
    const h = hy ? hy.hgrid : World.dataHeights();
    const N = GW * GH;
    const band = new Uint8Array(N), coverClass = new Uint8Array(N);
    const C = World.cover;
    const counts = new Int32Array(COVER.length);
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        band[i] = TA.bandOf(h[i]);
        counts.fill(0);
        for (let dy = 0; dy < RES; dy++) for (let dx = 0; dx < RES; dx++) counts[C[(y * RES + dy) * RW + x * RES + dx]]++;
        let best = 0;
        for (let k = 1; k < COVER.length; k++) if (counts[k] > counts[best]) best = k;
        coverClass[i] = best > 0 && counts[best] >= 2 ? best - 1 : 0;
      }
    }
    const topo = World.landTopology();
    dgCache = { key, h, band, coverClass, lake: new Uint8Array(N), temp: hy ? hy.temp : null, prec: hy ? hy.prec : null,
      landId: topo.landId, landArea: topo.area };
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

  // ---------------- province generation: cut, preview, apply ----------------
  // The cut runs in the worker and is shown over the map first — the new borders, what
  // they follow ("show what I cut along") and a report. Applying replaces the provinces,
  // which resets the undo history (every province id changes), so nothing is replaced
  // before the user has seen it.
  World.generating = false;
  World.cutPreview = null;  // { m, why, report, project, rasterRev, count, expected }
  World.cutWhy = false;
  World.generate = async function () {
    if (!World.active() || World.generating || World.preview) return;
    World.generating = true;
    World.cancelCut();
    App.emit();
    try {
      const project = App.project, w = project.world;
      const hy = await World.ensureAnalysis();
      if (!hy || App.project !== project) return;
      const dg = World.dataGrid();
      let landCells = 0;
      for (let i = 0; i < dg.landId.length; i++) if (dg.landId[i] >= 0) landCells++;
      if (!landCells) { Actions.toast(t("world.noLand")); return; }
      const opts = Object.assign({}, w.provinceOpts);
      const riverMask = new Uint8Array(GW * GH);
      if (opts.riversAsBorders) {
        World.displayRivers().forEach((rv) => { if (rv.major) World.riverCellsOf(rv).forEach((c) => { riverMask[c] = 1; }); });
      }
      const seeds = opts.citySeeds && window.Objects ? Objects.citySeeds(project) : [];
      const S = clamp(+w.cellSize || 18, 5, 60);
      const forRaster = World.rasterRev;
      const heights = dg.h.slice(), basin = hy.basin.slice(), landId = dg.landId.slice();
      const m = await runJob({ type: "provinces", rev: ++hydroRev, W: GW, H: GH, heights: heights.buffer, basin: basin.buffer,
        landId: landId.buffer, riverMask: riverMask.buffer, target: S * S, seed: w.seed, seeds, opts },
        [heights.buffer, basin.buffer, landId.buffer, riverMask.buffer]);
      if (App.project !== project) return;
      if (World.rasterRev !== forRaster) { Actions.toast(t("world.geo.stale")); return; }
      World.cutPreview = { m, why: new Uint8Array(m.why), report: m.report, opts, project, rasterRev: forRaster,
        count: m.count, before: App.basemap.count || 0, expected: Math.round(landCells / (S * S)) };
      renderWhy();
      Actions.ui({ card: null, modal: null });
    } catch (e) {
      console.error("province generation failed", e);
      Actions.toast(t("world.generateFailed"));
    } finally {
      World.generating = false;
      App.emit();
    }
  };

  // what the new borders follow, one colour per reason, on a data-grid canvas
  const WHY_COLORS = [null, [47, 127, 208], [232, 145, 45], [31, 163, 163], [155, 93, 229]]; // strait, isthmus, river, crest
  World.WHY_COLORS = WHY_COLORS.map((c) => (c ? "rgb(" + c.join(",") + ")" : null));
  function renderWhy() {
    const pv = World.cutPreview;
    if (!pv) return;
    if (!World.whyCanvas) {
      const cv = document.createElement("canvas");
      cv.width = GW; cv.height = GH;
      cv.className = "world-canvas world-why";
      World.whyCanvas = cv;
    }
    const ctx = World.whyCanvas.getContext("2d");
    const img = ctx.createImageData(GW, GH);
    const d = img.data;
    for (let i = 0; i < pv.why.length; i++) {
      const c = WHY_COLORS[pv.why[i]];
      if (!c) continue;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 235;
    }
    ctx.putImageData(img, 0, 0);
    World.whyCanvas.style.display = World.cutWhy ? "block" : "none";
  }
  World.setCutWhy = function (on) {
    World.cutWhy = !!on;
    if (World.whyCanvas) World.whyCanvas.style.display = World.cutPreview && World.cutWhy ? "block" : "none";
    App.emit();
  };
  // the new borders as one SVG path (map coordinates), built once per preview
  World.cutPreviewPath = function (proj) {
    const pv = World.cutPreview;
    if (!pv || !proj) return "";
    if (pv.path && pv.pathProj === proj) return pv.path;
    const out = [];
    pv.m.geometries.forEach((g) => {
      if (!g || !g.coordinates) return;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      polys.forEach((poly) => poly.forEach((ring) => {
        if (ring.length < 2) return;
        out.push("M" + ring.map((q) => { const m = proj(q); return m[0].toFixed(1) + "," + m[1].toFixed(1); }).join("L") + "Z");
      }));
    });
    pv.path = out.join("");
    pv.pathProj = proj;
    return pv.path;
  };
  World.cancelCut = function () {
    if (!World.cutPreview) return;
    World.cutPreview = null;
    if (World.whyCanvas) World.whyCanvas.style.display = "none";
    App.emit();
  };
  World.applyCut = function () {
    const pv = World.cutPreview;
    if (!pv) return;
    if (App.project !== pv.project || World.rasterRev !== pv.rasterRev) { Actions.toast(t("world.geo.stale")); World.cancelCut(); return; }
    if (App.basemap.count > 0 && !confirm(t("world.regenAsk"))) return;
    World.cutPreview = null;
    if (World.whyCanvas) World.whyCanvas.style.display = "none";
    applyGenerated(pv.project, pv.m);
  };

  function applyGenerated(project, m) {
    const features = m.geometries.map((g, i) => ({ type: "Feature", geometry: g, properties: {}, _meta: m.meta ? m.meta[i] : null }))
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
      const mt = f._meta;
      f.id = id;
      delete f._c;
      delete f._meta;
      f.properties = { id, name: prefix.replace("{n}", i + 1) };
      // how the cut sees it: its drainage basin (provinces of one cut share the numbers),
      // whether it holds an isthmus, how many islets were joined to it
      if (mt) {
        if (mt.basin >= 0) f.properties.basin = mt.basin;
        if (mt.neck) f.properties.isthmus = 1;
        if (mt.lands > 1) f.properties.islets = mt.lands - 1;
      }
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

  // ---------------- "Поправить географию": run, preview, apply ----------------
  // slider 0..1 → flux a river needs (few long rivers … many small ones)
  World.riverThresholdOf = (density) => Math.round(600 * Math.pow(50 / 600, clamp(density == null ? 0.5 : +density, 0, 1)));

  function renderPreview() {
    const pv = World.preview;
    if (!pv) return;
    if (!World.previewCanvas) {
      const cv = document.createElement("canvas");
      cv.width = RW; cv.height = RH;
      cv.className = "world-canvas world-preview";
      World.previewCanvas = cv;
      World.previewCtx = cv.getContext("2d");
    }
    for (let y = 0; y < RH; y += 256) paintRect(0, y, RW - 1, Math.min(RH - 1, y + 255), pv.height, pv.cover, World.previewCtx);
  }

  World.runGeography = async function (opts) {
    if (!World.active() || World.geoBusy) return;
    World.cancelCut();
    const project = App.project, w = project.world;
    World.geoBusy = true;
    World.preview = null;
    World.compare = false;
    App.emit();
    try {
      ensureBuffers();
      const hb = World.height.slice(), cb = World.cover.slice();
      const forRaster = World.rasterRev, riversRef = w.rivers || [];
      const m = await runJob({ type: "geography", rev: ++geoRev, RW, RH, RES, GW, GH, height: hb.buffer, cover: cb.buffer,
        rivers: riversRef, riverNames: w.riverNames || {}, seaLevel: sea(), climate: w.climate, seed: w.seed,
        scaleKm: +w.scaleKm || 5, riverThreshold: World.riverThresholdOf(opts.density), minRiverLength: 14, opts }, [hb.buffer, cb.buffer]);
      if (App.project !== project) return;
      if (World.rasterRev !== forRaster || (w.rivers || []) !== riversRef) { Actions.toast(t("world.geo.stale")); return; }
      const rivers = m.rivers.map((r) => (r.id ? r : Object.assign({ id: window.uid() }, r)));
      World.preview = { height: new Int16Array(m.height), cover: new Uint8Array(m.cover), rivers, report: m.report, opts,
        rasterRev: forRaster, riversRef };
      renderPreview();
      Actions.ui({ card: null, modal: null });
    } catch (e) {
      console.error("geography pass failed", e);
      Actions.toast(t("world.geo.failed"));
    } finally {
      World.geoBusy = false;
      App.emit();
    }
  };

  // hold to see the map as it was
  World.setCompare = function (on) {
    if (!World.preview || World.compare === !!on) return;
    World.compare = !!on;
    if (World.previewCanvas) World.previewCanvas.style.display = World.preview && !World.compare ? "block" : "none";
    App.emit();
  };

  World.cancelGeography = function () {
    if (!World.preview) return;
    World.preview = null;
    World.compare = false;
    if (World.previewCanvas) World.previewCanvas.style.display = "none";
    App.emit();
  };

  World.applyGeography = function () {
    const pv = World.preview;
    if (!pv || !World.active()) return;
    const w = W0();
    if (World.rasterRev !== pv.rasterRev || (w.rivers || []) !== pv.riversRef) { Actions.toast(t("world.geo.stale")); World.cancelGeography(); return; }
    const Hh = World.height, C = World.cover;
    let x0 = RW, y0 = RH, x1 = -1, y1 = -1;
    for (let y = 0; y < RH; y++) {
      const row = y * RW;
      for (let x = 0; x < RW; x++) {
        const i = row + x;
        if (Hh[i] !== pv.height[i] || C[i] !== pv.cover[i]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    const riversBefore = riversJSON(w);
    w.rivers = pv.rivers;
    if (pv.opts.addRivers) w.riverNames = {}; // names from the simulated-river days now sit on real rivers
    delete w.legacyAuto;
    const riversAfter = riversJSON(w);
    const riversChanged = riversAfter !== riversBefore;
    if (x1 >= 0) {
      const hBefore = Hh.slice(), cBefore = C.slice();
      Hh.set(pv.height);
      C.set(pv.cover);
      World.ctx.drawImage(World.previewCanvas, 0, 0); // the preview is already the new picture
      World.renderRev++;
      pushRasterUndo(x0, y0, x1, y1, hBefore, cBefore, riversChanged ? { riversBefore, riversAfter } : null);
      World.rasterRev++;
      w.rev = (w.rev || 0) + 1;
    } else if (riversChanged) {
      pushRiversUndo(riversBefore, riversAfter);
    }
    World.preview = null;
    World.compare = false;
    if (World.previewCanvas) World.previewCanvas.style.display = "none";
    window.scheduleSave();
    Actions.toast(t(x1 >= 0 || riversChanged ? "world.geo.applied" : "world.geo.nothing"));
  };
})();
