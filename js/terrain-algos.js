// AtlasForge — terrain algorithms for custom worlds. Pure functions over typed arrays,
// no DOM: loaded by the page (window.TerrainAlgos) and by js/terrain.worker.js.
//
// Everything here works on the ANALYSIS GRID: W×H cells in the world basemap's data
// units (1000 × 510), cell (x, y) covering [x, x+1] × [y, y+1]. Heights are metres
// relative to sea level (≤ 0 is water). The painted raster is finer (see js/world.js)
// and is averaged down before it gets here.
(function (root) {
  const TA = (root.TerrainAlgos = {});

  // ---------- elevation bands ----------
  // 0 water · 1 lowland · 2 hills · 3 mountains · 4 high mountains (snowy peaks)
  TA.BAND_LIMITS = [0, 500, 1500, 3500];
  TA.bandOf = function (h) {
    return h <= 0 ? 0 : h < 500 ? 1 : h < 1500 ? 2 : h < 3500 ? 3 : 4;
  };

  // ---------- biomes (temperature × moisture, after Azgaar's FMG) ----------
  TA.BIOMES = ["water", "glacier", "tundra", "taiga", "coldDesert", "temperateDesert", "grassland",
    "deciduousForest", "temperateRainforest", "hotDesert", "savanna", "tropicalForest", "rainforest", "wetland"];
  // painted cover value (js/world.js COVER index) each biome is painted as by the geography pass
  TA.COVER_OF_BIOME = [0, 9, 5, 7, 3, 3, 1, 2, 2, 3, 8, 6, 6, 4];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- value noise (hash based, deterministic per seed) ----------
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
  TA.vnoise = vnoise;
  TA.fbm = fbm;
  const SQ2 = Math.SQRT2;
  const NX = [1, -1, 0, 0, 1, 1, -1, -1];
  const NY = [0, 0, 1, -1, 1, -1, 1, -1];
  const ND = [1, 1, 1, 1, SQ2, SQ2, SQ2, SQ2];

  // ---------- binary min-heap of (index, key) ----------
  function Heap(cap) {
    this.idx = new Int32Array(cap);
    this.key = new Float64Array(cap);
    this.n = 0;
  }
  Heap.prototype.push = function (i, k) {
    // a search that pushes a cell again when it finds a shorter way (lazy deletion) can
    // hold more entries than cells: grow instead of silently dropping them
    if (this.n >= this.idx.length) {
      const idx2 = new Int32Array(this.idx.length * 2 || 16), key2 = new Float64Array(this.idx.length * 2 || 16);
      idx2.set(this.idx); key2.set(this.key);
      this.idx = idx2; this.key = key2;
    }
    let n = this.n++;
    const idx = this.idx, key = this.key;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (key[p] <= k) break;
      idx[n] = idx[p]; key[n] = key[p]; n = p;
    }
    idx[n] = i; key[n] = k;
  };
  Heap.prototype.pop = function () {
    const idx = this.idx, key = this.key;
    const top = idx[0];
    const n = --this.n;
    if (n > 0) {
      const li = idx[n], lk = key[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && key[c + 1] < key[c]) c++;
        if (key[c] >= lk) break;
        idx[i] = idx[c]; key[i] = key[c]; i = c;
      }
      idx[i] = li; key[i] = lk;
    }
    return top;
  };
  TA.Heap = Heap;

  // ---------- downsample the painted raster to the analysis grid ----------
  // mean of each res×res block, nudged toward the block max so thin ridges survive
  TA.downsample = function (src, SW, SH, res, W, H) {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, mx = -1e9, n = 0;
        for (let dy = 0; dy < res; dy++) {
          const sy = y * res + dy;
          if (sy >= SH) continue;
          for (let dx = 0; dx < res; dx++) {
            const sx = x * res + dx;
            if (sx >= SW) continue;
            const v = src[sy * SW + sx];
            sum += v; n++;
            if (v > mx) mx = v;
          }
        }
        const mean = n ? sum / n : 0;
        // a cell is water only if the whole block is
        out[y * W + x] = mx <= 0 ? Math.min(mean, 0) : Math.max(1, mean * 0.6 + mx * 0.4);
      }
    }
    return out;
  };

  // ---------- landmasses of the painted raster ----------
  // The analysis grid cannot see a strait narrower than a data cell: a cell is land when
  // any of its sub-cells is, so the water between two coasts vanishes and both coasts
  // read as one piece of land. Landmasses are therefore found on the raster itself (land
  // 4-connected: land touching only at a corner is two landmasses) and handed down:
  //   landId[i] — landmass of data cell i (numbered in reading order), -1 for water.
  //               A cell holding land of two landmasses (a strait runs through it)
  //               counts as water.
  //   area[id]  — data cells of each landmass
  TA.landTopology = function (height, sea, SW, SH, res, W, H) {
    const NS = SW * SH;
    const comp = new Int32Array(NS).fill(-1);
    const queue = new Int32Array(NS);
    let count = 0;
    for (let s = 0; s < NS; s++) {
      if (comp[s] >= 0 || height[s] <= sea) continue;
      const id = count++;
      let qh = 0, qt = 0;
      queue[qt++] = s; comp[s] = id;
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % SW;
        if (x > 0 && comp[i - 1] < 0 && height[i - 1] > sea) { comp[i - 1] = id; queue[qt++] = i - 1; }
        if (x < SW - 1 && comp[i + 1] < 0 && height[i + 1] > sea) { comp[i + 1] = id; queue[qt++] = i + 1; }
        if (i >= SW && comp[i - SW] < 0 && height[i - SW] > sea) { comp[i - SW] = id; queue[qt++] = i - SW; }
        if (i + SW < NS && comp[i + SW] < 0 && height[i + SW] > sea) { comp[i + SW] = id; queue[qt++] = i + SW; }
      }
    }
    const N = W * H;
    const landId = new Int32Array(N).fill(-1);
    let cuts = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let id = -1, mixed = false;
        for (let dy = 0; dy < res; dy++) {
          const sy = y * res + dy;
          if (sy >= SH) break;
          for (let dx = 0; dx < res; dx++) {
            const sx = x * res + dx;
            if (sx >= SW) break;
            const c = comp[sy * SW + sx];
            if (c < 0) continue;
            if (id < 0) id = c; else if (c !== id) mixed = true;
          }
        }
        if (mixed) cuts++;
        else landId[y * W + x] = id;
      }
    }
    const remap = new Int32Array(count).fill(-1);
    const areas = [];
    for (let i = 0; i < N; i++) {
      const c = landId[i];
      if (c < 0) continue;
      if (remap[c] < 0) { remap[c] = areas.length; areas.push(0); }
      landId[i] = remap[c];
      areas[remap[c]]++;
    }
    return { landId, count: areas.length, area: Int32Array.from(areas), cuts };
  };

  // ---------- distance transform ----------
  // squared Euclidean distance from every cell to the nearest cell with mask[i] = 1
  // (exact, Felzenszwalb & Huttenlocher); 1e20 where the mask is empty
  TA.edt2 = function (W, H, mask, out) {
    const INF = 1e20;
    const D = out || new Float64Array(W * H);
    const n = Math.max(W, H);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    // lower envelope of parabolas: d[q] = min over p of (q - p)² + f[p]
    const dt = (len) => {
      let k = -1;
      for (let q = 0; q < len; q++) {
        const fq = f[q];
        if (fq >= INF) continue;
        if (k < 0) { k = 0; v[0] = q; z[0] = -INF; z[1] = INF; continue; }
        let p = v[k];
        let sx = ((fq + q * q) - (f[p] + p * p)) / (2 * (q - p));
        while (sx <= z[k]) { k--; p = v[k]; sx = ((fq + q * q) - (f[p] + p * p)) / (2 * (q - p)); }
        k++; v[k] = q; z[k] = sx; z[k + 1] = INF;
      }
      if (k < 0) { d.fill(INF, 0, len); return; }
      k = 0;
      for (let q = 0; q < len; q++) {
        while (z[k + 1] < q) k++;
        const p = v[k];
        d[q] = (q - p) * (q - p) + f[p];
      }
    };
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = mask[y * W + x] ? 0 : INF;
      dt(H);
      for (let y = 0; y < H; y++) D[y * W + x] = d[y];
    }
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) f[x] = D[row + x];
      dt(W);
      for (let x = 0; x < W; x++) D[row + x] = d[x];
    }
    return D;
  };

  // ---------- how thin the land is ----------
  // level[i] of a land cell = for how many of the radii (ascending) a disc of land WIDER
  // than that radius still covers the cell: 0 = thinner than radii[0], radii.length =
  // wider than all. No disc wider than 2 fits along an isthmus four cells across; a coast
  // is covered by the discs of the interior, so a coast is not thin — only land that is.
  // Water and the land of another landmass bound the discs, the map frame does not.
  // Exact: one morphological opening per radius on Euclidean distance transforms.
  TA.landLevels = function (lid, W, H, radii) {
    const N = W * H;
    const mask = new Uint8Array(N);
    const border = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, L = lid[i];
        if (L < 0) { mask[i] = 1; continue; }
        if ((x > 0 && lid[i - 1] >= 0 && lid[i - 1] !== L) || (x < W - 1 && lid[i + 1] >= 0 && lid[i + 1] !== L) ||
          (y > 0 && lid[i - W] >= 0 && lid[i - W] !== L) || (y < H - 1 && lid[i + W] >= 0 && lid[i + W] !== L)) {
          mask[i] = 1; border.push(i);
        }
      }
    }
    const D2 = TA.edt2(W, H, mask);
    const level = new Uint8Array(N);
    const tmp = new Float64Array(N);
    for (const r of radii) {
      // measured to the water's edge (half a cell short of its centre), a disc of radius r
      // fits around every centre at least r + ½ from water; it covers the cells within r
      const tc = (r + 0.5) * (r + 0.5), r2 = r * r;
      for (let i = 0; i < N; i++) mask[i] = D2[i] >= tc ? 1 : 0;
      TA.edt2(W, H, mask, tmp);
      for (let i = 0; i < N; i++) if (lid[i] >= 0 && tmp[i] <= r2) level[i]++;
    }
    // a cell on the line between two landmasses bounds the discs itself: it takes the
    // level of the land beside it
    for (const i of border) {
      const x = i % W, L = lid[i];
      let best = level[i];
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const j of nb) if (j >= 0 && j < N && lid[j] === L && level[j] > best) best = level[j];
      level[i] = best;
    }
    return level;
  };

  // ---------- Priority-Flood depression filling (Barnes et al.) ----------
  // Returns filled heights (tiny epsilon so every land cell drains) and the land
  // cells in the order they were reached: increasing filled height = downstream first.
  TA.priorityFlood = function (h, W, H) {
    const N = W * H;
    const filled = new Float64Array(N);
    const closed = new Uint8Array(N);
    const order = new Int32Array(N);
    let nOrder = 0;
    const heap = new Heap(N);
    for (let i = 0; i < N; i++) filled[i] = h[i];
    // outlets: water cells next to land, and land on the map edge
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (h[i] <= 0) {
          closed[i] = 1;
          let coast = false;
          for (let k = 0; k < 4 && !coast; k++) {
            const xx = x + NX[k], yy = y + NY[k];
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && h[yy * W + xx] > 0) coast = true;
          }
          if (coast) heap.push(i, h[i]);
        } else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
          closed[i] = 1;
          heap.push(i, h[i]);
          order[nOrder++] = i;
        }
      }
    }
    while (heap.n) {
      const c = heap.pop();
      const cx = c % W, cy = (c / W) | 0;
      const fc = filled[c];
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (closed[n]) continue;
        closed[n] = 1;
        if (filled[n] <= fc) filled[n] = fc + 1e-4 * ND[k];
        heap.push(n, filled[n]);
        order[nOrder++] = n;
      }
    }
    return { filled, order: order.subarray(0, nOrder) };
  };

  // ---------- Priority-Flood with breaching ----------
  // Like TA.priorityFlood, but a hollow is drained instead of filled: when the flood
  // reaches a cell lower than the one it came from, the way back to the outlet is cut to
  // just below it. Water then runs down the real slopes into a hollow and on along the
  // lowest way out, instead of across a filled flat toward wherever the flood entered it —
  // so the routes follow the ground, and do not jump when a later pass cuts an outlet.
  // Returns { filled: the breached surface, down, order: land cells downstream first }.
  TA.priorityBreach = function (h, W, H) {
    const N = W * H;
    const dem = new Float64Array(N);
    const closed = new Uint8Array(N);
    const parent = new Int32Array(N).fill(-1);
    const heap = new Heap(N);
    for (let i = 0; i < N; i++) dem[i] = h[i];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (h[i] <= 0) {
          closed[i] = 1;
          let coast = false;
          for (let k = 0; k < 4 && !coast; k++) {
            const xx = x + NX[k], yy = y + NY[k];
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && h[yy * W + xx] > 0) coast = true;
          }
          if (coast) heap.push(i, h[i]);
        } else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
          closed[i] = 1;
          heap.push(i, h[i]);
        }
      }
    }
    while (heap.n) {
      const c = heap.pop();
      const cx = c % W, cy = (c / W) | 0;
      const land = h[c] > 0;
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (closed[n]) continue;
        closed[n] = 1;
        if (land) {
          parent[n] = c;
          if (dem[n] <= dem[c]) { // a hollow: every cell on the way out lies lower than the one before
            let lo = dem[n], p = c;
            while (p >= 0 && dem[p] >= lo) { lo -= 1e-4; dem[p] = lo; p = parent[p]; }
          }
        }
        heap.push(n, dem[n]);
      }
    }
    const down = TA.flowDirections(dem, h, W, H);
    return { filled: dem, down, order: TA.flowOrder(down, h, W, H) };
  };

  // land cells ordered downstream first (from the cells whose water leaves the land)
  TA.flowOrder = function (down, h, W, H) {
    const N = W * H;
    const order = new Int32Array(N);
    let n = 0;
    for (let i = 0; i < N; i++) if (h[i] > 0 && (down[i] < 0 || h[down[i]] <= 0)) order[n++] = i;
    for (let q = 0; q < n; q++) {
      const c = order[q];
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const u = yy * W + xx;
        if (down[u] === c && h[u] > 0) order[n++] = u;
      }
    }
    return order.subarray(0, n);
  };

  // steepest descent on the filled surface; -1 where the next cell is water / off-map
  TA.flowDirections = function (filled, h, W, H) {
    const N = W * H;
    const down = new Int32Array(N).fill(-1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (h[i] <= 0) continue;
        let best = -1, bs = 0;
        for (let k = 0; k < 8; k++) {
          const xx = x + NX[k], yy = y + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          const s = (filled[i] - (h[n] <= 0 ? Math.min(filled[n], 0) - 1 : filled[n])) / ND[k];
          if (s > bs) { bs = s; best = n; }
        }
        down[i] = best;
      }
    }
    return down;
  };

  // ---------- climate ----------
  // opts: latTop, latBottom (degrees), tEquator, tPole (°C at sea level)
  // Climate on the analysis grid. opts: latTop, latBottom (latitude of the map's top and
  // bottom rows), tEquator, tPole (°C at sea level), km (per cell).
  // temp — °C at the ground; prec — yearly precipitation on an absolute scale, 1 ≈ 2000 mm.
  // Air picks up moisture over the sea (more over warm sea) and carries it with the
  // prevailing wind of its latitude band (trade winds and polar easterlies blow west, the
  // westerlies east). Over land it rains a little every kilometre — most of that rain
  // evaporates again, so an interior stays fairly moist a long way in — and much more
  // where the ground rises: windward slopes are wet, the land behind a range is in its
  // rain shadow. Latitude bands make rain likelier (the tropics) or rarer (the subtropical
  // highs), and every coast gets some rain from the sea whichever way the wind blows.
  TA.climate = function (h, W, H, opts) {
    opts = opts || {};
    const latTop = opts.latTop != null ? +opts.latTop : 70;
    const latBottom = opts.latBottom != null ? +opts.latBottom : -10;
    const tEq = opts.tEquator != null ? +opts.tEquator : 27;
    const tPole = opts.tPole != null ? +opts.tPole : -28;
    const km = +opts.km > 0 ? +opts.km : 5;
    const N = W * H;
    const temp = new Float32Array(N);
    const prec = new Float32Array(N);
    const latOf = (y) => latTop + (latBottom - latTop) * (y + 0.5) / H;
    for (let y = 0; y < H; y++) {
      const u = Math.min(90, Math.abs(latOf(y))) / 90;
      const t0 = tEq - (tEq - tPole) * u * u; // 30° ≈ 21 °C, 45° ≈ 13 °C, 60° ≈ 3 °C with the defaults
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        temp[i] = t0 - 6.5 * Math.max(0, h[i]) / 1000;
      }
    }
    const bandWet = (lat) => {
      const a = Math.abs(lat);
      const pts = [[0, 1.35], [10, 1.2], [20, 0.62], [27, 0.5], [35, 0.75], [45, 1.1], [60, 1.0], [72, 0.6], [90, 0.35]];
      for (let k = 1; k < pts.length; k++) {
        if (a <= pts[k][0]) {
          const t = (a - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]);
          return pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
        }
      }
      return 0.35;
    };
    // moisture the air holds over the sea (warm sea: more)
    const mSat = (t) => 0.35 + 0.65 * clamp((t + 5) / 35, 0, 1);
    const PER_KM = 1 / 900;            // share of the air's moisture that rains out per km of flat land
    // share of that rain that evaporates back into the air: more where it is warm (forests)
    const recycle = (t) => 0.45 + 0.25 * clamp((t - 10) / 20, 0, 1);
    const UPTAKE = 1 - Math.exp(-km / 450); // over the sea the air nears saturation in ~450 km
    const MIX = 1 - Math.exp(-km / 1500);   // air from other directions mixes in over ~1500 km
    const K = 511;                     // moisture per km → the 0…1 precipitation scale
    // the air rises with the lie of the land, not with every valley cut into it
    const hs = new Float32Array(N), tmpS = new Float32Array(N);
    for (let i = 0; i < N; i++) hs[i] = Math.max(0, h[i]);
    boxBlur(hs, W, H, Math.max(2, Math.round(12 / km)), tmpS);
    for (let y = 0; y < H; y++) {
      const lat = latOf(y);
      const a = Math.abs(lat);
      const eastward = a >= 30 && a < 60;
      const band = bandWet(lat);
      // under the subtropical highs the air sinks and dries on its way inland
      const sink = 1 - Math.exp(-km * Math.max(0, 1 - band) / 1100);
      // near the equator the air rises in thunderstorms that draw moisture in from all
      // sides; elsewhere air from other directions slowly mixes in (least under the
      // subtropical highs), so a rain shadow fades a long way behind its range
      const conv = 2 * Math.max(0, band - 1) * UPTAKE;
      const bgBand = 0.5 * Math.pow(Math.min(1, band), 3);
      let m = 0;
      for (let pass = 0; pass < 2; pass++) { // the second pass starts with the air that wrapped round
        let prevH = 0;
        for (let s0 = 0; s0 < W; s0++) {
          const x = eastward ? s0 : W - 1 - s0;
          const i = y * W + x;
          const hh = h[i];
          if (hh <= 0) {
            m += (mSat(temp[i]) - m) * UPTAKE;
            prevH = 0;
            continue;
          }
          const sat = mSat(temp[i]);
          if (conv && m < sat) m += (sat - m) * conv;
          const bg = sat * bgBand;
          if (m < bg) m += (bg - m) * MIX;
          const lift = Math.max(0, hs[i] - prevH); // metres risen over this cell
          let frac = km * PER_KM + Math.min(0.6, lift / 900);
          if (hh > 2500) frac += 0.08 + (hh - 2500) / 25000;
          frac = Math.min(0.85, frac * band);
          const rain = m * frac;
          m -= rain * (1 - recycle(temp[i])) + m * sink;
          if (pass) prec[i] = rain / km * K;
          prevH = hs[i];
        }
      }
    }
    // rain from the sea on every coast, fading inland over a few hundred km (not from a
    // lake: water not reaching the map edge counts only as big as an inland sea)
    const waters = TA.components(W, H, (i) => h[i] <= 0, true);
    const seaSized = waters.list.map((c) => c.edge || c.area * km * km > 150000);
    const seaMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const c = waters.comp[i]; seaMask[i] = c >= 0 && seaSized[c] ? 1 : 0; }
    const d2 = TA.edt2(W, H, seaMask);
    for (let y = 0; y < H; y++) {
      const band = bandWet(latOf(y));
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (h[i] <= 0 || d2[i] >= 1e19) continue;
        prec[i] += 0.12 * mSat(temp[i]) * Math.min(1, band) * Math.exp(-Math.sqrt(d2[i]) * km / 250);
      }
    }
    // weather is broad: smooth over about 100 km (two box passes), land only
    const R = Math.max(1, Math.round(60 / km));
    const tmp = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) boxBlur(prec, W, H, R, tmp);
    for (let i = 0; i < N; i++) prec[i] = h[i] > 0 ? clamp(prec[i], 0, 1) : 0;
    return { temp, prec };
  };

  // Biome from temperature, precipitation and how much water that climate could
  // evaporate: a desert is where precipitation stays far below it, not merely where it is low.
  TA.pet = (t) => 0.18 + 0.022 * Math.max(0, t); // potential evaporation, same scale as prec
  TA.biomeOf = function (t, p, h, nearWater, flat) {
    if (h <= 0) return 0;
    if (t < -10) return 1;
    const mi = p / TA.pet(t); // moisture index
    if (mi > 1.05 && nearWater && flat && h < 400 && t > 0) return 13;
    if (t < -2) return 2;
    if (t < 5) return mi < 0.15 ? 4 : mi < 0.45 ? 2 : 3;
    if (t < 19) return mi < 0.2 ? 5 : mi < 0.5 ? 6 : mi < 1.3 ? 7 : 8;
    return mi < 0.2 ? 9 : mi < 0.55 ? 10 : mi < 1.2 ? 11 : 12;
  };

  // ---------- hydrology: accumulation, lakes, rivers, basins ----------
  // opts: rain (Float32 0..1 per cell), riverThreshold (flux units), minRiverCells,
  //   through (Uint8 per cell, optional) — lakes already there, given as low land: their
  //   water passes on over the lowest point of the rim; no new lake or river is made there;
  //   breach — route water through hollows by TA.priorityBreach (no lakes are found then)
  TA.hydrology = function (h, W, H, opts) {
    opts = opts || {};
    const N = W * H;
    const pf = opts.breach ? TA.priorityBreach(h, W, H) : TA.priorityFlood(h, W, H);
    const { filled, order } = pf;
    const down = pf.down || TA.flowDirections(filled, h, W, H);
    const rain = opts.rain;
    const through = opts.through || null;
    const acc = new Float32Array(N);
    for (let k = order.length - 1; k >= 0; k--) {
      const c = order[k];
      acc[c] += rain ? 0.2 + rain[c] : 1;
      const d = down[c];
      if (d >= 0) acc[d] += acc[c];
    }
    // lakes: a closed depression holds water only near its bottom — as deep as its
    // inflow can keep against evaporation, never up to the rim of a whole basin
    const lake = new Uint8Array(N);
    const seen = new Uint8Array(N);
    const stack = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (seen[i] || h[i] <= 0 || filled[i] - h[i] < 3) continue;
      let sp = 0;
      const cells = [];
      stack[sp++] = i; seen[i] = 1;
      let minH = Infinity, inflow = 0, spill = -Infinity, wet = false;
      while (sp) {
        const c = stack[--sp];
        cells.push(c);
        if (through && through[c]) wet = true;
        if (h[c] < minH) minH = h[c];
        if (acc[c] > inflow) inflow = acc[c];
        if (filled[c] > spill) spill = filled[c];
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (!seen[n] && h[n] > 0 && filled[n] - h[n] >= 3) { seen[n] = 1; stack[sp++] = n; }
        }
      }
      if (wet || spill - minH < (opts.lakeDepth || 25)) continue; // wet: the lake is there already
      // surface area where evaporation balances the inflow; the lowest cells fill first
      const evap = opts.evaporation || 4;
      const area = Math.min(cells.length, Math.round(inflow / evap));
      if (area < (opts.minLakeCells || 25)) continue;
      cells.sort((p, q) => h[p] - h[q]);
      for (let k = 0; k < area; k++) lake[cells[k]] = 1;
    }
    // basins: every land cell belongs to the outlet its water reaches
    const basin = new Int32Array(N).fill(-1);
    let nBasins = 0;
    for (let k = 0; k < order.length; k++) {
      const c = order[k];
      const d = down[c];
      if (d < 0 || h[d] <= 0) basin[c] = nBasins++;
      else basin[c] = basin[d] >= 0 ? basin[d] : (basin[d] = nBasins++);
    }

    // rivers: cells carrying more flux than the threshold (lake surfaces excluded)
    const thr = opts.riverThreshold || 60;
    const isRiver = new Uint8Array(N);
    const lakeAt = (i) => lake[i] || (through !== null && through[i] === 1);
    for (let i = 0; i < N; i++) if (h[i] > 0 && !lakeAt(i) && acc[i] >= thr) isRiver[i] = 1;
    // main upstream = the river neighbour flowing into this cell with the most flux
    const mainUp = new Int32Array(N).fill(-1);
    const upCount = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!isRiver[i]) continue;
      const d = down[i];
      if (d >= 0 && isRiver[d]) {
        upCount[d]++;
        if (mainUp[d] < 0 || acc[i] > acc[mainUp[d]]) mainUp[d] = i;
      }
    }
    // Strahler order, upstream first
    const strahler = new Uint8Array(N);
    const maxUp = new Uint8Array(N), maxUpCount = new Uint8Array(N);
    for (let k = order.length - 1; k >= 0; k--) {
      const c = order[k];
      if (!isRiver[c]) continue;
      strahler[c] = maxUp[c] === 0 ? 1 : maxUpCount[c] >= 2 ? maxUp[c] + 1 : maxUp[c];
      const d = down[c];
      if (d >= 0 && isRiver[d]) {
        if (strahler[c] > maxUp[d]) { maxUp[d] = strahler[c]; maxUpCount[d] = 1; }
        else if (strahler[c] === maxUp[d]) maxUpCount[d]++;
      }
    }
    // river ids: a stream keeps its id through its main-upstream chain
    const rid = new Int32Array(N).fill(-1);
    const rivers = [];
    for (let k = order.length - 1; k >= 0; k--) {
      const c = order[k];
      if (!isRiver[c]) continue;
      if (mainUp[c] >= 0) rid[c] = rid[mainUp[c]];
      else { rid[c] = rivers.length; rivers.push({ source: c, cells: null }); }
    }
    const minCells = opts.minRiverCells || 6;
    rivers.forEach((r, id) => {
      const cells = [];
      let c = r.source, guard = 0;
      while (c >= 0 && isRiver[c] && rid[c] === id && guard++ < N) {
        cells.push(c);
        c = down[c];
      }
      const last = cells[cells.length - 1];
      const next = down[last];
      r.cells = cells;
      r.flux = acc[last];
      r.order = strahler[last];
      r.mouth = next;
      r.mouthType = next < 0 ? "edge" : h[next] <= 0 ? "sea" : lakeAt(next) ? "lake" : isRiver[next] ? "river" : "land";
      r.into = r.mouthType === "river" ? rid[next] : -1;
      r.sourceType = (down[r.source] >= 0 && lakeAt(down[r.source])) || (r.source >= 0 && neighbourLake(r.source)) ? "lake" : "spring";
    });
    function neighbourLake(c) {
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && lakeAt(yy * W + xx)) return true;
      }
      return false;
    }
    // drop trickles, but keep anything a kept river flows into
    const keep = rivers.map((r) => r.cells.length >= minCells);
    rivers.forEach((r) => { if (keep[rivers.indexOf(r)] && r.into >= 0) keep[r.into] = true; });
    const remap = new Int32Array(rivers.length).fill(-1);
    const out = [];
    rivers.forEach((r, id) => { if (keep[id]) { remap[id] = out.length; out.push(r); } });
    out.forEach((r) => { r.into = r.into >= 0 ? remap[r.into] : -1; });
    return { filled, order, down, acc, lake, basin, nBasins, rivers: out, isRiver, strahler, riverId: rid, riverRemap: remap };
  };

  // merge tiny basins (coastal slivers, flats) into the neighbour across the lowest
  // pass, so only real divides — ridges — remain basin boundaries
  TA.mergeBasins = function (basin, nBasins, h, W, H, minCells) {
    const N = W * H;
    const area = new Int32Array(nBasins);
    for (let i = 0; i < N; i++) if (basin[i] >= 0) area[basin[i]]++;
    const parent = new Int32Array(nBasins);
    for (let b = 0; b < nBasins; b++) parent[b] = b;
    const find = (b) => { while (parent[b] !== b) { parent[b] = parent[parent[b]]; b = parent[b]; } return b; };
    for (let round = 0; round < 6; round++) {
      // lowest pass height between each small basin and its neighbours
      const bestN = new Int32Array(nBasins).fill(-1);
      const bestPass = new Float32Array(nBasins).fill(1e9);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (basin[i] < 0) continue;
          const a = find(basin[i]);
          for (let k = 0; k < 2; k++) {
            const xx = x + NX[k * 2], yy = y + NY[k * 2]; // right, down
            if (xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (basin[j] < 0) continue;
            const b = find(basin[j]);
            if (a === b) continue;
            const pass = Math.max(h[i], h[j]);
            if (area[a] < minCells && pass < bestPass[a]) { bestPass[a] = pass; bestN[a] = b; }
            if (area[b] < minCells && pass < bestPass[b]) { bestPass[b] = pass; bestN[b] = a; }
          }
        }
      }
      let merged = 0;
      for (let b = 0; b < nBasins; b++) {
        if (find(b) !== b || area[b] >= minCells || bestN[b] < 0) continue;
        const into = find(bestN[b]);
        if (into === b) continue;
        parent[b] = into;
        area[into] += area[b];
        area[b] = 0;
        merged++;
      }
      if (!merged) break;
    }
    const out = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (basin[i] >= 0) out[i] = find(basin[i]);
    return out;
  };

  // ---------- connected components ----------
  TA.components = function (W, H, pred, eight) {
    const N = W * H;
    const comp = new Int32Array(N).fill(-1);
    const list = [];
    const queue = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1 || !pred(s)) continue;
      const id = list.length;
      const c = { id, area: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, minx: W, miny: H, maxx: 0, maxy: 0, edge: false };
      list.push(c);
      let qh = 0, qt = 0;
      queue[qt++] = s; comp[s] = id;
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % W, y = (i / W) | 0;
        c.area++; c.sx += x + 0.5; c.sy += y + 0.5;
        c.sxx += (x + 0.5) * (x + 0.5); c.syy += (y + 0.5) * (y + 0.5); c.sxy += (x + 0.5) * (y + 0.5);
        if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x;
        if (y < c.miny) c.miny = y; if (y > c.maxy) c.maxy = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) c.edge = true;
        for (let k = 0; k < (eight ? 8 : 4); k++) {
          const xx = x + NX[k], yy = y + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (comp[j] === -1 && pred(j)) { comp[j] = id; queue[qt++] = j; }
        }
      }
    }
    return { comp, list };
  };

  // ---------- smart provinces ----------
  // input: W, H, h (metres), basin (merged), landId (Int32 from TA.landTopology; taken
  //        from h when missing), riverMask (Uint8, major rivers — optional),
  //        target (cells per province), seed, seeds: [[x, y], …] (e.g. cities),
  //        opts { mountains: "sides" | "separate", riversAsBorders, joinIslets }
  // Guarantees:
  //  · a province never spans two landmasses, however narrow the water between them —
  //    except an islet joined to the nearest coast (specks always, islets with joinIslets);
  //  · a province never spans an isthmus: thin land whose removal leaves two substantial
  //    pieces of its landmass;
  //  · all mountain cells of a province drain to the same basin (no province straddles a
  //    ridge);
  //  · every province is one piece of land (plus the islets joined to it).
  // Returns { labels, count, meta: [{ cells, land, lands, mount, basin, neck, city }],
  //           why: Uint8 per cell — what the borders follow (1 strait, 2 isthmus, 3 river,
  //           4 crest), report }
  TA.smartProvinces = function (input) {
    const { W, H, h, basin } = input;
    const opts = input.opts || {};
    const N = W * H;
    const A = Math.max(12, input.target || 300);
    const S = Math.sqrt(A);
    const separate = opts.mountains === "separate";
    const riverMask = opts.riversAsBorders && input.riverMask ? input.riverMask : null;
    const lid = input.landId && input.landId.length === N ? input.landId : TA.components(W, H, (i) => h[i] > 0, false).comp;
    let nLand = 0;
    for (let i = 0; i < N; i++) if (lid[i] >= nLand) nLand = lid[i] + 1;
    const lmArea = new Int32Array(nLand);
    for (let i = 0; i < N; i++) if (lid[i] >= 0) lmArea[lid[i]]++;
    const isMount = (i) => h[i] >= 1500;
    const groupOf = (i) => (lid[i] < 0 ? 0 : isMount(i) ? 2 : 1);
    const queue = new Int32Array(N);

    // 0) thin land: THIN where no disc of land wider than hardR fits over a cell. Growing
    //    across narrow land costs more (×4 on thin land, less up to softR), so borders
    //    settle on necks. An ISTHMUS — thin land whose removal leaves two pieces of at
    //    least minSide cells — is a border like a river; a cape or a spit separates nothing.
    //    (A data cell is land when any of its sub-cells is, so painted land reads up to a
    //    cell wider here: radius 2 is a neck painted about three cells across.)
    const T = [Date.now()];
    const hardR = clamp(0.1 * S, 2, 3);
    const softR = clamp(0.25 * S, 3, 7);
    const lvl = TA.landLevels(lid, W, H, [hardR, (hardR + softR) / 2, softR]);
    const minSide = Math.max(24, 0.25 * A);
    const LEVEL_COST = [4, 2.5, 1.6, 1];
    const thinCost = new Float32Array(N);
    for (let i = 0; i < N; i++) if (lid[i] >= 0) thinCost[i] = LEVEL_COST[lvl[i]];
    // parts: 4-connected runs of thin land and of wide land within each landmass
    const part = new Int32Array(N).fill(-1);
    const partArea = [], partThin = [];
    for (let s = 0; s < N; s++) {
      if (part[s] >= 0 || lid[s] < 0) continue;
      const L = lid[s], thin = lvl[s] === 0, id = partArea.length;
      let qh = 0, qt = 0;
      queue[qt++] = s; part[s] = id;
      while (qh < qt) {
        const c = queue[qh++];
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (part[n] < 0 && lid[n] === L && (lvl[n] === 0) === thin) { part[n] = id; queue[qt++] = n; }
        }
      }
      partArea.push(qt); partThin.push(thin);
    }
    const nParts = partArea.length;
    const partAdj = Array.from({ length: nParts }, () => []);
    const linked = new Set();
    const link = (a, b) => {
      if (a === b) return;
      const key = a < b ? a * nParts + b : b * nParts + a;
      if (linked.has(key)) return;
      linked.add(key);
      partAdj[a].push(b); partAdj[b].push(a);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (part[i] < 0) continue;
        if (x + 1 < W && lid[i + 1] === lid[i]) link(part[i], part[i + 1]);
        if (y + 1 < H && lid[i + W] === lid[i]) link(part[i], part[i + W]);
      }
    }
    const neckPart = new Uint8Array(nParts);
    let nNecks = 0;
    {
      const mark = new Int32Array(nParts).fill(-1);
      const stack = [];
      for (let a = 0; a < nParts; a++) {
        if (!partThin[a] || partAdj[a].length < 2) continue;
        // the pieces left when this thin part is taken away
        let big = 0;
        for (const start of partAdj[a]) {
          if (mark[start] === a) continue;
          let area = 0;
          stack.length = 0; stack.push(start); mark[start] = a;
          while (stack.length) {
            const c = stack.pop();
            area += partArea[c];
            for (const d of partAdj[c]) if (d !== a && mark[d] !== a) { mark[d] = a; stack.push(d); }
          }
          if (area >= minSide) big++;
        }
        if (big >= 2) { neckPart[a] = 1; nNecks++; }
      }
    }
    const neck = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (part[i] >= 0 && neckPart[part[i]]) neck[i] = 1;
    // regions: the pieces a landmass falls into between its isthmuses
    const region = new Int32Array(N).fill(-1);
    let nRegions = 0;
    for (let s = 0; s < N; s++) {
      if (region[s] >= 0 || lid[s] < 0 || neck[s]) continue;
      const L = lid[s], id = nRegions++;
      let qh = 0, qt = 0;
      queue[qt++] = s; region[s] = id;
      while (qh < qt) {
        const c = queue[qh++];
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (region[n] < 0 && lid[n] === L && !neck[n]) { region[n] = id; queue[qt++] = n; }
        }
      }
    }
    T.push(Date.now());
    // a long isthmus gets provinces of its own; a short one is shared out between its ends
    const ownNeck = 0.3 * A;
    const barrier = (i) => (riverMask !== null && riverMask[i] === 1) || (neck[i] === 1 && partArea[part[i]] < ownNeck);

    // 1) blocks: one landmass, one landform (mountains also one basin), isthmus land apart;
    //    rivers cut lowland when enabled
    const block = new Int32Array(N).fill(-1);
    const blocks = [];
    for (let s = 0; s < N; s++) {
      if (block[s] >= 0 || lid[s] < 0 || barrier(s)) continue;
      const g = groupOf(s), bs = basin[s], L = lid[s], nk = neck[s];
      const id = blocks.length;
      const cells = [];
      let qh = 0, qt = 0;
      queue[qt++] = s; block[s] = id;
      while (qh < qt) {
        const c = queue[qh++];
        cells.push(c);
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (block[n] >= 0 || lid[n] !== L || neck[n] !== nk || barrier(n) || groupOf(n) !== g) continue;
          if (g === 2 && basin[n] !== bs) continue;
          block[n] = id; queue[qt++] = n;
        }
      }
      blocks.push({ id, group: g, basin: bs, land: L, region: nk ? -1 : region[s], cells });
    }

    // 2) atoms: split each block into k geodesic Voronoi pieces (never leaves the block)
    T.push(Date.now());
    const atom = new Int32Array(N).fill(-1);
    const dist = new Float32Array(N).fill(Infinity);
    const seedsIn = new Map(); // block -> seed cells from input seeds (cities)
    const seedCells = [];
    (input.seeds || []).forEach((p) => {
      const x = Math.floor(p[0]), y = Math.floor(p[1]);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      seedCells.push(y * W + x);
      const b = block[y * W + x];
      if (b < 0) return;
      if (!seedsIn.has(b)) seedsIn.set(b, []);
      seedsIn.get(b).push(y * W + x);
    });
    let nAtoms = 0;
    const atomMeta = []; // { block, group, basin, land, region }
    const heap = new Heap(N);
    const geodesic = (cells, seeds, labelBase, labels) => {
      // multi-source Dijkstra restricted to the cells of one block
      for (const c of cells) dist[c] = Infinity;
      heap.n = 0;
      seeds.forEach((sc, k) => { dist[sc] = 0; labels[sc] = labelBase + k; heap.push(sc, 0); });
      const bid = block[cells[0]];
      while (heap.n) {
        const c = heap.pop();
        const dc = dist[c];
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 8; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (block[n] !== bid) continue;
          // diagonal steps may not squeeze between two cells of another block
          if (k >= 4 && (block[cy * W + xx] !== bid || block[yy * W + cx] !== bid)) continue;
          const nd = dc + ND[k] * (1 + Math.abs(h[n] - h[c]) / 400) * thinCost[n];
          if (nd < dist[n]) { dist[n] = nd; labels[n] = labels[c]; heap.push(n, nd); }
        }
      }
    };
    let rng = (input.seed | 0) || 1234567;
    const rand = () => { rng = (Math.imul(rng ^ (rng >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((rng ^ (rng >>> 13)) >>> 0) / 4294967296; };
    blocks.forEach((b) => {
      const factor = b.group === 2 ? 1.6 : 1;
      const k = Math.max(1, Math.round(b.cells.length / (A * factor)));
      let seeds = (seedsIn.get(b.id) || []).slice(0, k);
      const tmpLabels = atom;
      if (k === 1 && !seeds.length) {
        // one piece: its most central cell
        let sx = 0, sy = 0;
        b.cells.forEach((c) => { sx += c % W; sy += (c / W) | 0; });
        sx /= b.cells.length; sy /= b.cells.length;
        let best = b.cells[0], bd = Infinity;
        b.cells.forEach((c) => { const d = (c % W - sx) ** 2 + (((c / W) | 0) - sy) ** 2; if (d < bd) { bd = d; best = c; } });
        seeds.push(best);
      } else if (seeds.length < k) {
        // dart throwing over the block's cells: evenly spaced seeds in O(cells)
        const spacing = Math.sqrt(A * factor) * 0.9;
        const cellHash = new Map();
        const hk = (x, y) => Math.floor(x / spacing) + ":" + Math.floor(y / spacing);
        const addSeed = (c) => {
          const x = c % W, y = (c / W) | 0, key = hk(x, y);
          if (!cellHash.has(key)) cellHash.set(key, []);
          cellHash.get(key).push(c);
          seeds.push(c);
        };
        const fixed = seeds.slice();
        seeds = [];
        fixed.forEach(addSeed);
        const order = Int32Array.from(b.cells);
        for (let i = order.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
        for (let oi = 0; oi < order.length && seeds.length < k * 1.4; oi++) {
          const c = order[oi];
          const x = c % W, y = (c / W) | 0;
          const gx = Math.floor(x / spacing), gy = Math.floor(y / spacing);
          let ok = true;
          for (let oy = -1; oy <= 1 && ok; oy++) {
            for (let ox = -1; ox <= 1 && ok; ox++) {
              const bucket = cellHash.get((gx + ox) + ":" + (gy + oy));
              if (!bucket) continue;
              for (const q of bucket) {
                if ((q % W - x) ** 2 + (((q / W) | 0) - y) ** 2 < spacing * spacing) { ok = false; break; }
              }
            }
          }
          if (ok) addSeed(c);
        }
      }
      // two Lloyd passes: move each seed to its piece's most central cell
      const fixedCount = Math.min(seeds.length, (seedsIn.get(b.id) || []).length);
      for (let it = 0; it < 2 && seeds.length > 1; it++) {
        geodesic(b.cells, seeds, 0, tmpLabels);
        const sums = seeds.map(() => [0, 0, 0]);
        for (const c of b.cells) { const l = tmpLabels[c]; if (l >= 0 && sums[l]) { sums[l][0] += c % W; sums[l][1] += (c / W) | 0; sums[l][2]++; } }
        const bestC = seeds.map(() => [-1, Infinity]);
        for (const c of b.cells) {
          const l = tmpLabels[c];
          if (l < 0 || !sums[l][2]) continue;
          const d = (c % W - sums[l][0] / sums[l][2]) ** 2 + (((c / W) | 0) - sums[l][1] / sums[l][2]) ** 2;
          if (d < bestC[l][1]) { bestC[l][1] = d; bestC[l][0] = c; }
        }
        seeds = seeds.map((s, l) => (l < fixedCount || bestC[l][0] < 0 ? s : bestC[l][0]));
      }
      geodesic(b.cells, seeds, nAtoms, atom);
      for (let l = 0; l < seeds.length; l++) atomMeta.push({ block: b.id, group: b.group, basin: b.basin, land: b.land, region: b.region });
      nAtoms += seeds.length;
    });

    T.push(Date.now());
    // 3) cells left over (river and isthmus cells, slivers no piece reached) join the
    //    neighbouring piece of their landmass they touch most — layer by layer, so an
    //    isthmus is shared out from both ends and its border lands in the middle. A
    //    diagonal neighbour counts only when it does not reach past a corner of another piece.
    {
      const vA = new Int32Array(8), vW = new Int32Array(8);
      const vote = (i) => {
        const cx = i % W, cy = (i / W) | 0, L = lid[i];
        let n = 0;
        for (let k = 0; k < 8; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx, a = atom[j];
          if (a < 0 || lid[j] !== L) continue;
          if (isMount(i) && atomMeta[a].group === 2 && atomMeta[a].basin !== basin[i]) continue;
          if (k >= 4 && atom[cy * W + xx] !== a && atom[yy * W + cx] !== a) continue;
          let m = 0;
          while (m < n && vA[m] !== a) m++;
          if (m === n) { vA[n] = a; vW[n] = 0; n++; }
          vW[m] += k < 4 ? 2 : 1;
        }
        let best = -1, bv = 0;
        for (let m = 0; m < n; m++) if (vW[m] > bv || (vW[m] === bv && vA[m] < best)) { bv = vW[m]; best = vA[m]; }
        return best;
      };
      const stamp = new Int32Array(N);
      let layer = 1;
      let frontier = [];
      for (let i = 0; i < N; i++) if (lid[i] >= 0 && atom[i] < 0) frontier.push(i);
      while (frontier.length) {
        const decided = [];
        for (const i of frontier) { const a = vote(i); if (a >= 0) decided.push(i, a); }
        if (!decided.length) break;
        for (let k = 0; k < decided.length; k += 2) atom[decided[k]] = decided[k + 1];
        layer++;
        const next = [];
        for (let k = 0; k < decided.length; k += 2) {
          const i = decided[k], cx = i % W, cy = (i / W) | 0;
          for (let d = 0; d < 8; d++) {
            const xx = cx + NX[d], yy = cy + NY[d];
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (atom[j] < 0 && lid[j] >= 0 && stamp[j] !== layer) { stamp[j] = layer; next.push(j); }
          }
        }
        frontier = next;
      }
      // land no piece reaches (a speck cut off by rivers…): pieces of its own
      for (let s = 0; s < N; s++) {
        if (lid[s] < 0 || atom[s] >= 0) continue;
        const id = nAtoms++, L = lid[s];
        let qh = 0, qt = 0, reg = -1;
        queue[qt++] = s; atom[s] = id;
        while (qh < qt) {
          const c = queue[qh++];
          if (reg < 0) reg = region[c];
          const cx = c % W, cy = (c / W) | 0;
          for (let k = 0; k < 4; k++) {
            const xx = cx + NX[k], yy = cy + NY[k];
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const n = yy * W + xx;
            if (atom[n] < 0 && lid[n] === L) { atom[n] = id; queue[qt++] = n; }
          }
        }
        atomMeta.push({ block: -1, group: groupOf(s), basin: basin[s], land: L, region: reg });
      }
    }

    // 4) merge small atoms into an allowed neighbour (union-find over atoms).
    T.push(Date.now());
    //    A CREST is a boundary between two mountain pieces that runs along high ground:
    //    its mean height stands well above both pieces. Pieces separated by a crest never
    //    end up in one province; pieces side by side on the same slope (divided only by a
    //    spur that falls away toward the lowland) may. Neither may pieces of two landmasses
    //    or of two regions (the land on either side of an isthmus), and a merge needs a
    //    real stretch of shared border, not a touch at a corner of the coast.
    const area = new Int32Array(nAtoms);
    const mStat = new Float64Array(nAtoms * 4); // sum, count, min, max of mountain cells
    for (let a = 0; a < nAtoms; a++) { mStat[a * 4 + 2] = 1e9; mStat[a * 4 + 3] = -1e9; }
    for (let i = 0; i < N; i++) {
      const a = atom[i];
      if (a < 0) continue;
      area[a]++;
      if (isMount(i)) {
        const o = a * 4;
        mStat[o] += h[i]; mStat[o + 1]++;
        if (h[i] < mStat[o + 2]) mStat[o + 2] = h[i];
        if (h[i] > mStat[o + 3]) mStat[o + 3] = h[i];
      }
    }
    const pairKey = (a, b) => (a < b ? a * nAtoms + b : b * nAtoms + a);
    const bStat = new Map(); // mountain-mountain boundary: [sum of max h, count, max]
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const a = atom[i];
        if (a < 0 || !isMount(i)) continue;
        for (let k = 0; k < 2; k++) {
          const xx = x + NX[k * 2], yy = y + NY[k * 2];
          if (xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          const b = atom[j];
          if (b < 0 || b === a || !isMount(j)) continue;
          const key = pairKey(a, b);
          let st = bStat.get(key);
          if (!st) bStat.set(key, (st = [0, 0, -1e9]));
          const mh = Math.max(h[i], h[j]);
          st[0] += mh; st[1]++;
          if (mh > st[2]) st[2] = mh;
        }
      }
    }
    const crest = new Set();
    bStat.forEach((st, key) => {
      if (st[1] < 3) return;
      const a = Math.floor(key / nAtoms), b = key - a * nAtoms;
      const meanA = mStat[a * 4] / Math.max(1, mStat[a * 4 + 1]), meanB = mStat[b * 4] / Math.max(1, mStat[b * 4 + 1]);
      const lo = Math.min(mStat[a * 4 + 2], mStat[b * 4 + 2]);
      const mean = st[0] / st[1];
      if (mean - Math.max(meanA, meanB) > 0.22 * Math.max(300, st[2] - lo)) crest.add(key);
    });

    const parent = new Int32Array(nAtoms);
    for (let a = 0; a < nAtoms; a++) parent[a] = a;
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const lidOf = new Int32Array(nAtoms), regOf = new Int32Array(nAtoms);
    for (let a = 0; a < nAtoms; a++) { lidOf[a] = atomMeta[a].land; regOf[a] = atomMeta[a].region; }
    // per group: its mountain pieces (for crest checks) and whether it holds lowland
    const mountList = atomMeta.map((m, a) => (mStat[a * 4 + 1] > area[a] * 0.5 ? [a] : []));
    const hasLow = atomMeta.map((m, a) => mStat[a * 4 + 1] <= area[a] * 0.5);
    const mountOnly = (a) => !hasLow[a];
    const canMerge = (a, b) => {
      if (lidOf[a] !== lidOf[b]) return false;
      if (regOf[a] >= 0 && regOf[b] >= 0 && regOf[a] !== regOf[b]) return false;
      if (separate && (mountOnly(a) !== mountOnly(b))) return false;
      const la = mountList[a], lb = mountList[b];
      for (let i = 0; i < la.length; i++) for (let j = 0; j < lb.length; j++) if (crest.has(pairKey(la[i], lb[j]))) return false;
      return true;
    };
    const adjacency = () => {
      const adj = new Map();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (atom[i] < 0) continue;
          const a = find(atom[i]);
          for (let k = 0; k < 2; k++) {
            const xx = x + NX[k * 2], yy = y + NY[k * 2];
            if (xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (atom[j] < 0 || lid[j] !== lid[i]) continue;
            const b = find(atom[j]);
            if (a === b) continue;
            // a major river is a border when that option is on
            if (riverMask && (riverMask[i] || riverMask[j])) continue;
            const key = pairKey(a, b);
            adj.set(key, (adj.get(key) || 0) + 1);
          }
        }
      }
      return adj;
    };
    const mergeRound = (isSmall, sameKindBonus, minLen) => {
      const adj = adjacency();
      const nbrs = new Map();
      adj.forEach((len, key) => {
        const a = Math.floor(key / nAtoms), b = key - a * nAtoms;
        if (!nbrs.has(a)) nbrs.set(a, []);
        if (!nbrs.has(b)) nbrs.set(b, []);
        nbrs.get(a).push([b, len]);
        nbrs.get(b).push([a, len]);
      });
      const roots = [];
      for (let a = 0; a < nAtoms; a++) if (find(a) === a) roots.push(a);
      roots.sort((p, q) => area[p] - area[q] || p - q);
      let merged = 0;
      for (const a0 of roots) {
        const a = find(a0);
        if (a !== a0 || !isSmall(a)) continue;
        let best = -1, bl = 0;
        (nbrs.get(a) || []).forEach(([b0, len]) => {
          const b = find(b0);
          if (b === a || len < minLen || !canMerge(a, b)) return;
          const same = mountOnly(a) === mountOnly(b);
          const score = len * (same ? sameKindBonus : 1) / Math.sqrt(1 + area[b] / A);
          if (score > bl) { bl = score; best = b; }
        });
        if (best < 0) continue;
        parent[a] = best;
        area[best] += area[a];
        mountList[best] = mountList[best].concat(mountList[a]);
        hasLow[best] = hasLow[best] || hasLow[a];
        if (regOf[best] < 0) regOf[best] = regOf[a];
        merged++;
      }
      return merged;
    };
    const minTouch = Math.max(2, 0.25 * S);
    for (let round = 0; round < 5; round++) {
      const merged = mergeRound((a) => (mountOnly(a) ? area[a] < A * (separate ? 0.35 : 0.8) : area[a] < A * 0.45), 2, minTouch);
      if (!merged) break;
    }
    // what is still small joins over a shorter border; crumbs join any allowed neighbour
    for (let round = 0; round < 3; round++) {
      if (!mergeRound((a) => area[a] < A * 0.2, 1, 2)) break;
    }
    for (let round = 0; round < 3; round++) {
      if (!mergeRound((a) => area[a] < A * 0.08, 1, 1)) break;
    }

    T.push(Date.now());
    // 5) every province is one piece of land. A piece cut off from the rest of its
    //    province (pieces that met only at a corner…) joins the neighbour it shares the
    //    most border with, or stands alone when it is big or has no neighbour it may join.
    const piece = new Int32Array(N).fill(-1);
    const pieceArea = [], pieceRoot = [];
    for (let s = 0; s < N; s++) {
      if (atom[s] < 0 || piece[s] >= 0) continue;
      const r = find(atom[s]), id = pieceArea.length;
      let qh = 0, qt = 0;
      queue[qt++] = s; piece[s] = id;
      while (qh < qt) {
        const c = queue[qh++];
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const n = yy * W + xx;
          if (piece[n] < 0 && atom[n] >= 0 && lid[n] === lid[s] && find(atom[n]) === r) { piece[n] = id; queue[qt++] = n; }
        }
      }
      pieceArea.push(qt); pieceRoot.push(r);
    }
    const nPieces = pieceArea.length;
    const mainPiece = new Int32Array(nAtoms).fill(-1);
    for (let p = 0; p < nPieces; p++) {
      const r = pieceRoot[p], m = mainPiece[r];
      if (m < 0 || pieceArea[p] > pieceArea[m]) mainPiece[r] = p;
    }
    // province id of each piece: the atom root for main pieces, nAtoms + piece for pieces
    // standing alone, -1 while undecided
    const NP = nAtoms + nPieces;
    const provOf = new Int32Array(nPieces).fill(-1);
    const provRegion = (P) => (P < nAtoms ? regOf[P] : regOf[pieceRoot[P - nAtoms]]);
    let detached = 0;
    for (let p = 0; p < nPieces; p++) {
      if (mainPiece[pieceRoot[p]] === p) provOf[p] = pieceRoot[p];
      else { detached++; if (pieceArea[p] >= 0.35 * A) provOf[p] = nAtoms + p; }
    }
    for (let round = 0; detached && round < 6; round++) {
      const contact = new Map(); // piece * NP + province -> shared border
      const note = (p, q) => {
        if (provOf[p] >= 0 || provOf[q] < 0) return;
        const P = provOf[q], rp = regOf[pieceRoot[p]], rq = provRegion(P);
        if (rp >= 0 && rq >= 0 && rp !== rq) return;
        const key = p * NP + P;
        contact.set(key, (contact.get(key) || 0) + 1);
      };
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x, p = piece[i];
          if (p < 0) continue;
          for (let k = 0; k < 2; k++) {
            const xx = x + NX[k * 2], yy = y + NY[k * 2];
            if (xx >= W || yy >= H) continue;
            const j = yy * W + xx, q = piece[j];
            if (q < 0 || q === p || lid[j] !== lid[i]) continue;
            note(p, q); note(q, p);
          }
        }
      }
      const bestP = new Map();
      contact.forEach((len, key) => {
        const p = Math.floor(key / NP), P = key - p * NP;
        const cur = bestP.get(p);
        if (!cur || len > cur[1] || (len === cur[1] && P < cur[0])) bestP.set(p, [P, len]);
      });
      if (!bestP.size) break;
      bestP.forEach((v, p) => { provOf[p] = v[0]; });
    }
    for (let p = 0; p < nPieces; p++) if (provOf[p] < 0) provOf[p] = nAtoms + p;

    T.push(Date.now());
    // 6) islets: a speck of land joins the nearest coast within reach (a province of a
    //    cell or two means nothing); with opts.joinIslets every islet does. The coast must
    //    belong to a bigger landmass, so a cluster of islets gathers round its biggest one.
    const joinParent = new Int32Array(NP);
    for (let P = 0; P < NP; P++) joinParent[P] = P;
    const joinFind = (P) => { while (joinParent[P] !== P) { joinParent[P] = joinParent[joinParent[P]]; P = joinParent[P]; } return P; };
    const tinyA = Math.max(6, 0.015 * A), tinyD = Math.max(2, Math.round(0.15 * S));
    const isleA = Math.max(4, 0.35 * A), isleD = clamp(Math.round(0.6 * S), 2, 10);
    const limitA = opts.joinIslets ? Math.max(tinyA, isleA) : tinyA;
    let isletsJoined = 0;
    {
      const small = [];
      for (let L = 0; L < nLand; L++) if (lmArea[L] > 0 && lmArea[L] < limitA) small.push(L);
      if (small.length) {
        small.sort((a, b) => lmArea[a] - lmArea[b] || a - b);
        const isSmall = new Uint8Array(nLand);
        small.forEach((L) => { isSmall[L] = 1; });
        const cellsOf = new Map();
        for (let i = 0; i < N; i++) if (lid[i] >= 0 && isSmall[lid[i]]) { if (!cellsOf.has(lid[i])) cellsOf.set(lid[i], []); cellsOf.get(lid[i]).push(i); }
        const seen = new Int32Array(N);
        for (const L of small) {
          const cells = cellsOf.get(L);
          const own = joinFind(provOf[piece[cells[0]]]);
          if (cells.some((c) => joinFind(provOf[piece[c]]) !== own)) continue; // an islet cut into provinces is no speck
          const maxD = lmArea[L] < tinyA ? tinyD : isleD;
          let frontier = cells.slice();
          cells.forEach((c) => { seen[c] = L + 1; });
          const hits = new Map();
          for (let d = 0; d < maxD && frontier.length && !hits.size; d++) {
            const next = [];
            for (const c of frontier) {
              const cx = c % W, cy = (c / W) | 0;
              for (let k = 0; k < 8; k++) {
                const xx = cx + NX[k], yy = cy + NY[k];
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                const j = yy * W + xx;
                if (seen[j] === L + 1) continue;
                seen[j] = L + 1;
                const M = lid[j];
                if (M >= 0 && M !== L && (lmArea[M] > lmArea[L] || (lmArea[M] === lmArea[L] && M < L))) {
                  const P = joinFind(provOf[piece[j]]);
                  if (P !== own) hits.set(P, (hits.get(P) || 0) + 1);
                } else next.push(j);
              }
            }
            frontier = next;
          }
          if (!hits.size) continue;
          let target = -1, tv = 0;
          hits.forEach((v, P) => { if (v > tv || (v === tv && P < target)) { tv = v; target = P; } });
          joinParent[own] = target;
          isletsJoined++;
        }
      }
    }

    T.push(Date.now());
    // 7) compact labels in reading order, and what each province is made of
    const labelOf = new Int32Array(NP).fill(-1);
    const labels = new Int32Array(N).fill(-1);
    let nLabels = 0;
    for (let i = 0; i < N; i++) {
      if (piece[i] < 0) continue;
      const P = joinFind(provOf[piece[i]]);
      if (labelOf[P] < 0) labelOf[P] = nLabels++;
      labels[i] = labelOf[P];
    }
    // per province: cells, mountain cells, isthmus land, its landmasses (most provinces
    // lie on one) and its main basin (two-slot majority vote)
    const cellsN = new Int32Array(nLabels), mountN = new Int32Array(nLabels), neckIn = new Uint8Array(nLabels);
    const land0 = new Int32Array(nLabels).fill(-1), moreLands = new Map();
    const bA = new Int32Array(nLabels).fill(-1), cA = new Int32Array(nLabels), bB = new Int32Array(nLabels).fill(-1), cB = new Int32Array(nLabels);
    for (let i = 0; i < N; i++) {
      const l = labels[i];
      if (l < 0) continue;
      cellsN[l]++;
      if (isMount(i)) mountN[l]++;
      if (neck[i]) neckIn[l] = 1;
      const L = lid[i];
      if (land0[l] < 0) land0[l] = L;
      else if (L !== land0[l]) {
        let m = moreLands.get(l);
        if (!m) moreLands.set(l, (m = new Map()));
        m.set(L, (m.get(L) || 0) + 1);
      }
      const b = basin[i];
      if (b < 0) continue;
      if (bA[l] === b) cA[l]++;
      else if (bB[l] === b) cB[l]++;
      else if (!cA[l]) { bA[l] = b; cA[l] = 1; }
      else if (!cB[l]) { bB[l] = b; cB[l] = 1; }
      else { cA[l]--; cB[l]--; }
    }
    const meta = [];
    for (let l = 0; l < nLabels; l++) {
      let land = land0[l], lands = 1;
      const more = moreLands.get(l);
      if (more) {
        // the landmass holding most of the province (joined islets are the rest)
        let own = cellsN[l];
        more.forEach((v) => { own -= v; });
        let bv = own;
        more.forEach((v, L) => { lands++; if (v > bv) { bv = v; land = L; } });
      }
      meta.push({ cells: cellsN[l], land, lands, mount: Math.round(mountN[l] / Math.max(1, cellsN[l]) * 100) / 100,
        basin: cA[l] >= cB[l] ? bA[l] : bB[l], neck: neckIn[l], city: 0 });
    }
    seedCells.forEach((c) => { if (labels[c] >= 0) meta[labels[c]].city = 1; });

    // what the borders follow, for "show what I cut along" and the report
    const why = new Uint8Array(N);
    const straits = new Set(), crestPairs = new Set();
    const bigLand = (L) => lmArea[L] >= Math.max(4, tinyA);
    const strait = (a, b) => { if (a !== b && bigLand(a) && bigLand(b)) straits.add(a < b ? a * nLand + b : b * nLand + a); };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (lid[i] < 0) {
          if (h[i] <= 0) continue;
          // a cell where two landmasses meet: the strait runs through it
          const seenL = [];
          for (let k = 0; k < 8; k++) {
            const xx = x + NX[k], yy = y + NY[k];
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const L = lid[yy * W + xx];
            if (L >= 0 && seenL.indexOf(L) < 0) { seenL.forEach((M) => strait(L, M)); seenL.push(L); }
          }
          continue;
        }
        if (neck[i]) why[i] = 2;
        else if (riverMask && riverMask[i]) why[i] = 3;
        for (let k = 0; k < 4; k++) {
          const xx = x + NX[k], yy = y + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (lid[j] >= 0 && lid[j] !== lid[i]) { why[i] = 1; strait(lid[i], lid[j]); }
          else if (lid[j] < 0 && h[j] > 0) why[i] = 1;
          else if (lid[j] === lid[i] && isMount(i) && isMount(j) && labels[j] !== labels[i] && crest.has(pairKey(atom[i], atom[j]))) {
            if (!why[i]) why[i] = 4;
            const a = labels[i], b = labels[j];
            crestPairs.add(a < b ? a * nLabels + b : b * nLabels + a);
          }
        }
      }
    }
    T.push(Date.now());
    const report = { provinces: nLabels, straits: straits.size, isthmuses: nNecks, crests: crestPairs.size, islets: isletsJoined,
      ms: T.slice(1).map((t, k) => t - T[k]) };
    return { labels, count: nLabels, meta, why, report };
  };

  // ---------- exact polygons from a label raster ----------
  // Boundary edges between differently labelled cells, chained into rings per label.
  // Neighbouring provinces share every vertex exactly, so a topology can be built
  // without slivers. Returns MultiPolygon coordinates per label, lattice units.
  TA.labelPolygons = function (labels, W, H, count) {
    const edgesByLabel = Array.from({ length: count }, () => []);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : labels[y * W + x]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const L = labels[y * W + x];
        if (L < 0) continue;
        const e = edgesByLabel[L];
        // clockwise on screen (y down): top, right, bottom, left — interior on the right
        if (at(x, y - 1) !== L) e.push(x, y, x + 1, y);
        if (at(x + 1, y) !== L) e.push(x + 1, y, x + 1, y + 1);
        if (at(x, y + 1) !== L) e.push(x + 1, y + 1, x, y + 1);
        if (at(x - 1, y) !== L) e.push(x, y + 1, x, y);
      }
    }
    const key = (x, y) => y * (W + 1) + x;
    const out = [];
    for (let L = 0; L < count; L++) {
      const e = edgesByLabel[L];
      const m = e.length / 4;
      const byStart = new Map();
      for (let k = 0; k < m; k++) {
        const s = key(e[4 * k], e[4 * k + 1]);
        if (!byStart.has(s)) byStart.set(s, []);
        byStart.get(s).push(k);
      }
      const used = new Uint8Array(m);
      const rings = [];
      for (let k0 = 0; k0 < m; k0++) {
        if (used[k0]) continue;
        const ring = [];
        let k = k0;
        let guard = 0;
        while (!used[k] && guard++ <= m) {
          used[k] = 1;
          const x0 = e[4 * k], y0 = e[4 * k + 1], x1 = e[4 * k + 2], y1 = e[4 * k + 3];
          ring.push([x0, y0]);
          const cand = (byStart.get(key(x1, y1)) || []).filter((c) => !used[c]);
          if (!cand.length) break;
          if (cand.length === 1) { k = cand[0]; continue; }
          // pinch vertex: turn right first (keeps diagonal-touching parts as separate rings)
          const dx = x1 - x0, dy = y1 - y0;
          let best = cand[0], bestRank = 9;
          cand.forEach((c) => {
            const ex = e[4 * c + 2] - e[4 * c], ey = e[4 * c + 3] - e[4 * c + 1];
            const cross = dx * ey - dy * ex; // y down: > 0 is a right turn
            const rank = cross > 0 ? 0 : cross === 0 ? 1 : 2;
            if (rank < bestRank) { bestRank = rank; best = c; }
          });
          k = best;
        }
        if (ring.length < 4) continue;
        // drop collinear vertices
        const simp = [];
        for (let i = 0; i < ring.length; i++) {
          const p = ring[(i + ring.length - 1) % ring.length], c = ring[i], n = ring[(i + 1) % ring.length];
          if ((c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]) !== 0) simp.push(c);
        }
        simp.push([simp[0][0], simp[0][1]]);
        let a2 = 0;
        for (let i = 0; i < simp.length - 1; i++) a2 += simp[i][0] * simp[i + 1][1] - simp[i + 1][0] * simp[i][1];
        rings.push({ ring: simp, area: a2 / 2 });
      }
      const exteriors = rings.filter((r) => r.area > 0).map((r) => ({ r, holes: [] }));
      rings.filter((r) => r.area < 0).forEach((hole) => {
        const p = hole.ring[0];
        // point just inside the hole's first edge (holes run counter-clockwise)
        const q = hole.ring[1];
        const px = (p[0] + q[0]) / 2 + (q[1] - p[1]) * 0.25, py = (p[1] + q[1]) / 2 - (q[0] - p[0]) * 0.25;
        let host = null;
        for (const ex of exteriors) {
          if (pointInRing(ex.r.ring, px, py) && (!host || ex.r.area < host.r.area)) host = ex;
        }
        if (host) host.holes.push(hole.ring);
      });
      out.push(exteriors.map((ex) => [ex.r.ring].concat(ex.holes)));
    }
    return out;
  };
  function pointInRing(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  TA.pointInRing = pointInRing;

  // ---------- line helpers ----------
  TA.chaikin = function (pts, iter, closed) {
    let out = pts;
    for (let it = 0; it < iter; it++) {
      if (out.length < 3) break;
      const nx = closed ? [] : [out[0]];
      const n = closed ? out.length - 1 : out.length - 1;
      for (let i = 0; i < n; i++) {
        const a = out[i], b = out[i + 1];
        nx.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      if (closed) nx.push([nx[0][0], nx[0][1]]);
      else nx.push(out[out.length - 1]);
      out = nx;
    }
    return out;
  };
  function distToSeg(x, y, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const L = vx * vx + vy * vy;
    let t = L ? ((x - a[0]) * vx + (y - a[1]) * vy) / L : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(a[0] + vx * t - x, a[1] + vy * t - y);
  }
  TA.distToSeg = distToSeg;
  TA.rdp = function (pts, eps) {
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
  };

  // smooth every shared arc once (endpoints fixed) so borders stay seamless.
  // Needs topojson-server + topojson-client.
  TA.smoothProvinceTopology = function (multiPolys, topojsonLib, opts) {
    opts = opts || {};
    const fc = { type: "FeatureCollection", features: multiPolys.map((mp, i) => ({
      type: "Feature", id: i, properties: {}, geometry: { type: "MultiPolygon", coordinates: mp } })) };
    const topo = topojsonLib.topology({ p: fc });
    const iters = opts.iterations == null ? 2 : opts.iterations;
    topo.arcs = topo.arcs.map((arc) => {
      if (arc.length < 3) return arc;
      const closed = arc[0][0] === arc[arc.length - 1][0] && arc[0][1] === arc[arc.length - 1][1];
      let sm = TA.chaikin(arc, iters, closed);
      sm = TA.rdp(sm, opts.epsilon == null ? 0.12 : opts.epsilon);
      if (closed && (sm[0][0] !== sm[sm.length - 1][0] || sm[0][1] !== sm[sm.length - 1][1])) sm.push([sm[0][0], sm[0][1]]);
      return sm.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
    });
    const out = topojsonLib.feature(topo, topo.objects.p);
    return out.features.map((f) => f.geometry);
  };

  // ---------- river polylines (data units) ----------
  TA.polylineLength = function (pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  };
  // points every `step` along a polyline, first and last point included
  TA.resamplePolyline = function (pts, step) {
    const P = [];
    if (!pts.length) return P;
    P.push([pts[0][0], pts[0][1]]);
    let carry = 0; // distance since the last emitted sample
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!seg) continue;
      let t = step - carry;
      while (t <= seg) {
        P.push([a[0] + (b[0] - a[0]) * t / seg, a[1] + (b[1] - a[1]) * t / seg]);
        t += step;
      }
      carry = seg - (t - step);
    }
    const last = pts[pts.length - 1], pl = P[P.length - 1];
    if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > 1e-6) P.push([last[0], last[1]]);
    return P;
  };
  // the first `along` units of a polyline (at least its first point)
  TA.cutPolyline = function (pts, along) {
    const out = [[pts[0][0], pts[0][1]]];
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + seg >= along) {
        const u = seg ? (along - acc) / seg : 0;
        if (u > 1e-6) out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
        return out;
      }
      out.push([b[0], b[1]]);
      acc += seg;
    }
    return out;
  };
  // nearest point on polyline `q` to p, within tol: { d, point, along } or null
  function nearestOnPolyline(q, p, tol) {
    let best = null, acc = 0;
    for (let k = 0; k < q.length - 1; k++) {
      const a = q[k], b = q[k + 1];
      const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy, sL = Math.sqrt(L2);
      const lim = best ? best.d : tol;
      if (Math.min(a[0], b[0]) - lim > p[0] || Math.max(a[0], b[0]) + lim < p[0] ||
          Math.min(a[1], b[1]) - lim > p[1] || Math.max(a[1], b[1]) + lim < p[1]) { acc += sL; continue; }
      let t = L2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0;
      t = clamp(t, 0, 1);
      const qx = a[0] + vx * t, qy = a[1] + vy * t;
      const d = Math.hypot(qx - p[0], qy - p[1]);
      if (d <= lim) best = { d, point: [qx, qy], along: acc + sL * t };
      acc += sL;
    }
    return best;
  }
  TA.nearestOnPolyline = nearestOnPolyline;

  // A drawn river network: a river whose mouth lies on another river flows into it.
  // Returns per river: into (index or -1), joinAt (distance along the receiving
  // river), Strahler order, upstream length (own + everything flowing in), depth
  // (links to the river that reaches water), kids.
  TA.riverNetwork = function (list, tol) {
    const n = list.length;
    const len = list.map((pts) => TA.polylineLength(pts));
    const into = new Int32Array(n).fill(-1);
    const joinAt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const pts = list[i];
      if (pts.length < 2) continue;
      const m = pts[pts.length - 1];
      let best = null, bj = -1;
      for (let j = 0; j < n; j++) {
        if (j === i || list[j].length < 2) continue;
        const hit = nearestOnPolyline(list[j], m, best ? best.d : tol);
        if (hit && (!best || hit.d < best.d)) { best = hit; bj = j; }
      }
      if (bj >= 0) { into[i] = bj; joinAt[i] = best.along; }
    }
    // two rivers ending on each other: the longer one keeps flowing on
    for (let i = 0; i < n; i++) {
      const seen = new Set();
      let c = i;
      while (c >= 0 && !seen.has(c)) { seen.add(c); c = into[c]; }
      if (c < 0) continue;
      let x = c, longest = c;
      do { if (len[x] > len[longest]) longest = x; x = into[x]; } while (x !== c);
      into[longest] = -1;
    }
    const kids = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) if (into[i] >= 0) kids[into[i]].push(i);
    const depth = new Int32Array(n);
    for (let i = 0; i < n; i++) { let d = 0, c = into[i]; while (c >= 0 && d <= n) { d++; c = into[c]; } depth[i] = d; }
    const order = new Uint8Array(n), upLen = new Float32Array(n);
    Array.from({ length: n }, (_, i) => i).sort((a, b) => depth[b] - depth[a]).forEach((i) => {
      let up = len[i], maxO = 1, cnt = 1; // the river's own headwater is an order-1 stream
      kids[i].forEach((c) => {
        up += upLen[c];
        if (order[c] > maxO) { maxO = order[c]; cnt = 1; } else if (order[c] === maxO) cnt++;
      });
      order[i] = Math.min(12, cnt >= 2 ? maxO + 1 : maxO);
      upLen[i] = up;
    });
    return { into, joinAt, order, upLen, len, depth, kids };
  };

  function boxBlur(a, W, H, r, tmp) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let acc = 0, cnt = 0;
      for (let x = -r; x < W; x++) {
        const add = x + r, rem = x - r - 1;
        if (add < W) { acc += a[row + add]; cnt++; }
        if (rem >= 0) { acc -= a[row + rem]; cnt--; }
        if (x >= 0) tmp[row + x] = acc / cnt;
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0, cnt = 0;
      for (let y = -r; y < H; y++) {
        const add = y + r, rem = y - r - 1;
        if (add < H) { acc += tmp[add * W + x]; cnt++; }
        if (rem >= 0) { acc -= tmp[rem * W + x]; cnt--; }
        if (y >= 0) a[y * W + x] = acc / cnt;
      }
    }
  }
  TA.boxBlur = boxBlur;

  // ---------- the geography pass ----------
  // Nothing in a custom world is simulated behind the painter's back. When asked, this
  // pass makes the drawing geographically plausible and returns edited copies of the
  // rasters and the rivers; the page previews them before anything is committed.
  //   foothills — hills between lowland and mountains instead of a cliff
  //   erosion   — running water cuts valleys into the slopes (reshapes mountains)
  //   fixRivers — drawn rivers run from source to mouth, reach water or another river,
  //               and get a bed that keeps falling (a gorge where they cross a ridge)
  //   lakes     — lakes where water collects in closed basins
  //   addRivers — rivers and tributaries where the runoff concentrates; rivers an earlier
  //               pass added are replaced unless they were named, noted or adjusted
  //   tributaries — every river the painter drew gets its own system: its catchment is as
  //               wet as a river that size needs, and streams gather into it (marked trib;
  //               with addRivers off only those are replaced)
  //   biomes    — land cover from the climate, with green valleys along rivers; cover the
  //               pass painted before (COVER_AUTO bit) is repainted, cover painted by hand
  //               stays (all of it is repainted with repaintAll)
  // input: { RW, RH, RES, GW, GH, height: ArrayBuffer (Int16, metres above datum),
  //   cover: ArrayBuffer (Uint8, js/world.js COVER), rivers: [{ id, name, pts, … }],
  //   riverNames: { key: { name, notes, anchor } } (names of rivers from older versions),
  //   seaLevel, climate, seed, scaleKm, riverThreshold, opts }
  // output: { height, cover (ArrayBuffers), rivers, report }
  TA.COVER_AUTO = 128; // cover the geography pass painted (bit on the cover value)
  TA.geography = function (inp) {
    const RW = inp.RW, RH = inp.RH, RES = inp.RES, W = inp.GW, H = inp.GH;
    const N2 = RW * RH, N = W * H;
    const sl = +inp.seaLevel || 0;
    const opts = inp.opts || {};
    const seed = (Math.abs(inp.seed | 0) % 100000) + 7;
    const kmUnit = +inp.scaleKm || 5; // km per data unit
    const src = new Int16Array(inp.height);
    const C = new Uint8Array(inp.cover);
    const rel = new Float32Array(N2);
    for (let i = 0; i < N2; i++) rel[i] = src[i] - sl;
    const report = { reversed: [], extended: [], gorges: [], added: 0, tributaries: 0, replaced: 0, named: 0,
      lakes: 0, lakeKm2: 0, biomePct: null, foothillsKm2: null, erosion: false, systems: [], valleysKm2: 0 };
    const climOpts = Object.assign({}, inp.climate || {}, { km: kmUnit });
    const r2 = (v) => Math.round(v * 100) / 100;
    const rIdx = (x, y) => clamp(Math.floor(y * RES), 0, RH - 1) * RW + clamp(Math.floor(x * RES), 0, RW - 1);
    const relAt = (p) => rel[rIdx(p[0], p[1])];
    const gIdx = (x, y) => clamp(Math.floor(y), 0, H - 1) * W + clamp(Math.floor(x), 0, W - 1);
    const waterNear = (p, rad) => {
      const r = Math.ceil(rad * RES), cx = Math.floor(p[0] * RES), cy = Math.floor(p[1] * RES);
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= RH) continue;
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx;
          if (x < 0 || x >= RW || dx * dx + dy * dy > r * r) continue;
          if (rel[y * RW + x] <= 0) return true;
        }
      }
      return false;
    };
    const atEdge = (p) => p[0] <= 1 || p[1] <= 1 || p[0] >= W - 1 || p[1] >= H - 1;
    const gridHeights = () => TA.downsample(rel, RW, RH, RES, W, H);
    let rivers = (inp.rivers || []).filter((r) => r && Array.isArray(r.pts) && r.pts.length >= 2)
      .map((r) => Object.assign({}, r, { pts: r.pts.map((q) => [+q[0], +q[1]]) }));
    const nearestRiver = (p, tol, skip) => {
      let best = null;
      rivers.forEach((r, j) => {
        if (j === skip) return;
        const hit = nearestOnPolyline(r.pts, p, best ? best.d : tol);
        if (hit && (!best || hit.d < best.d)) { best = hit; best.j = j; }
      });
      return best;
    };
    // a point on another river's course — not merely at its mouth, which two rivers may
    // share without one flowing into the other
    const onRiverBody = (p, tol, skip) => {
      let best = null;
      rivers.forEach((r, j) => {
        if (j === skip) return;
        const hit = nearestOnPolyline(r.pts, p, best ? best.d : tol);
        const e = r.pts[r.pts.length - 1];
        if (!hit || Math.hypot(hit.point[0] - e[0], hit.point[1] - e[1]) < 0.3) return;
        if (!best || hit.d < best.d) { best = hit; best.j = j; }
      });
      return best;
    };

    // ---- corridor rasterisation (cells within radius of densely sampled points) ----
    const dBuf = new Float32Array(N2).fill(Infinity);
    const sBuf = new Int32Array(N2);
    const touched = new Int32Array(N2);
    const corridor = (P, radius, fn) => {
      const rr = radius * RES, R = Math.ceil(rr);
      let nt = 0;
      for (let s = 0; s < P.length; s++) {
        const px = P[s][0] * RES, py = P[s][1] * RES;
        const x0 = Math.max(0, Math.floor(px - R)), x1 = Math.min(RW - 1, Math.ceil(px + R));
        const y0 = Math.max(0, Math.floor(py - R)), y1 = Math.min(RH - 1, Math.ceil(py + R));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - px, dy = y + 0.5 - py;
            const d = Math.sqrt(dx * dx + dy * dy) / rr;
            if (d > 1) continue;
            const i = y * RW + x;
            if (dBuf[i] === Infinity) touched[nt++] = i;
            if (d < dBuf[i]) { dBuf[i] = d; sBuf[i] = s; }
          }
        }
      }
      for (let k = 0; k < nt; k++) { const i = touched[k]; fn(i, dBuf[i], sBuf[i]); dBuf[i] = Infinity; }
    };

    // ---- 1. foothills ----
    if (opts.foothills) {
      const ex = new Float32Array(N2), tmp = new Float32Array(N2);
      for (let i = 0; i < N2; i++) ex[i] = rel[i] >= 1500 ? rel[i] - 1200 : 0; // only real mountains cast foothills
      const R = Math.max(2, Math.round(8 * RES));
      for (let pass = 0; pass < 3; pass++) boxBlur(ex, RW, RH, R, tmp);
      // valleys and gorges inside a range, and river valleys, stay as they are
      const inRange = new Float32Array(N2);
      for (let i = 0; i < N2; i++) inRange[i] = rel[i] >= 1500 ? 1 : 0;
      boxBlur(inRange, RW, RH, 3 * RES, tmp);
      const nearRiver = new Uint8Array(N2);
      rivers.forEach((r) => corridor(TA.resamplePolyline(r.pts, 0.5), 2.5, (i) => { nearRiver[i] = 1; }));
      let raised = 0;
      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          const i = y * RW + x, r0 = rel[i];
          if (r0 <= 0 || r0 >= 1500 || inRange[i] > 0.55 || nearRiver[i]) continue;
          const f = ex[i] * 0.9 * (0.6 + 0.8 * fbm(x / (4 * RES), y / (4 * RES), seed + 5, 3));
          if (f < 40) continue;
          const v = Math.min(1480, 90 + f); // a level, not an increment: running the pass again changes nothing
          if (v > r0) { if (v > r0 + 25) raised++; rel[i] = v; }
        }
      }
      report.foothillsKm2 = Math.round(raised * (kmUnit / RES) * (kmUnit / RES));
    }

    // ---- 2. erosion: stream power on the analysis grid, a little hillslope diffusion ----
    if (opts.erosion) {
      const hG = gridHeights();
      const h0 = hG.slice();
      const acc = new Float32Array(N), ero = new Float32Array(N), nb = new Float32Array(N);
      for (let it = 0; it < 3; it++) {
        const pf = TA.priorityFlood(hG, W, H);
        const down = TA.flowDirections(pf.filled, hG, W, H);
        acc.fill(0);
        for (let k = pf.order.length - 1; k >= 0; k--) {
          const c = pf.order[k];
          acc[c] += 1;
          if (down[c] >= 0) acc[down[c]] += acc[c];
        }
        ero.fill(0);
        for (let i = 0; i < N; i++) {
          const d = down[i];
          if (hG[i] <= 0 || d < 0) continue;
          const drop = hG[i] - Math.max(0, hG[d]);
          if (drop <= 0) continue;
          const diag = (i % W) !== (d % W) && ((i / W) | 0) !== ((d / W) | 0);
          const e = 0.03 * Math.sqrt(acc[i]) * Math.min(drop / (diag ? SQ2 : 1), 600) * clamp(hG[i] / 1500, 0.1, 1);
          ero[i] = Math.min(e, drop * 0.5);
        }
        for (let i = 0; i < N; i++) if (hG[i] > 0) hG[i] = Math.max(1, hG[i] - ero[i]);
        // soften: valleys get sides, ridges lose their knife edges (not the coast)
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            nb[i] = (hG[i - 1] + hG[i + 1] + hG[i - W] + hG[i + W]) / 4;
          }
        }
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            if (hG[i] > 300 && nb[i] > 0) hG[i] += (nb[i] - hG[i]) * 0.18;
          }
        }
      }
      // bring the change back to the painted raster (bilinear)
      for (let y = 0; y < RH; y++) {
        const gy = (y + 0.5) / RES - 0.5, ya = clamp(Math.floor(gy), 0, H - 1), yb = Math.min(H - 1, ya + 1), fy = clamp(gy - ya, 0, 1);
        for (let x = 0; x < RW; x++) {
          const i = y * RW + x;
          if (rel[i] <= 0) continue;
          const gx = (x + 0.5) / RES - 0.5, xa = clamp(Math.floor(gx), 0, W - 1), xb = Math.min(W - 1, xa + 1), fx = clamp(gx - xa, 0, 1);
          const d = (a) => hG[a] - h0[a];
          const top = d(ya * W + xa) + (d(ya * W + xb) - d(ya * W + xa)) * fx;
          const bot = d(yb * W + xa) + (d(yb * W + xb) - d(yb * W + xa)) * fx;
          const dv = top + (bot - top) * fy;
          if (dv) rel[i] = Math.max(1, rel[i] + dv);
        }
      }
      report.erosion = true;
    }

    // ---- 3. rivers the painter drew ----
    if (opts.addRivers || opts.tributaries) {
      // rivers an earlier run added are found again (kept once the painter touched them);
      // with tributaries alone, only the streams of the drawn rivers' systems
      const n0 = rivers.length;
      rivers = rivers.filter((r) => !(r.auto && !r.name && !r.notes && !r.manual && (opts.addRivers || r.trib)));
      report.replaced = n0 - rivers.length;
    }
    const SPU = 2 * RES; // bed samples per data unit
    const carveRiver = (pts, scale, floor) => {
      if (TA.polylineLength(pts) < 0.5) return 0;
      const P = TA.resamplePolyline(pts, 1 / SPU);
      const bed = new Float32Array(P.length);
      const radius = 0.7 + 1.6 * scale;
      const last = P.length - 1, vals = [];
      let cur = Infinity, run = 0, gorges = 0;
      for (let s = 0; s < P.length; s++) {
        const t = relAt(P[s]);
        if (t <= 0) { // crossing water: the stretch below starts afresh
          bed[s] = t; cur = Infinity;
          if (run >= SPU) gorges++;
          run = 0;
          continue;
        }
        // The valley floor sits below its banks: the ground just outside the valley on
        // both sides, across the course (not along it, and not the centre line, which an
        // earlier pass may already have carved). The median ignores the few samples that
        // fall into the valley of a river joining here — so running the pass again finds
        // the same banks and digs no deeper.
        const a = P[Math.max(0, s - 2)], b = P[Math.min(last, s + 2)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        vals.length = 0;
        for (let off = -3; off <= 3; off += 3) {
          const q0 = P[clamp(s + off, 0, last)];
          for (let f = 1.25; f < 1.7; f += 0.35) {
            for (let side = -1; side <= 1; side += 2) {
              const v = relAt([q0[0] - ty * radius * f * side, q0[1] + tx * radius * f * side]);
              if (v > 0) vals.push(v);
            }
          }
        }
        vals.sort((p, q) => p - q);
        const bank = vals.length ? vals[vals.length >> 1] : t;
        const depth = 6 + 40 * scale * Math.pow(s / Math.max(1, P.length - 1), 0.6);
        cur = Math.min(cur, bank - depth, t);
        if (floor != null && cur < floor) cur = floor;
        if (cur < 1) cur = 1;
        bed[s] = cur;
        if (t - cur > 220) run++;
        else { if (run >= SPU) gorges++; run = 0; }
      }
      if (run >= SPU) gorges++;
      // the valley sides rise from the bed to the ground just outside the valley in that
      // direction (not to the cell's own height, which an earlier pass may have lowered):
      // carving a carved valley again changes nothing
      corridor(P, radius, (i, dn, s) => {
        const b = bed[s];
        if (rel[i] <= 0 || b <= 0) return;
        const k = smooth01((dn - 0.1) / 0.9);
        let top = rel[i];
        if (k > 0) {
          const dx = ((i % RW) + 0.5) / RES - P[s][0], dy = (((i / RW) | 0) + 0.5) / RES - P[s][1];
          const dl = Math.hypot(dx, dy) || 1;
          const o = relAt([P[s][0] + dx / dl * radius * 1.08, P[s][1] + dy / dl * radius * 1.08]);
          if (o > 0) top = Math.max(o, b);
        }
        const v = b + (top - b) * Math.pow(k, 1.25);
        if (v < rel[i]) rel[i] = Math.max(1, v);
      });
      return gorges;
    };
    // carve a set of rivers, those reaching water first, so a tributary ends at the
    // height of the bed it flows into
    const carveNetwork = (which) => {
      const net = TA.riverNetwork(rivers.map((r) => r.pts), 1.3);
      const list = which.slice().sort((a, b) => net.depth[a] - net.depth[b]);
      list.forEach((i) => {
        const r = rivers[i];
        let floor = null;
        if (net.into[i] >= 0) { const t = relAt(r.pts[r.pts.length - 1]); if (t > 0) floor = t; }
        const g = carveRiver(r.pts, clamp(Math.sqrt(net.upLen[i] / 120), 0.12, 1), floor);
        if (g && !r.auto) report.gorges.push(r.name || "");
      });
      return net;
    };

    if (opts.fixRivers && rivers.length) {
      // which way does each river flow? Toward water or onto another river if exactly one
      // end reaches one; otherwise downhill by the depression-filled surface (a drawn
      // course that dips through a hollow is judged by where its water can actually go)
      {
        const hG = gridHeights();
        const pf = TA.priorityFlood(hG, W, H);
        rivers.forEach((r, k) => {
          const s = r.pts[0], e = r.pts[r.pts.length - 1];
          const sEnd = waterNear(s, 1.2) || !!onRiverBody(s, 1.2, k);
          const eEnd = waterNear(e, 1.2) || !!onRiverBody(e, 1.2, k) || atEdge(e);
          let flip = sEnd && !eEnd;
          if (sEnd === eEnd) flip = pf.filled[gIdx(s[0], s[1])] + 15 < pf.filled[gIdx(e[0], e[1])];
          if (flip) { r.pts.reverse(); report.reversed.push(r.name || ""); }
        });
      }
      // a mouth on dry land is led on to the sea, a lake or another river by the cheapest
      // way water could go: mostly downhill, over a low rim if it must (carving below makes
      // that rim a gap). The biggest rivers go first, so a tributary that shares a mouth
      // joins the river once that one is extended.
      const hG = gridHeights();
      const owner = new Int32Array(N).fill(-1);
      const stamp = (pts, k) => {
        TA.resamplePolyline(pts, 0.5).forEach((q) => {
          const cx = Math.floor(q[0]), cy = Math.floor(q[1]);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = cx + dx, y = cy + dy;
              if (x >= 0 && y >= 0 && x < W && y < H && owner[y * W + x] < 0) owner[y * W + x] = k;
            }
          }
        });
      };
      rivers.forEach((r, k) => stamp(r.pts, k));
      let next = null; // cell → the next cell on the way to water (built on first need)
      const buildNext = () => {
        next = new Int32Array(N).fill(-1);
        const dist = new Float64Array(N).fill(Infinity);
        const closed = new Uint8Array(N);
        const heap = new Heap(N * 2);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (hG[i] <= 0 || x === 0 || y === 0 || x === W - 1 || y === H - 1) { dist[i] = 0; heap.push(i, 0); }
          }
        }
        while (heap.n) {
          const c = heap.pop();
          if (closed[c]) continue;
          closed[c] = 1;
          const cx = c % W, cy = (c / W) | 0;
          const hc = hG[c] > 0 ? hG[c] : 0;
          for (let k = 0; k < 8; k++) {
            const xx = cx + NX[k], yy = cy + NY[k];
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const n = yy * W + xx;
            if (closed[n] || hG[n] <= 0) continue;
            // water flowing n → c climbs by hc − h[n] when that is positive
            const nd = dist[c] + ND[k] * (1 + Math.max(0, hc - hG[n]) / 8);
            if (nd < dist[n]) { dist[n] = nd; next[n] = c; heap.push(n, nd); }
          }
        }
      };
      const net0 = TA.riverNetwork(rivers.map((r) => r.pts), 1.3);
      rivers.map((_, i) => i).sort((a, b) => net0.upLen[b] - net0.upLen[a]).forEach((k) => {
        const r = rivers[k];
        const m = r.pts[r.pts.length - 1];
        if (waterNear(m, 1.0) || atEdge(m)) return;
        const near = onRiverBody(m, 1.2, k);
        if (near) { r.pts[r.pts.length - 1] = near.point; return; }
        if (!next) buildNext();
        let c = gIdx(m[0], m[1]);
        const path = [];
        let joined = false, back = false, guard = 0;
        while (guard++ < N) {
          const d = next[c];
          if (d < 0) break; // reached water or the map edge
          if (hG[d] <= 0) { path.push(d); break; }
          const o = owner[d];
          if (o >= 0 && o !== k) { joined = true; break; }
          if (o === k && Math.hypot(d % W + 0.5 - m[0], ((d / W) | 0) + 0.5 - m[1]) > 2.5) { back = true; break; }
          path.push(d);
          c = d;
        }
        if (back || (!path.length && !joined)) return;
        const ext = path.map((cc) => [cc % W + 0.5, ((cc / W) | 0) + 0.5]);
        if (joined) {
          const q = onRiverBody(ext.length ? ext[ext.length - 1] : m, 3, k);
          if (q) ext.push(q.point);
        }
        const tail = TA.rdp(TA.chaikin([m].concat(ext), 2, false), 0.12).slice(1);
        const added = TA.polylineLength([m].concat(tail));
        if (added < 0.5) return;
        r.pts = r.pts.concat(tail);
        report.extended.push({ name: r.name || "", km: Math.round(added * kmUnit) });
        stamp([m].concat(tail), k);
      });
      // every course then gets a bed that keeps falling to its mouth (a gorge through a ridge)
      carveNetwork(rivers.map((_, i) => i));
    }

    // ---- 4. water on the (possibly carved) terrain: lakes and new rivers ----
    let hG = gridHeights();
    // Lakes already there (painted, or made by an earlier pass) pass their water on over
    // the lowest point of their rim: flow is traced over them as low land, or a lake would
    // cut a river off from its headwaters. Inland seas stay where the water ends.
    const findLakes = () => {
      const comps = TA.components(W, H, (i) => hG[i] <= 0, true);
      const maxCells = 150000 / (kmUnit * kmUnit);
      const isLake = comps.list.map((c) => !c.edge && c.area <= maxCells);
      const mask = new Uint8Array(N);
      for (let i = 0; i < N; i++) { const c = comps.comp[i]; if (c >= 0 && isLake[c]) mask[i] = 1; }
      return { mask, big: comps.list.filter((c, k) => isLake[k] && c.area >= 30).length };
    };
    let lakes0 = findLakes();
    // water runs over the ground with its small bumps: without them runoff on smooth
    // painted plains runs in parallel lines instead of gathering into branching streams
    const flowSurface = () => {
      const o = new Float32Array(N);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          o[i] = lakes0.mask[i] ? 1 : hG[i] > 0 ? Math.max(1, hG[i] + (fbm(x / 5, y / 5, seed + 201, 3) - 0.5) * 24) : hG[i];
        }
      }
      return o;
    };
    // Lakes come first, so the catchments, the climate and the rivers below see them — as
    // they will when the pass is run again.
    if (opts.lakes) {
      const hydL = TA.hydrology(flowSurface(), W, H, { rain: TA.climate(hG, W, H, climOpts).prec, riverThreshold: 1e12,
        through: lakes0.mask, minLakeCells: 60, lakeDepth: 70, evaporation: 10 });
      // painted ground is full of shallow hollows: keep the lakes that matter — the
      // biggest few, counting those already there (so a second run adds none) — and
      // let the rest stay dry
      const comps = TA.components(W, H, (i) => hydL.lake[i] === 1, false);
      const keep = comps.list.filter((c) => c.area >= 30).sort((a, b) => b.area - a.area).slice(0, Math.max(0, 15 - lakes0.big));
      const kept = new Uint8Array(comps.list.length);
      keep.forEach((c) => { kept[c.id] = 1; });
      report.lakes = keep.length;
      report.lakeKm2 = Math.round(keep.reduce((sum, c) => sum + c.area, 0) * kmUnit * kmUnit);
      if (keep.length) {
        for (let y = 0; y < RH; y++) {
          for (let x = 0; x < RW; x++) {
            const i = y * RW + x;
            if (rel[i] <= 0) continue;
            const jx = (x + 0.5) / RES + (vnoise(x / 3, y / 3, seed + 31) - 0.5) * 1.2;
            const jy = (y + 0.5) / RES + (vnoise(x / 3 + 17.1, y / 3 + 5.3, seed + 37) - 0.5) * 1.2;
            const g = gIdx(jx, jy);
            if (hydL.lake[g] && kept[comps.comp[g]]) rel[i] = -(15 + 90 * vnoise(x / 7, y / 7, seed + 41));
          }
        }
        hG = gridHeights();
        lakes0 = findLakes();
      }
    }
    // Every river the painter drew stands for a whole system: its catchment (the land
    // whose water reaches it) has to be wet enough for a river that size — most of all in
    // its headwaters — and streams too small to draw gather into it.
    const sizeOf = (r, upLen) => (r.manual && r.manual.size != null ? +r.manual.size : upLen * kmUnit < 80 ? 0 : upLen * kmUnit < 400 ? 1 : upLen * kmUnit < 1500 ? 2 : 3);
    let wetBoost = null, catchOf = null, drawnSize = null;
    const drawnIdx = rivers.map((r, k) => k).filter((k) => !rivers[k].auto);
    if (drawnIdx.length && (opts.tributaries || opts.biomes)) {
      const net = TA.riverNetwork(rivers.map((r) => r.pts), 1.3);
      drawnSize = new Int8Array(rivers.length).fill(-1);
      const foot = new Int32Array(N).fill(-1), footA = new Float32Array(N);
      drawnIdx.forEach((k) => {
        drawnSize[k] = sizeOf(rivers[k], net.upLen[k]);
        const P = TA.resamplePolyline(rivers[k].pts, 0.5);
        P.forEach((q, s0) => {
          const c = gIdx(q[0], q[1]);
          if (foot[c] < 0 || drawnSize[k] > drawnSize[foot[c]]) { foot[c] = k; footA[c] = s0 / Math.max(1, P.length - 1); }
        });
      });
      // downstream first, every cell takes the river its water reaches and where it joins it
      // (routed as the new rivers below are, so a stream found there belongs to the system)
      const hF = flowSurface();
      const pf = TA.priorityBreach(hF, W, H);
      const dn = pf.down;
      catchOf = new Int32Array(N).fill(-1);
      const joinA = new Float32Array(N);
      for (let k = 0; k < pf.order.length; k++) {
        const c = pf.order[k];
        if (foot[c] >= 0) { catchOf[c] = foot[c]; joinA[c] = footA[c]; continue; }
        const d = dn[c];
        if (d >= 0 && catchOf[d] >= 0) { catchOf[c] = catchOf[d]; joinA[c] = joinA[d]; }
      }
      // how wet each catchment is now, and how wet a river that size needs it
      const NEED = [0, 0.2, 0.27, 0.34];
      const clim0 = TA.climate(hG, W, H, climOpts);
      const sum = new Float64Array(rivers.length), cnt = new Float64Array(rivers.length);
      for (let i = 0; i < N; i++) { const k = catchOf[i]; if (k >= 0 && hG[i] > 0) { sum[k] += clim0.prec[i]; cnt[k]++; } }
      wetBoost = new Float32Array(N).fill(1);
      drawnIdx.forEach((k) => {
        const mean = cnt[k] ? sum[k] / cnt[k] : 1, need = NEED[drawnSize[k]];
        const f = need > mean ? Math.min(4, need / Math.max(0.02, mean)) : 1;
        report.systems.push({ name: rivers[k].name || "", size: drawnSize[k], km2: Math.round(cnt[k] * kmUnit * kmUnit), boosted: f > 1.02 });
        if (f <= 1.02) return;
        // the headwaters (land draining into the upper course) get the most rain
        for (let i = 0; i < N; i++) if (catchOf[i] === k) wetBoost[i] = 1 + (f - 1) * (0.45 + 0.9 * (1 - joinA[i]));
      });
      // no hard edge at the divide
      const tmpB = new Float32Array(N);
      boxBlur(wetBoost, W, H, 2, tmpB);
    }
    const boosted = (clim) => { if (wetBoost) for (let i = 0; i < N; i++) clim.prec[i] = Math.min(1, clim.prec[i] * wetBoost[i]); return clim; };

    const addTribs = opts.tributaries && catchOf;
    if (opts.addRivers || addTribs) {
      const clim = boosted(TA.climate(hG, W, H, climOpts));
      const thr = Math.max(10, +inp.riverThreshold || 60);
      const TRIB = [1, 0.7, 0.5, 0.35]; // share of the threshold a stream needs inside a drawn river's catchment, by its size
      const thrLow = addTribs ? thr * TRIB[drawnIdx.reduce((m, k) => Math.max(m, drawnSize[k]), 0)] : thr;
      const hyd = TA.hydrology(flowSurface(), W, H, { rain: clim.prec, riverThreshold: thrLow, through: lakes0.mask,
        minRiverCells: 4, minLakeCells: 1e12, breach: true });
      const mask = new Uint8Array(N);
      const stampMask = (pts) => {
        TA.resamplePolyline(pts, 0.5).forEach((q) => {
          const cx = Math.floor(q[0]), cy = Math.floor(q[1]);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = cx + dx, y = cy + dy;
              if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
            }
          }
        });
      };
      rivers.forEach((r) => stampMask(r.pts));
      const sim = hyd.rivers;
      const depth = sim.map((r) => { let d = 0, c = r.into; while (c >= 0 && d <= sim.length) { d++; c = sim[c].into; } return d; });
      const order = sim.map((_, i) => i).sort((a, b) => (depth[a] - depth[b]) || (sim[b].flux - sim[a].flux));
      const addedIdx = [];
      const tribOf = new Map(); // added river index → the drawn river whose system it belongs to
      const centre = (c) => [c % W + 0.5, ((c / W) | 0) + 0.5];
      order.forEach((si) => {
        const r = sim[si];
        const cells = r.cells;
        let cut = cells.length;
        for (let k = 0; k < cells.length; k++) if (mask[cells[k]]) { cut = k; break; }
        if (cut < 4) return; // too short, or it is a river that is already there
        // a stream of a drawn river's system, or a river of its own?
        const sys = catchOf ? catchOf[cells[0]] : -1;
        const flux = hyd.acc[cells[cut - 1]];
        if (sys >= 0 && addTribs) {
          if (flux < thr * TRIB[drawnSize[sys]]) return;
        } else {
          if (!opts.addRivers || flux < thr || cut < 6) return;
        }
        let pts = Array.from(cells.slice(0, cut), centre);
        let onRiver = cut < cells.length;
        if (!onRiver && r.mouth >= 0) {
          // on to the sea, a lake that was kept, or a river; the stream it joined or the
          // hollow it filled may not have been kept, so follow the water on from there
          let c = r.mouth, guard = 0;
          while (c >= 0 && guard++ < N) {
            if (mask[c]) { onRiver = true; break; }
            pts.push(centre(c));
            if (hG[c] <= 0) break; // the sea or a lake
            c = hyd.down[c];
          }
        }
        if (onRiver) {
          // stopped a cell or two before the river it reaches: run on to its course
          const q = nearestRiver(pts[pts.length - 1], 6, -1);
          if (q) pts.push(q.point);
        }
        // a gentle meander, then smooth (both ends stay where they are)
        // (a field over the map, not along the river: a river found again on a later run
        // wiggles the same way)
        pts = pts.map((p, k) => {
          if (k === 0 || k === pts.length - 1) return p;
          const a = pts[k - 1], b = pts[k + 1];
          let tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1;
          tx /= tl; ty /= tl;
          const off = (vnoise(p[0] * 0.45, p[1] * 0.45, seed + 97) - 0.5) * 0.9;
          return [p[0] - ty * off, p[1] + tx * off];
        });
        pts = TA.rdp(TA.chaikin(pts, 2, false), 0.12);
        const minLen = sys >= 0 && addTribs ? Math.max(4, (+inp.minRiverLength || 10) * 0.4) : (+inp.minRiverLength || 10);
        if (TA.polylineLength(pts) < minLen) return;
        const trib = sys >= 0 && addTribs;
        rivers.push(trib ? { name: "", pts, auto: true, trib: 1, width: 1 } : { name: "", pts, auto: true, width: 1 });
        addedIdx.push(rivers.length - 1);
        if (trib) tribOf.set(rivers.length - 1, sys);
        stampMask(pts);
      });
      report.added = addedIdx.length;
      // names kept from the time rivers were simulated (older worlds)
      Object.keys(inp.riverNames || {}).forEach((key) => {
        const nm = inp.riverNames[key];
        if (!nm || !nm.name || !nm.anchor) return;
        let best = null, bl = -1;
        rivers.forEach((r) => {
          if (r.name || !nearestOnPolyline(r.pts, nm.anchor, 4)) return;
          const L = TA.polylineLength(r.pts);
          if (L > bl) { bl = L; best = r; }
        });
        if (best) { best.name = nm.name; if (nm.notes) best.notes = nm.notes; report.named++; }
      });
      const net = carveNetwork(addedIdx);
      addedIdx.forEach((i) => { if (net.into[i] >= 0) report.tributaries++; });
      // how many streams each drawn river gathered
      const perSys = new Map();
      tribOf.forEach((sys) => perSys.set(sys, (perSys.get(sys) || 0) + 1));
      report.systems.forEach((sy) => { sy.tribs = 0; });
      drawnIdx.forEach((k, j) => { if (report.systems[j]) report.systems[j].tribs = perSys.get(k) || 0; });
      report.drawnTribs = tribOf.size;
    }
    hG = gridHeights();

    // ---- a last check along every river: the water surface never rises downstream
    //      (smooths the little steps where corridors of joining rivers overlap) ----
    rivers.forEach((r) => { r.pts = r.pts.map((q) => [r2(q[0]), r2(q[1])]); }); // as stored
    if (opts.fixRivers || opts.addRivers) {
      const lines = rivers.map((r) => TA.resamplePolyline(r.pts, 0.5 / RES).map((q) => rIdx(q[0], q[1])));
      for (let pass = 0; pass < 4; pass++) { // a river crossing another may need a second look
        let lowered = 0;
        lines.forEach((cellsAlong) => {
          let cur = Infinity;
          cellsAlong.forEach((i) => {
            if (rel[i] <= 0) { cur = Infinity; return; }
            if (rel[i] > cur) { rel[i] = cur; lowered++; } else cur = rel[i];
          });
        });
        if (!lowered) break;
      }
      hG = gridHeights();
    }

    // ---- 5. natural zones from the climate; cover painted by hand stays ----
    if (opts.biomes) {
      const clim = boosted(TA.climate(hG, W, H, climOpts));
      // green valleys: land along a river is watered by it, the wider the bigger the river
      // (a stream ~5 km each side, a great river ~25 km); a big river's flat mouth is a delta
      const rip = new Float32Array(N), delta = new Uint8Array(N);
      const netAll = TA.riverNetwork(rivers.map((r) => r.pts), 1.3);
      const HALF_KM = [5, 9, 15, 24];
      rivers.forEach((r, k) => {
        const sz = sizeOf(r, netAll.upLen[k]);
        const R = Math.max(1, HALF_KM[sz] / kmUnit); // in cells
        const Rc = Math.ceil(R);
        TA.resamplePolyline(r.pts, 0.5).forEach((q) => {
          const cx = Math.floor(q[0]), cy = Math.floor(q[1]);
          for (let dy = -Rc; dy <= Rc; dy++) {
            const y = cy + dy;
            if (y < 0 || y >= H) continue;
            for (let dx = -Rc; dx <= Rc; dx++) {
              const x = cx + dx;
              if (x < 0 || x >= W) continue;
              const dd = Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]);
              if (dd > R) continue;
              const i = y * W + x, v = 1 - dd / R;
              if (v > rip[i]) rip[i] = v;
            }
          }
        });
        // a large river reaching the sea over flat land spreads into a delta
        const m = r.pts[r.pts.length - 1];
        if (sz >= 2 && netAll.into[k] < 0 && waterNear(m, 1.5)) {
          const D = Math.ceil((sz === 3 ? 40 : 22) / kmUnit);
          const cx = Math.floor(m[0]), cy = Math.floor(m[1]);
          for (let dy = -D; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) {
            const x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= W || y >= H || dx * dx + dy * dy > D * D) continue;
            const i = y * W + x;
            if (hG[i] > 0 && hG[i] < 60 && rip[i] > 0.15) delta[i] = 1;
          }
        }
      });
      // two fields: the land away from rivers, and the same land in a river valley
      const biome = new Uint8Array(N), biomeV = new Uint8Array(N);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (hG[i] <= 0) continue;
          let nearWater = false, flat = true;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
              const j = yy * W + xx;
              if (hG[j] <= 0) nearWater = true;
              if (Math.abs(hG[j] - hG[i]) > 60) flat = false;
            }
          }
          const t = clim.temp[i], p = clim.prec[i];
          biome[i] = TA.biomeOf(t, p, hG[i], nearWater, flat);
          // the river keeps its banks green whatever the rain: at the channel as wet as a forest
          biomeV[i] = delta[i] && t > 0 ? 13
            : rip[i] > 0 ? TA.biomeOf(t, Math.max(p, TA.pet(t) * (0.55 + 0.55 * rip[i])), hG[i], nearWater, flat) : biome[i];
        }
      }
      // majority filter (5×5, twice) away from rivers: no speckles of desert inside a forest
      for (let pass = 0; pass < 2; pass++) {
        const src2 = biome.slice();
        const votes = new Uint16Array(14);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (!src2[i]) continue;
            votes.fill(0);
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const xx = x + dx, yy = y + dy;
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                votes[src2[yy * W + xx]]++;
              }
            }
            let best = src2[i];
            for (let b = 1; b < 14; b++) if (votes[b] > votes[best]) best = b;
            biome[i] = best;
          }
        }
      }
      // painted cell by cell: the edge of a valley follows the river (the valley field is
      // read between analysis cells), the rest takes a jittered look so zones interlock
      const RIP = 0.25;
      const deltaF = new Float32Array(N);
      for (let i = 0; i < N; i++) deltaF[i] = delta[i];
      const between = (a, gx, gy) => {
        const fx = gx - 0.5, fy = gy - 0.5;
        const xa = clamp(Math.floor(fx), 0, W - 1), ya = clamp(Math.floor(fy), 0, H - 1);
        const xb = Math.min(W - 1, xa + 1), yb = Math.min(H - 1, ya + 1);
        const tx = clamp(fx - xa, 0, 1), ty = clamp(fy - ya, 0, 1);
        const top = a[ya * W + xa] + (a[ya * W + xb] - a[ya * W + xa]) * tx;
        const bot = a[yb * W + xa] + (a[yb * W + xb] - a[yb * W + xa]) * tx;
        return top + (bot - top) * ty;
      };
      let land = 0, painted = 0, valley = 0;
      const AUTO = TA.COVER_AUTO;
      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          const i = y * RW + x;
          if (rel[i] <= 0) continue;
          land++;
          if (C[i] && !(C[i] & AUTO) && !opts.repaintAll) continue; // painted by hand
          const gx = (x + 0.5) / RES, gy = (y + 0.5) / RES;
          const g0 = gIdx(gx, gy);
          const inValley = between(rip, gx, gy) > RIP || between(deltaF, gx, gy) > 0.5;
          let b;
          if (inValley) b = biomeV[g0] || biome[g0];
          else {
            const jx = gx + (vnoise(x / 4, y / 4, seed + 71) - 0.5) * 2.2;
            const jy = gy + (vnoise(x / 4 + 31.7, y / 4 + 12.3, seed + 83) - 0.5) * 2.2;
            b = biome[gIdx(jx, jy)] || biome[g0];
          }
          if (!b) { // a coastal cell whose analysis cell counts as water
            const cx = Math.floor(gx), cy = Math.floor(gy);
            for (let dy = -1; dy <= 1 && !b; dy++) for (let dx = -1; dx <= 1 && !b; dx++) b = (inValley ? biomeV : biome)[gIdx(cx + dx, cy + dy)];
          }
          if (!b) continue;
          C[i] = TA.COVER_OF_BIOME[b] | AUTO;
          painted++;
          if (inValley) valley++;
        }
      }
      report.biomePct = land ? Math.round(painted / land * 100) : 0;
      report.valleysKm2 = Math.round(valley * (kmUnit / RES) * (kmUnit / RES));
    }

    const out = new Int16Array(N2);
    // rounding down keeps a river surface that was levelled from ever rising by a metre
    for (let i = 0; i < N2; i++) out[i] = clamp(Math.floor(rel[i] + sl), -8000, 9000);
    return { height: out.buffer, cover: C.buffer, rivers, report };
  };
  function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
})(typeof self !== "undefined" ? self : this);
