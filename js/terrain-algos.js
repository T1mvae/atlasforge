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
  TA.climate = function (h, W, H, opts) {
    opts = opts || {};
    const latTop = opts.latTop != null ? +opts.latTop : 70;
    const latBottom = opts.latBottom != null ? +opts.latBottom : -10;
    const tEq = opts.tEquator != null ? +opts.tEquator : 27;
    const tPole = opts.tPole != null ? +opts.tPole : -28;
    const N = W * H;
    const temp = new Float32Array(N);
    const prec = new Float32Array(N);
    const latOf = (y) => latTop + (latBottom - latTop) * (y + 0.5) / H;
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(latOf(y));
      const t0 = tEq - (tEq - tPole) * Math.pow(Math.min(90, lat) / 90, 1.25);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        temp[i] = t0 - 6.5 * Math.max(0, h[i]) / 1000;
      }
    }
    // rows swept by the prevailing wind of their latitude band: trade winds and polar
    // easterlies blow west, the mid-latitude westerlies east. Moisture is picked up over
    // water, rained out over land (more where the ground rises), and stripped by high
    // ranges — which leaves rain shadows behind them.
    const bandWet = (lat) => {
      const a = Math.abs(lat);
      const pts = [[0, 1.35], [10, 1.2], [22, 0.5], [32, 0.65], [45, 1.1], [60, 1.0], [72, 0.6], [90, 0.35]];
      for (let k = 1; k < pts.length; k++) {
        if (a <= pts[k][0]) {
          const t = (a - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]);
          return pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
        }
      }
      return 0.35;
    };
    for (let y = 0; y < H; y++) {
      const lat = latOf(y);
      const a = Math.abs(lat);
      const eastward = a >= 30 && a < 60;
      const wet = bandWet(lat);
      let m = 0;
      for (let pass = 0; pass < 2; pass++) { // second pass starts with the moisture that wrapped around
        let prevH = 0;
        for (let s = 0; s < W; s++) {
          const x = eastward ? s : W - 1 - s;
          const i = y * W + x;
          const hh = h[i];
          if (hh <= 0) {
            m = Math.min(1, m + 0.035 * (0.35 + 0.65 * clamp((temp[i] + 5) / 35, 0, 1)));
            if (pass) prec[i] += m * 0.02;
            prevH = 0;
          } else {
            const lift = Math.max(0, hh - prevH);
            let rate = 0.018 + Math.min(0.6, lift / 900);
            if (hh > 2500) rate += 0.08 + (hh - 2500) / 25000;
            const rain = m * Math.min(0.85, rate);
            m = m - rain + rain * 0.18; // some of it evaporates again from the land
            if (pass) prec[i] += rain * wet;
            prevH = hh;
          }
        }
      }
    }
    // smooth (separable box blur, radius 3) and normalise
    const tmp = new Float32Array(N);
    const R = 3;
    for (let y = 0; y < H; y++) {
      let acc = 0, cnt = 0;
      for (let x = -R; x < W; x++) {
        const add = x + R, rem = x - R - 1;
        if (add < W) { acc += prec[y * W + add]; cnt++; }
        if (rem >= 0) { acc -= prec[y * W + rem]; cnt--; }
        if (x >= 0) tmp[y * W + x] = acc / cnt;
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0, cnt = 0;
      for (let y = -R; y < H; y++) {
        const add = y + R, rem = y - R - 1;
        if (add < H) { acc += tmp[add * W + x]; cnt++; }
        if (rem >= 0) { acc -= tmp[rem * W + x]; cnt--; }
        if (y >= 0) prec[y * W + x] = acc / cnt;
      }
    }
    let landVals = [];
    for (let i = 0; i < N; i += 7) if (h[i] > 0) landVals.push(prec[i]);
    landVals.sort((p, q) => p - q);
    const p95 = landVals.length ? landVals[Math.floor(landVals.length * 0.95)] || 1 : 1;
    for (let i = 0; i < N; i++) prec[i] = clamp(prec[i] / (p95 || 1), 0, 1);
    return { temp, prec };
  };

  TA.biomeOf = function (t, p, h, nearWater, flat) {
    if (h <= 0) return 0;
    if (t < -10) return 1;
    if (p > 0.72 && nearWater && flat && h < 400 && t > 0) return 13;
    if (t < -2) return 2;
    if (t < 5) return p > 0.28 ? 3 : p < 0.1 ? 4 : 2;
    if (t < 19) return p < 0.12 ? 5 : p < 0.3 ? 6 : p < 0.62 ? 7 : 8;
    return p < 0.12 ? 9 : p < 0.34 ? 10 : p < 0.66 ? 11 : 12;
  };

  // ---------- hydrology: accumulation, lakes, rivers, basins ----------
  // opts: rain (Float32 0..1 per cell), riverThreshold (flux units), minRiverCells
  TA.hydrology = function (h, W, H, opts) {
    opts = opts || {};
    const N = W * H;
    const { filled, order } = TA.priorityFlood(h, W, H);
    const down = TA.flowDirections(filled, h, W, H);
    const rain = opts.rain;
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
      let minH = Infinity, inflow = 0, spill = -Infinity;
      while (sp) {
        const c = stack[--sp];
        cells.push(c);
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
      if (spill - minH < (opts.lakeDepth || 25)) continue;
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
    for (let i = 0; i < N; i++) if (h[i] > 0 && !lake[i] && acc[i] >= thr) isRiver[i] = 1;
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
      r.mouthType = next < 0 ? "edge" : h[next] <= 0 ? "sea" : lake[next] ? "lake" : isRiver[next] ? "river" : "land";
      r.into = r.mouthType === "river" ? rid[next] : -1;
      r.sourceType = lake[down[r.source]] || (r.source >= 0 && neighbourLake(r.source)) ? "lake" : "spring";
    });
    function neighbourLake(c) {
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && lake[yy * W + xx]) return true;
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
  // input: W, H, h (metres), basin (merged), riverMask (Uint8, major rivers — optional),
  //        target (cells per province), opts { mountains: "sides" | "separate",
  //        riversAsBorders, seeds: [[x, y], …] (e.g. cities) }
  // Guarantee: all mountain cells of one province drain to the same basin, i.e. no
  // province straddles a ridge. Mountain blocks are split only inside a basin; small
  // pieces merge only with same-basin neighbours.
  TA.smartProvinces = function (input) {
    const { W, H, h, basin } = input;
    const opts = input.opts || {};
    const N = W * H;
    const A = Math.max(12, input.target || 300);
    const separate = opts.mountains === "separate";
    const riverMask = opts.riversAsBorders && input.riverMask ? input.riverMask : null;
    const isMount = (i) => h[i] >= 1500;
    const groupOf = (i) => (h[i] <= 0 ? 0 : isMount(i) ? 2 : 1);
    const barrier = (i) => riverMask && riverMask[i];

    // 1) blocks: same group; mountains also same basin; rivers cut lowland when enabled
    const block = new Int32Array(N).fill(-1);
    const blocks = [];
    const queue = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (block[s] >= 0 || h[s] <= 0 || barrier(s)) continue;
      const g = groupOf(s), bs = basin[s];
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
          if (block[n] >= 0 || h[n] <= 0 || barrier(n) || groupOf(n) !== g) continue;
          if (g === 2 && basin[n] !== bs) continue;
          block[n] = id; queue[qt++] = n;
        }
      }
      blocks.push({ id, group: g, basin: bs, cells });
    }

    // 2) atoms: split each block into k geodesic Voronoi pieces (never leaves the block)
    const atom = new Int32Array(N).fill(-1);
    const dist = new Float32Array(N).fill(Infinity);
    const seedsIn = new Map(); // block -> seed cells from input seeds (cities)
    (input.seeds || []).forEach((p) => {
      const x = Math.floor(p[0]), y = Math.floor(p[1]);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const b = block[y * W + x];
      if (b < 0) return;
      if (!seedsIn.has(b)) seedsIn.set(b, []);
      seedsIn.get(b).push(y * W + x);
    });
    let nAtoms = 0;
    const atomMeta = []; // { block, group, basin }
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
          const nd = dc + ND[k] * (1 + Math.abs(h[n] - h[c]) / 400);
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
      for (let l = 0; l < seeds.length; l++) atomMeta.push({ block: b.id, group: b.group, basin: b.basin });
      nAtoms += seeds.length;
    });

    // 3) cells left over (river barrier cells, unreachable slivers) join the
    //    neighbouring atom they touch most
    for (let pass = 0; pass < 50; pass++) {
      let changed = 0, left = 0;
      for (let i = 0; i < N; i++) {
        if (h[i] <= 0 || atom[i] >= 0) continue;
        left++;
        const cx = i % W, cy = (i / W) | 0;
        const votes = new Map();
        for (let k = 0; k < 8; k++) {
          const xx = cx + NX[k], yy = cy + NY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const a = atom[yy * W + xx];
          if (a >= 0 && (!isMount(i) || atomMeta[a].group !== 2 || atomMeta[a].basin === basin[i])) votes.set(a, (votes.get(a) || 0) + (k < 4 ? 2 : 1));
        }
        let best = -1, bv = 0;
        votes.forEach((v, a) => { if (v > bv) { bv = v; best = a; } });
        if (best >= 0) { atom[i] = best; changed++; }
      }
      if (!left) break;
      if (!changed) {
        // isolated land (single river cells on an islet…): own atoms
        for (let i = 0; i < N; i++) {
          if (h[i] > 0 && atom[i] < 0) { atom[i] = nAtoms++; atomMeta.push({ block: -1, group: groupOf(i), basin: basin[i] }); }
        }
        break;
      }
    }

    // 4) merge small atoms into an allowed neighbour (union-find over atoms).
    //    A CREST is a boundary between two mountain pieces that runs along high ground:
    //    its mean height stands well above both pieces. Pieces separated by a crest never
    //    end up in one province; pieces side by side on the same slope (divided only by a
    //    spur that falls away toward the lowland) may.
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
    // per group: its mountain pieces (for crest checks) and whether it holds lowland
    const mountList = atomMeta.map((m, a) => (mStat[a * 4 + 1] > area[a] * 0.5 ? [a] : []));
    const hasLow = atomMeta.map((m, a) => mStat[a * 4 + 1] <= area[a] * 0.5);
    const mountOnly = (a) => !hasLow[a];
    const canMerge = (a, b) => {
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
            if (atom[j] < 0) continue;
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
    const mergeRound = (isSmall, sameKindBonus) => {
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
      roots.sort((p, q) => area[p] - area[q]);
      let merged = 0;
      for (const a0 of roots) {
        const a = find(a0);
        if (a !== a0 || !isSmall(a)) continue;
        let best = -1, bl = 0;
        (nbrs.get(a) || []).forEach(([b0, len]) => {
          const b = find(b0);
          if (b === a || !canMerge(a, b)) return;
          const same = mountOnly(a) === mountOnly(b);
          const score = len * (same ? sameKindBonus : 1) / Math.sqrt(1 + area[b] / A);
          if (score > bl) { bl = score; best = b; }
        });
        if (best < 0) continue;
        parent[a] = best;
        area[best] += area[a];
        mountList[best] = mountList[best].concat(mountList[a]);
        hasLow[best] = hasLow[best] || hasLow[a];
        merged++;
      }
      return merged;
    };
    for (let round = 0; round < 5; round++) {
      const merged = mergeRound((a) => (mountOnly(a) ? area[a] < A * (separate ? 0.35 : 0.8) : area[a] < A * 0.45), 2);
      if (!merged) break;
    }
    // crumbs: anything tiny joins any allowed neighbour
    for (let round = 0; round < 3; round++) {
      if (!mergeRound((a) => area[a] < A * 0.08, 1)) break;
    }

    // 5) compact labels
    const labelOf = new Int32Array(nAtoms).fill(-1);
    let nLabels = 0;
    const labels = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if (atom[i] < 0) continue;
      const r = find(atom[i]);
      if (labelOf[r] < 0) labelOf[r] = nLabels++;
      labels[i] = labelOf[r];
    }
    return { labels, count: nLabels };
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
  //   biomes    — land cover from the climate, only where nothing is painted
  // input: { RW, RH, RES, GW, GH, height: ArrayBuffer (Int16, metres above datum),
  //   cover: ArrayBuffer (Uint8, js/world.js COVER), rivers: [{ id, name, pts, … }],
  //   riverNames: { key: { name, notes, anchor } } (names of rivers from older versions),
  //   seaLevel, climate, seed, scaleKm, riverThreshold, opts }
  // output: { height, cover (ArrayBuffers), rivers, report }
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
      lakes: 0, lakeKm2: 0, biomePct: null, foothillsKm2: null, erosion: false };
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
    if (opts.addRivers) {
      const n0 = rivers.length;
      rivers = rivers.filter((r) => !(r.auto && !r.name && !r.notes && !r.manual)); // kept once the painter touched them
      report.replaced = n0 - rivers.length;
    }
    const SPU = 2 * RES; // bed samples per data unit
    const carveRiver = (pts, scale, floor) => {
      if (TA.polylineLength(pts) < 0.5) return 0;
      const P = TA.resamplePolyline(pts, 1 / SPU);
      const bed = new Float32Array(P.length);
      const radius = 0.7 + 1.6 * scale;
      let cur = Infinity, run = 0, gorges = 0;
      for (let s = 0; s < P.length; s++) {
        const t = relAt(P[s]);
        if (t <= 0) { // crossing water: the stretch below starts afresh
          bed[s] = t; cur = Infinity;
          if (run >= SPU) gorges++;
          run = 0;
          continue;
        }
        // the valley floor sits below its banks (not below the centre line, which an
        // earlier pass may already have carved — so running the pass again digs no deeper)
        let bank = 0, nb = 0;
        for (let a = 0; a < 8; a++) {
          const q = [P[s][0] + Math.cos(a * Math.PI / 4) * radius, P[s][1] + Math.sin(a * Math.PI / 4) * radius];
          const v = relAt(q);
          if (v > 0) { bank += v; nb++; }
        }
        bank = nb ? bank / nb : t;
        const depth = 6 + 40 * scale * Math.pow(s / Math.max(1, P.length - 1), 0.6);
        cur = Math.min(cur, bank - depth, t);
        if (floor != null && cur < floor) cur = floor;
        if (cur < 1) cur = 1;
        bed[s] = cur;
        if (t - cur > 220) run++;
        else { if (run >= SPU) gorges++; run = 0; }
      }
      if (run >= SPU) gorges++;
      corridor(P, radius, (i, dn, s) => {
        const b = bed[s];
        if (rel[i] <= 0 || b <= 0) return;
        const k = smooth01((dn - 0.1) / 0.9);
        const v = b + (rel[i] - b) * Math.pow(k, 1.25);
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
    if (opts.lakes || opts.addRivers) {
      const clim = TA.climate(hG, W, H, inp.climate || {});
      const hyd = TA.hydrology(hG, W, H, { rain: clim.prec, riverThreshold: Math.max(10, +inp.riverThreshold || 60),
        minRiverCells: 6, minLakeCells: opts.lakes ? 60 : 1e12, lakeDepth: 70, evaporation: 10 });
      if (opts.lakes) {
        // painted ground is full of shallow hollows: keep the lakes that matter — the
        // biggest few — and let the rest stay dry
        const comps = TA.components(W, H, (i) => hyd.lake[i] === 1, false);
        const keep = comps.list.filter((c) => c.area >= 30).sort((a, b) => b.area - a.area).slice(0, 15);
        const kept = new Uint8Array(comps.list.length);
        keep.forEach((c) => { kept[c.id] = 1; });
        for (let i = 0; i < N; i++) if (hyd.lake[i] && !kept[comps.comp[i]]) hyd.lake[i] = 0;
        report.lakes = keep.length;
        report.lakeKm2 = Math.round(keep.reduce((sum, c) => sum + c.area, 0) * kmUnit * kmUnit);
        if (keep.length) {
          for (let y = 0; y < RH; y++) {
            for (let x = 0; x < RW; x++) {
              const i = y * RW + x;
              if (rel[i] <= 0) continue;
              const jx = (x + 0.5) / RES + (vnoise(x / 3, y / 3, seed + 31) - 0.5) * 1.2;
              const jy = (y + 0.5) / RES + (vnoise(x / 3 + 17.1, y / 3 + 5.3, seed + 37) - 0.5) * 1.2;
              if (hyd.lake[gIdx(jx, jy)]) rel[i] = -(15 + 90 * vnoise(x / 7, y / 7, seed + 41));
            }
          }
        }
      }
      if (opts.addRivers) {
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
        const centre = (c) => [c % W + 0.5, ((c / W) | 0) + 0.5];
        order.forEach((si) => {
          const r = sim[si];
          const cells = r.cells;
          let cut = cells.length;
          for (let k = 0; k < cells.length; k++) if (mask[cells[k]]) { cut = k; break; }
          if (cut < 6) return; // too short, or it is a river that is already there
          let pts = Array.from(cells.slice(0, cut), centre);
          let onRiver = cut < cells.length;
          if (!onRiver && r.mouth >= 0) {
            // on to the sea, a lake that was kept, or a river; the stream it joined or the
            // hollow it filled may not have been kept, so follow the water on from there
            let c = r.mouth, guard = 0;
            while (c >= 0 && guard++ < N) {
              if (mask[c]) { onRiver = true; break; }
              pts.push(centre(c));
              if (hG[c] <= 0 || hyd.lake[c]) break;
              c = hyd.down[c];
            }
          }
          if (onRiver) {
            // stopped a cell or two before the river it reaches: run on to its course
            const q = nearestRiver(pts[pts.length - 1], 6, -1);
            if (q) pts.push(q.point);
          }
          // a gentle meander, then smooth (both ends stay where they are)
          const ms = seed + 97 * si;
          pts = pts.map((p, k) => {
            if (k === 0 || k === pts.length - 1) return p;
            const a = pts[k - 1], b = pts[k + 1];
            let tx = b[0] - a[0], ty = b[1] - a[1];
            const tl = Math.hypot(tx, ty) || 1;
            tx /= tl; ty /= tl;
            const off = (vnoise(k * 0.45, 0.5, ms) - 0.5) * 0.9;
            return [p[0] - ty * off, p[1] + tx * off];
          });
          pts = TA.rdp(TA.chaikin(pts, 2, false), 0.12);
          if (TA.polylineLength(pts) < (+inp.minRiverLength || 10)) return;
          rivers.push({ name: "", pts, auto: true, width: 1 });
          addedIdx.push(rivers.length - 1);
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
      }
      hG = gridHeights();
    }

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

    // ---- 5. natural zones from the climate, only on unpainted land ----
    if (opts.biomes) {
      const clim = TA.climate(hG, W, H, inp.climate || {});
      const wet = new Uint8Array(N);
      rivers.forEach((r) => {
        TA.resamplePolyline(r.pts, 0.5).forEach((q) => {
          const cx = Math.floor(q[0]), cy = Math.floor(q[1]);
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const x = cx + dx, y = cy + dy;
              if (x >= 0 && y >= 0 && x < W && y < H) wet[y * W + x] = 1;
            }
          }
        });
      });
      const biome = new Uint8Array(N);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (hG[i] <= 0) continue;
          let nearWater = wet[i] === 1, flat = true;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
              const j = yy * W + xx;
              if (hG[j] <= 0) nearWater = true;
              if (Math.abs(hG[j] - hG[i]) > 60) flat = false;
            }
          }
          biome[i] = TA.biomeOf(clim.temp[i], Math.min(1, clim.prec[i] + (nearWater ? 0.12 : 0)), hG[i], nearWater, flat);
        }
      }
      // majority filter (5×5, twice): no speckles of desert inside a forest
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
                const b = src2[yy * W + xx];
                if (b) votes[b]++;
              }
            }
            let best = src2[i];
            for (let b = 1; b < 14; b++) if (votes[b] > votes[best]) best = b;
            biome[i] = best;
          }
        }
      }
      let land = 0, painted = 0;
      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          const i = y * RW + x;
          if (rel[i] <= 0) continue;
          land++;
          if (C[i]) continue;
          const jx = (x + 0.5) / RES + (vnoise(x / 4, y / 4, seed + 71) - 0.5) * 2.2;
          const jy = (y + 0.5) / RES + (vnoise(x / 4 + 31.7, y / 4 + 12.3, seed + 83) - 0.5) * 2.2;
          let b = biome[gIdx(jx, jy)] || biome[gIdx(x / RES, y / RES)];
          if (!b) { // a coastal cell whose analysis cell counts as water
            const gx = Math.floor(x / RES), gy = Math.floor(y / RES);
            for (let dy = -1; dy <= 1 && !b; dy++) for (let dx = -1; dx <= 1 && !b; dx++) b = biome[gIdx(gx + dx, gy + dy)];
          }
          if (!b) continue;
          C[i] = TA.COVER_OF_BIOME[b];
          painted++;
        }
      }
      report.biomePct = land ? Math.round(painted / land * 100) : 0;
    }

    const out = new Int16Array(N2);
    // rounding down keeps a river surface that was levelled from ever rising by a metre
    for (let i = 0; i < N2; i++) out[i] = clamp(Math.floor(rel[i] + sl), -8000, 9000);
    return { height: out.buffer, cover: C.buffer, rivers, report };
  };
  function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
})(typeof self !== "undefined" ? self : this);
