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
  // painted cover classes (js/world.js COVER) each biome falls into
  TA.BIOME_COVER = [null, "tundra", "tundra", "forest", "desert", "desert", "plains",
    "forest", "forest", "desert", "plains", "jungle", "jungle", "marsh"];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
})(typeof self !== "undefined" ? self : this);
