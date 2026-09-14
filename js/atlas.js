// AtlasForge — analysis of a custom world on the data grid and the plain-text atlas
// for AI. Uses World.dataGrid() (heights, bands, cover classes, climate) and the
// generated province geometry.
(function () {
  const App = window.App;
  const TA = window.TerrainAlgos;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const Atlas = (window.Atlas = {});

  const GW = () => window.World.GW, GH = () => window.World.GH;

  function geomPolys(g) {
    if (!g) return [];
    if (g.type === "Polygon") return [g.coordinates];
    if (g.type === "MultiPolygon") return g.coordinates;
    return [];
  }

  // exact even-odd scanline rasterization of features onto the data grid (cell centres)
  Atlas.rasterize = function (features) {
    const W = GW(), H = GH();
    const out = new Int32Array(W * H).fill(-1);
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
      const ya = clamp(Math.floor(ymin - 0.5), 0, H - 1), yb = clamp(Math.ceil(ymax), 0, H - 1);
      const xs = [];
      for (let y = ya; y <= yb; y++) {
        const sy = y + 0.5;
        xs.length = 0;
        for (let e = 0; e < edges.length; e += 4) {
          const y0 = edges[e + 1], y1 = edges[e + 3];
          if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(edges[e] + (sy - y0) * (edges[e + 2] - edges[e]) / (y1 - y0));
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        const row = y * W;
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = clamp(Math.ceil(xs[k] - 0.5), 0, W), xb = clamp(Math.floor(xs[k + 1] - 0.5), -1, W - 1);
          for (let x = xa; x <= xb; x++) out[row + x] = idx;
        }
      }
    });
    return out;
  };

  // ---------- analysis shared by province generation, cards and the atlas ----------
  Atlas.analyze = function (features, rivers) {
    const W = GW(), H = GH(), N = W * H;
    const dg = window.World.dataGrid();
    const h = dg.h, band = dg.band, cov = dg.coverClass, lake = dg.lake;
    const isLand = (i) => h[i] > 0 && !lake[i];
    const cellOf = Atlas.rasterize(features);
    const cells = features.map(() => ({ n: 0, land: 0, sx: 0, sy: 0, hsum: 0, hmax: -1e9, hmaxAt: -1, tsum: 0, psum: 0,
      bandH: [0, 0, 0, 0, 0], coverH: [0, 0, 0, 0, 0, 0], biomeH: new Map(),
      waters: new Map(), nb: new Map(), lands: new Map(), ranges: new Map(), rivers: new Set() }));
    const land = TA.components(W, H, isLand, false);
    const water = TA.components(W, H, (i) => !isLand(i), false);
    // ranges: mountain cells less than ~2 cells apart belong to one range
    const near = new Uint8Array(N), tmp = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let hit = 0;
      for (let d = -2; d <= 2 && !hit; d++) { const xx = x + d; if (xx >= 0 && xx < W && band[y * W + xx] >= 3) hit = 1; }
      tmp[y * W + x] = hit;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let hit = 0;
      for (let d = -2; d <= 2 && !hit; d++) { const yy = y + d; if (yy >= 0 && yy < H && tmp[yy * W + x]) hit = 1; }
      near[y * W + x] = hit;
    }
    const range = TA.components(W, H, (i) => near[i] === 1, true);
    range.list.forEach((c) => { c.area = 0; c.sx = c.sy = c.sxx = c.syy = c.sxy = 0; c.hmax = -1e9; c.hmaxAt = -1; c.high = 0; c.cells = new Map(); });
    for (let i = 0; i < N; i++) {
      const rc = range.comp[i];
      if (rc < 0) continue;
      if (band[i] < 3) { range.comp[i] = -1; continue; }
      const c = range.list[rc], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      c.area++; c.sx += x; c.sy += y; c.sxx += x * x; c.syy += y * y; c.sxy += x * y;
      if (band[i] === 4) c.high++;
      if (h[i] > c.hmax) { c.hmax = h[i]; c.hmaxAt = i; }
    }
    land.list.forEach((c) => { c.cells = new Map(); c.hmax = -1e9; c.hmaxAt = -1; });
    water.list.forEach((c) => {
      c.cells = new Map();
      // a water body that touches the map edge or sea-level water is sea; enclosed lake cells are lakes
      c.kind = c.edge ? "ocean" : "lake";
    });
    for (let i = 0; i < N; i++) {
      if (isLand(i)) {
        const lc = land.list[land.comp[i]];
        if (h[i] > lc.hmax) { lc.hmax = h[i]; lc.hmaxAt = i; }
      } else if (h[i] <= 0) {
        const wc = water.list[water.comp[i]];
        wc.salt = true; // contains sea-level water (not only a lake surface)
      }
    }
    water.list.forEach((c) => { if (!c.edge) c.kind = c.salt ? "sea" : "lake"; });
    const inc = (m, k, v) => m.set(k, (m.get(k) || 0) + (v || 1));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = cellOf[i];
        if (c < 0) continue;
        const cell = cells[c];
        cell.n++;
        if (x < W - 1) { const c2 = cellOf[i + 1]; if (c2 >= 0 && c2 !== c) { inc(cell.nb, c2); inc(cells[c2].nb, c); } }
        if (y < H - 1) { const c2 = cellOf[i + W]; if (c2 >= 0 && c2 !== c) { inc(cell.nb, c2); inc(cells[c2].nb, c); } }
        if (!isLand(i)) continue;
        cell.land++; cell.sx += x + 0.5; cell.sy += y + 0.5;
        cell.hsum += h[i];
        if (h[i] > cell.hmax) { cell.hmax = h[i]; cell.hmaxAt = i; }
        if (dg.temp) { cell.tsum += dg.temp[i]; cell.psum += dg.prec[i]; }
        if (dg.biome) inc(cell.biomeH, dg.biome[i]);
        cell.bandH[band[i]]++; cell.coverH[cov[i]]++;
        inc(cell.lands, land.comp[i]); inc(land.list[land.comp[i]].cells, c);
        if (range.comp[i] >= 0) { inc(cell.ranges, range.comp[i]); inc(range.list[range.comp[i]].cells, c); }
        for (let d = 1; d <= 2; d++) {
          const nbrs = [x - d >= 0 ? i - d : -1, x + d < W ? i + d : -1, y - d >= 0 ? i - d * W : -1, y + d < H ? i + d * W : -1];
          for (const j of nbrs) {
            if (j >= 0 && !isLand(j)) { const wc = water.comp[j]; inc(cell.waters, wc); inc(water.list[wc].cells, c); }
          }
        }
      }
    }
    const waterNear = (pt) => {
      if (!pt) return -1;
      for (let rr = 0; rr <= 3; rr++) {
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const x = Math.floor(pt[0]) + dx, y = Math.floor(pt[1]) + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (!isLand(y * W + x)) return water.comp[y * W + x];
        }
      }
      return -1;
    };
    const riverInfo = (rivers || []).map((rv, k) => {
      const cellsList = window.World.riverCellsOf(rv);
      const seq = [];
      for (const rc of cellsList) {
        const c = cellOf[rc];
        if (c >= 0 && isLand(rc)) {
          if (seq[seq.length - 1] !== c) seq.push(c);
          cells[c].rivers.add(k);
        }
      }
      let len = 0;
      for (let i = 1; i < rv.pts.length; i++) len += Math.hypot(rv.pts[i][0] - rv.pts[i - 1][0], rv.pts[i][1] - rv.pts[i - 1][1]);
      const uniq = seq.filter((c, i) => seq.indexOf(c) === i);
      return { k, rv, len, cells: uniq, mouthWater: waterNear(rv.pts[rv.pts.length - 1]), sourceWater: waterNear(rv.pts[0]),
        sourceHeight: h[cellsList[0]] || 0 };
    });
    return { cellOf, cells, lands: land.list, landComp: land.comp, waters: water.list, waterComp: water.comp,
      ranges: range.list, rangeComp: range.comp, rivers: riverInfo, dg };
  };

  Atlas.cellTerrain = function (cell) {
    const L = cell.land || 1;
    if ((cell.bandH[3] + cell.bandH[4]) / L >= 0.4) return "mountain";
    if ((cell.bandH[2] + cell.bandH[3] + cell.bandH[4]) / L >= 0.4) return "hills";
    let best = 0;
    for (let k = 1; k < 6; k++) if (cell.coverH[k] > cell.coverH[best]) best = k;
    return window.World.COVER_CLASSES[best];
  };

  // carry the political map over from the previous cut by pixel overlap: each new
  // province takes the owner holding most of its area, copying the biggest old record
  Atlas.remapPolitics = function (project, features, cellOfNew) {
    const W = GW(), H = GH();
    const oldFeats = (App.basemap.raw && App.basemap.raw.features) || [];
    let pairs = null, bestNewForOld = null;
    if (oldFeats.length) {
      const oldR = Atlas.rasterize(oldFeats);
      const overlap = new Map();
      for (let i = 0; i < W * H; i++) {
        const n = cellOfNew[i], o = oldR[i];
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
      const votes = features.map(() => new Map());
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
    project.regions = remapRegions(project.regions || {}, project.groups);
    remapStates(project.states || {});
    Object.keys(project.snapshots || {}).forEach((y) => {
      const snap = project.snapshots[y];
      snap.regions = remapRegions(snap.regions || {}, snap.groups);
      snap.groups = {};
      remapStates(snap.states || {});
    });
    project.groups = {};
    project.featLabels = {};
    project.regionGeomEdits = { removed: {}, features: {} };
  };

  // ---------- words ----------
  const DIRS = {
    ru: ["востоке", "северо-востоке", "севере", "северо-западе", "западе", "юго-западе", "юге", "юго-востоке"],
    en: ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
  };
  const TERR = {
    ru: { plains: "равнины", forest: "леса", desert: "пустыни", marsh: "болота", tundra: "тундра", jungle: "джунгли", hills: "холмы", mountain: "горы", high: "высокогорья" },
    en: { plains: "plains", forest: "forest", desert: "desert", marsh: "marsh", tundra: "tundra", jungle: "jungle", hills: "hills", mountain: "mountains", high: "high mountains" }
  };
  Atlas.BIOME_NAMES = {
    ru: ["вода", "ледники", "тундра", "тайга", "холодная пустыня", "полупустыня", "степи и луга", "лиственные леса",
      "влажные умеренные леса", "жаркая пустыня", "саванна", "тропические леса", "дождевые леса (джунгли)", "болота"],
    en: ["water", "glaciers", "tundra", "taiga", "cold desert", "semi-desert", "grassland", "deciduous forest",
      "temperate rainforest", "hot desert", "savanna", "tropical forest", "rainforest", "wetland"]
  };
  const dirWord = (lang, dx, dy) => DIRS[lang][((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  Atlas.dirWord = dirWord;
  function mapPosition(lang, x, y) {
    const col = x < GW() / 3 ? 0 : x > (2 * GW()) / 3 ? 2 : 1;
    const row = y < GH() / 3 ? 0 : y > (2 * GH()) / 3 ? 2 : 1;
    const ru = [["северо-запад", "север", "северо-восток"], ["запад", "центр", "восток"], ["юго-запад", "юг", "юго-восток"]];
    const en = [["north-west", "north", "north-east"], ["west", "centre", "east"], ["south-west", "south", "south-east"]];
    return (lang === "ru" ? ru : en)[row][col];
  }
  Atlas.mapPosition = mapPosition;
  function axisOf(c) {
    const mx = c.sx / c.area, my = c.sy / c.area;
    const cxx = c.sxx / c.area - mx * mx, cyy = c.syy / c.area - my * my, cxy = c.sxy / c.area - mx * my;
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    return { len: Math.sqrt(12 * Math.max(0, l1)), ang: 0.5 * Math.atan2(2 * cxy, cxx - cyy) };
  }
  Atlas.axisOf = axisOf;
  function orientation(lang, ang) {
    const deg = ang * 180 / Math.PI;
    const ru = lang === "ru";
    if (Math.abs(deg) < 22.5) return ru ? "с запада на восток" : "west to east";
    if (Math.abs(deg) > 67.5) return ru ? "с севера на юг" : "north to south";
    return deg > 0 ? (ru ? "с северо-запада на юго-восток" : "north-west to south-east") : (ru ? "с юго-запада на северо-восток" : "south-west to north-east");
  }
  Atlas.orientation = orientation;
  const precWord = (lang, p) => {
    const ru = ["очень сухо", "сухо", "умеренно влажно", "влажно", "очень влажно"];
    const en = ["very dry", "dry", "moderately wet", "wet", "very wet"];
    return (lang === "ru" ? ru : en)[clamp(Math.floor(p * 5), 0, 4)];
  };

  // shared naming of geography (labels on water / mountains / land) for cards and atlas
  Atlas.names = function (an, lang) {
    const p = App.project, W = GW(), H = GH();
    const ru = lang === "ru";
    const stateNames = new Set(Object.values(p.states).map((s) => s.name.trim().toLowerCase()));
    const waterName = {}, rangeName = {}, landName = {};
    const band = an.dg.band;
    (p.labels || []).forEach((l) => {
      const g = window.World.mapToGrid([l.x, l.y]);
      const x = Math.floor(g[0]), y = Math.floor(g[1]);
      if (x < 0 || y < 0 || x >= W || y >= H || !l.text) return;
      const i = y * W + x;
      if (an.waterComp[i] >= 0) { if (!waterName[an.waterComp[i]]) waterName[an.waterComp[i]] = l.text; return; }
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const rc = an.rangeComp[yy * W + xx];
        if (rc >= 0 && band[yy * W + xx] >= 3) { if (!rangeName[rc]) rangeName[rc] = l.text; return; }
      }
      if (stateNames.has(l.text.trim().toLowerCase())) return;
      const lc = an.landComp[i];
      if (lc >= 0 && !landName[lc]) landName[lc] = l.text;
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
      waterLabel[c.id] = waterName[c.id] || (c.kind === "lake" ? (ru ? "Озеро " : "Lake ") + (++lk) : (ru ? "Море " : "Sea ") + (++oi));
    });
    const ranges = an.ranges.filter((c) => c.area >= 20).sort((a, b) => b.area - a.area);
    const rangeLabel = {};
    ranges.forEach((c, i) => { rangeLabel[c.id] = rangeName[c.id] || (ru ? "Горы " : "Mountains ") + (i + 1); });
    const riverLabel = {};
    let rn = 0;
    an.rivers.forEach((ri) => { riverLabel[ri.k] = ri.rv.name || (ru ? "Река " : "River ") + (++rn); });
    return { totalLand, lands, landLabel, waters, waterLabel, ranges, rangeLabel, riverLabel };
  };

  // ---------- the atlas ----------
  Atlas.build = function (opts) {
    opts = opts || {};
    const World = window.World;
    const p = App.project, bm = App.basemap;
    if (!World.active() || !bm || bm.status !== "ready") return "";
    const lang = App.ui.lang === "ru" ? "ru" : "en";
    const ru = lang === "ru";
    const w = p.world;
    const km = +w.scaleKm || 5;
    const fmt = (v) => Math.round(v).toLocaleString(ru ? "ru-RU" : "en-US");
    const m = (v) => fmt(Math.round(v / 10) * 10) + (ru ? " м" : " m");
    const feats = (bm.raw && bm.raw.features) || [];
    const rivers = World.displayRivers();
    const an = Atlas.analyze(feats, rivers);
    const N = Atlas.names(an, lang);
    const W = GW();
    const idx = {};
    feats.forEach((f, i) => { idx[String(f.id)] = i; });
    const eff = (id) => window.effRegion(p, id) || {};
    const provName = (i) => {
      const f = feats[i], id = String(f.id), r = p.regions[id];
      return (r && r.name) || (f.properties && f.properties.name) || id;
    };
    const ownerOf = (i) => { const e = eff(String(feats[i].id)); return e.owner && p.states[e.owner] ? e.owner : null; };
    const stName = (sid) => (sid ? p.states[sid].name : (ru ? "ничейные земли" : "unclaimed land"));
    const cellC = (i) => { const c = an.cells[i]; return c.land ? [c.sx / c.land, c.sy / c.land] : [0, 0]; };
    const terrainPct = (list) => {
      const hh = { plains: 0, forest: 0, desert: 0, marsh: 0, tundra: 0, jungle: 0, hills: 0, mountain: 0, high: 0 };
      let tot = 0;
      list.forEach((i) => {
        const c = an.cells[i];
        tot += c.land;
        hh.high += c.bandH[4]; hh.mountain += c.bandH[3]; hh.hills += c.bandH[2];
        const low = c.land ? c.bandH[1] / c.land : 0;
        for (let k = 0; k < 6; k++) hh[World.COVER_CLASSES[k]] += c.coverH[k] * low;
      });
      if (!tot) return "";
      return Object.keys(hh).map((k) => [k, hh[k] / tot]).filter((e) => e[1] >= 0.05).sort((a, b) => b[1] - a[1])
        .map((e) => TERR[lang][e[0]] + " " + Math.round(e[1] * 100) + "%").join(", ");
    };
    const climateOf = (list) => {
      let t = 0, pr = 0, n = 0;
      const bio = new Map();
      list.forEach((i) => {
        const c = an.cells[i];
        t += c.tsum; pr += c.psum; n += c.land;
        c.biomeH.forEach((v, k) => bio.set(k, (bio.get(k) || 0) + v));
      });
      if (!n || !an.dg.temp) return "";
      const top = [...bio.entries()].filter(([k]) => k > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .filter(([, v]) => v / n >= 0.08).map(([k, v]) => Atlas.BIOME_NAMES[lang][k] + " " + Math.round(v / n * 100) + "%");
      return ru ? `Климат: в среднем ${Math.round(t / n)} °C на уровне местности, ${precWord(lang, pr / n)}${top.length ? "; природные зоны: " + top.join(", ") : ""}.`
        : `Climate: average ${Math.round(t / n)} °C at ground level, ${precWord(lang, pr / n)}${top.length ? "; biomes: " + top.join(", ") : ""}.`;
    };
    const listJoin = (arr) => arr.filter(Boolean).join(", ");
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
        : `~${fmt(d)} km as the crow flies (≈${Math.max(1, Math.round(d / 25))} days on foot, ≈${Math.max(1, Math.round(d / 50))} days riding)`;
    };
    const at = (i) => [(i % W) + 0.5, ((i / W) | 0) + 0.5];

    const L = [];
    const title = p.name || (ru ? "Мир" : "World");
    L.push(ru ? `# Атлас мира «${title}»` : `# World atlas: ${title}`);
    L.push("");
    const cl = w.climate || {};
    if (ru) {
      L.push(`Текстовое описание карты вымышленного мира. Север сверху. Координаты (x, y) — километры от западного и северного края. Карта ${fmt(GW() * km)} × ${fmt(GH() * km)} км, суша ≈ ${fmt(N.totalLand * km * km)} км². Верхний край карты на ${cl.latTop ?? 70}° широты, нижний на ${cl.latBottom ?? -10}°. Высоты — над уровнем моря. Расстояния — по прямой; дни пути — грубо (25 км/день пешком, 50 км/день верхом).`);
      if (p.currentYear != null) L.push(`Политическая карта — на ${p.currentYear} год.`);
      if (w.genRev != null && w.genRev !== w.rev) L.push("⚠ Рельеф менялся после нарезки провинций — границы провинций могут не совпадать с берегами.");
    } else {
      L.push(`A text description of a fictional world map. North is up. Coordinates (x, y) are kilometres from the west and north edges. The map is ${fmt(GW() * km)} × ${fmt(GH() * km)} km, land ≈ ${fmt(N.totalLand * km * km)} km². The top edge lies at ${cl.latTop ?? 70}° latitude, the bottom at ${cl.latBottom ?? -10}°. Heights are above sea level. Distances are straight-line; travel days are rough (25 km/day on foot, 50 km/day riding).`);
      if (p.currentYear != null) L.push(`Political map as of year ${p.currentYear}.`);
      if (w.genRev != null && w.genRev !== w.rev) L.push("⚠ Terrain was edited after provinces were generated — borders may not match coasts.");
    }
    L.push("");

    // ---- geography ----
    L.push(ru ? "## География" : "## Geography");
    L.push("");
    L.push(ru ? "### Материки и острова" : "### Landmasses");
    N.lands.forEach((c) => {
      const cx = c.sx / c.area, cy = c.sy / c.area;
      const cellsHere = [...c.cells.keys()];
      const owners = {};
      cellsHere.forEach((ci) => { const o = ownerOf(ci); if (o) owners[o] = (owners[o] || 0) + c.cells.get(ci); });
      const ownerList = Object.keys(owners).sort((a, b) => owners[b] - owners[a]).map((o) => p.states[o].name);
      const rangesHere = N.ranges.filter((r) => an.landComp[Math.floor(r.sy / r.area) * W + Math.floor(r.sx / r.area)] === c.id).map((r) => N.rangeLabel[r.id]);
      const seas = N.waters.filter((wc) => cellsHere.some((ci) => an.cells[ci].waters.has(wc.id))).map((wc) => N.waterLabel[wc.id]);
      const peak = c.hmaxAt >= 0 ? at(c.hmaxAt) : null;
      L.push(ru
        ? `- **${N.landLabel[c.id]}** — ${mapPosition(lang, cx, cy)} карты, центр (${fmt(cx * km)}, ${fmt(cy * km)}), ≈${fmt(c.area * km * km)} км², ${fmt((c.maxx - c.minx + 1) * km)} × ${fmt((c.maxy - c.miny + 1) * km)} км.${peak ? ` Высшая точка ${m(c.hmax)} (${fmt(peak[0] * km)}, ${fmt(peak[1] * km)}).` : ""}${cellsHere.length ? ` Провинций: ${cellsHere.length}. Рельеф: ${terrainPct(cellsHere)}.` : ""}${ownerList.length ? ` Государства: ${listJoin(ownerList)}.` : ""}${rangesHere.length ? ` Горы: ${listJoin(rangesHere)}.` : ""}${seas.length ? ` Омывается: ${listJoin(seas)}.` : ""}`
        : `- **${N.landLabel[c.id]}** — ${mapPosition(lang, cx, cy)} of the map, centre (${fmt(cx * km)}, ${fmt(cy * km)}), ≈${fmt(c.area * km * km)} km², ${fmt((c.maxx - c.minx + 1) * km)} × ${fmt((c.maxy - c.miny + 1) * km)} km.${peak ? ` Highest point ${m(c.hmax)} (${fmt(peak[0] * km)}, ${fmt(peak[1] * km)}).` : ""}${cellsHere.length ? ` Provinces: ${cellsHere.length}. Terrain: ${terrainPct(cellsHere)}.` : ""}${ownerList.length ? ` States: ${listJoin(ownerList)}.` : ""}${rangesHere.length ? ` Mountains: ${listJoin(rangesHere)}.` : ""}${seas.length ? ` Coasts on: ${listJoin(seas)}.` : ""}`);
    });
    L.push("");
    if (N.waters.length) {
      L.push(ru ? "### Моря и озёра" : "### Seas and lakes");
      N.waters.forEach((c) => {
        const owners = [...new Set([...c.cells.keys()].map(ownerOf).filter(Boolean))].map((o) => p.states[o].name);
        const cx = c.sx / c.area, cy = c.sy / c.area;
        const kind = c.kind === "ocean" ? (ru ? "море/океан (выходит к краю карты)" : "sea/ocean (reaches the map edge)")
          : c.kind === "sea" ? (ru ? "внутреннее море" : "inland sea") : (ru ? "озеро" : "lake");
        L.push(ru ? `- **${N.waterLabel[c.id]}** — ${kind}, ${mapPosition(lang, cx, cy)} карты, ≈${fmt(c.area * km * km)} км².${owners.length ? ` Берега: ${listJoin(owners)}.` : ""}`
          : `- **${N.waterLabel[c.id]}** — ${kind}, ${mapPosition(lang, cx, cy)} of the map, ≈${fmt(c.area * km * km)} km².${owners.length ? ` Shores: ${listJoin(owners)}.` : ""}`);
      });
      L.push("");
    }
    if (N.ranges.length) {
      L.push(ru ? "### Горы" : "### Mountain ranges");
      N.ranges.forEach((c) => {
        const ax = axisOf(c);
        const cx = c.sx / c.area, cy = c.sy / c.area;
        const cellsHere = [...c.cells.keys()].sort((a, b) => c.cells.get(b) - c.cells.get(a));
        const owners = [...new Set(cellsHere.map(ownerOf).filter(Boolean))].map((o) => p.states[o].name);
        const peak = at(c.hmaxAt);
        const snowy = c.high / c.area >= 0.1;
        L.push(ru
          ? `- **${N.rangeLabel[c.id]}** — ${mapPosition(lang, cx, cy)} карты, тянутся ${orientation(lang, ax.ang)} на ~${fmt(Math.max(ax.len, 1) * km)} км. Высшая вершина ${m(c.hmax)} (${fmt(peak[0] * km)}, ${fmt(peak[1] * km)})${snowy ? ", вершины в снегах" : ""}.${cellsHere.length ? ` Провинции: ${listJoin(cellsHere.slice(0, 12).map(provName))}${cellsHere.length > 12 ? " и др" : ""}.` : ""}${owners.length ? ` Государства: ${listJoin(owners)}.` : ""}`
          : `- **${N.rangeLabel[c.id]}** — ${mapPosition(lang, cx, cy)} of the map, running ${orientation(lang, ax.ang)} for ~${fmt(Math.max(ax.len, 1) * km)} km. Highest peak ${m(c.hmax)} (${fmt(peak[0] * km)}, ${fmt(peak[1] * km)})${snowy ? ", snow-capped" : ""}.${cellsHere.length ? ` Provinces: ${listJoin(cellsHere.slice(0, 12).map(provName))}${cellsHere.length > 12 ? " etc" : ""}.` : ""}${owners.length ? ` States: ${listJoin(owners)}.` : ""}`);
      });
      L.push("");
    }
    const bigRivers = an.rivers.filter((ri) => ri.rv.hand || ri.rv.name || (ri.rv.order || 0) >= 2 || ri.len >= 25);
    if (bigRivers.length) {
      L.push(ru ? "### Реки" : "### Rivers");
      bigRivers.sort((a, b) => b.len - a.len).forEach((ri) => {
        const path = ri.cells.map((i) => `${provName(i)} (${stName(ownerOf(i))})`);
        const into = ri.rv.into >= 0 ? an.rivers.find((x) => x.rv.index === ri.rv.into) : null;
        const mouth = into ? N.riverLabel[into.k] : ri.mouthWater >= 0 ? (N.waterLabel[ri.mouthWater] || (ru ? "водоём" : "a body of water")) : null;
        const navigable = (ri.rv.order || 0) >= 4 || (ri.rv.flux && ri.rv.flux >= (+w.riverThreshold || 60) * 12);
        L.push(ru
          ? `- **${N.riverLabel[ri.k]}** — ~${fmt(ri.len * km)} км${ri.rv.order ? `, порядок ${ri.rv.order}` : ""}${navigable ? ", судоходна" : ""}. ${ri.sourceHeight > 0 ? `Исток на высоте ${m(ri.sourceHeight)}. ` : ""}${path.length ? `От истока к устью: ${path.join(" → ")}. ` : ""}${mouth ? `Впадает в: ${mouth}.` : ""}`
          : `- **${N.riverLabel[ri.k]}** — ~${fmt(ri.len * km)} km${ri.rv.order ? `, order ${ri.rv.order}` : ""}${navigable ? ", navigable" : ""}. ${ri.sourceHeight > 0 ? `Source at ${m(ri.sourceHeight)}. ` : ""}${path.length ? `Source to mouth: ${path.join(" → ")}. ` : ""}${mouth ? `Flows into: ${mouth}.` : ""}`);
      });
      L.push("");
    }

    // ---- objects (cities, fortresses…) ----
    const objLines = window.Objects ? window.Objects.atlasLines(p, lang, { km, fmt, provinceAt: (x, y) => {
      const i = an.cellOf[clamp(Math.floor(y), 0, GH() - 1) * W + clamp(Math.floor(x), 0, W - 1)];
      return i >= 0 ? { name: provName(i), owner: ownerOf(i) } : null;
    } }) : [];

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
        let hmax = -1e9, hsum = 0;
        list.forEach((i) => { const c = an.cells[i]; hsum += c.hsum; if (c.hmax > hmax) hmax = c.hmax; });
        L.push(ru
          ? `- Территория: ${list.length} пров., ≈${fmt(area * km * km)} км², ${mapPosition(lang, cen[0], cen[1])} карты, центр (${fmt(cen[0] * km)}, ${fmt(cen[1] * km)}).${capital ? ` Столица: ${capital}.` : ""}`
          : `- Territory: ${list.length} provinces, ≈${fmt(area * km * km)} km², ${mapPosition(lang, cen[0], cen[1])} of the map, centre (${fmt(cen[0] * km)}, ${fmt(cen[1] * km)}).${capital ? ` Capital: ${capital}.` : ""}`);
        const landsHere = [...new Set(list.map((i) => { const mm = an.cells[i].lands; let b = -1, bv = 0; mm.forEach((v, k) => { if (v > bv) { bv = v; b = k; } }); return b; }))]
          .filter((k) => N.landLabel[k]).map((k) => N.landLabel[k]);
        L.push(ru ? `- Рельеф: ${terrainPct(list)}. Средняя высота ${m(area ? hsum / area : 0)}, высшая точка ${m(hmax)}.${landsHere.length ? ` Расположено на: ${listJoin(landsHere)}.` : ""}`
          : `- Terrain: ${terrainPct(list)}. Mean elevation ${m(area ? hsum / area : 0)}, highest point ${m(hmax)}.${landsHere.length ? ` Located on: ${listJoin(landsHere)}.` : ""}`);
        const clim = climateOf(list);
        if (clim) L.push("- " + clim);
        const coastWaters = new Map();
        list.forEach((i) => an.cells[i].waters.forEach((v, wc) => { if (N.waterLabel[wc]) coastWaters.set(wc, (coastWaters.get(wc) || 0) + 1); }));
        const coastCount = list.filter((i) => [...an.cells[i].waters.keys()].some((wc) => N.waterLabel[wc])).length;
        if (coastWaters.size) {
          L.push(ru ? `- Выход к воде: ${[...coastWaters.keys()].map((wc) => N.waterLabel[wc]).join(", ")} (прибрежных провинций: ${coastCount}).`
            : `- Coast on: ${[...coastWaters.keys()].map((wc) => N.waterLabel[wc]).join(", ")} (${coastCount} coastal provinces).`);
        } else {
          L.push(ru ? "- Выхода к морю нет." : "- Landlocked.");
        }
        const rv = bigRivers.filter((ri) => list.some((i) => an.cells[i].rivers.has(ri.k))).map((ri) => N.riverLabel[ri.k]);
        const rng = N.ranges.filter((r) => list.some((i) => r.cells.has(i))).map((r) => N.rangeLabel[r.id]);
        if (rv.length || rng.length) {
          L.push(ru ? `- ${rv.length ? `Реки: ${listJoin(rv)}. ` : ""}${rng.length ? `Горы: ${listJoin(rng)}.` : ""}`
            : `- ${rv.length ? `Rivers: ${listJoin(rv)}. ` : ""}${rng.length ? `Mountains: ${listJoin(rng)}.` : ""}`);
        }
        const nb = neighborsOf(list);
        const nbKeys = Object.keys(nb).sort((a, b) => nb[b] - nb[a]);
        if (nbKeys.length) {
          L.push(ru ? "- Сухопутные соседи:" : "- Land neighbours:");
          nbKeys.forEach((o) => {
            const border = fmt(nb[o] * 0.8 * km);
            if (o === "__none") { L.push(ru ? `  - ничейные земли (граница ~${border} км)` : `  - unclaimed land (border ~${border} km)`); return; }
            const oc = stateCentre(o);
            L.push(ru ? `  - ${p.states[o].name} — на ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, общая граница ~${border} км; от столицы до столицы ${distTxt(cen, oc)}`
              : `  - ${p.states[o].name} — to the ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, shared border ~${border} km; capital to capital ${distTxt(cen, oc)}`);
          });
        } else {
          L.push(ru ? "- Сухопутных соседей нет." : "- No land neighbours.");
        }
        const seaN = new Set();
        coastWaters.forEach((v, wc) => an.waters[wc].cells.forEach((cnt, ci) => { const o = ownerOf(ci); if (o && o !== sid && !nb[o]) seaN.add(o); }));
        if (seaN.size) {
          L.push(ru ? "- Соседи через воду:" : "- Across the water:");
          [...seaN].forEach((o) => {
            const oc = stateCentre(o);
            L.push(ru ? `  - ${p.states[o].name} — на ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, ${distTxt(cen, oc)}`
              : `  - ${p.states[o].name} — to the ${dirWord(lang, oc[0] - cen[0], oc[1] - cen[1])}, ${distTxt(cen, oc)}`);
          });
        }
        objLines.filter((o) => o.owner === sid).slice(0, 40).forEach((o, k) => { if (!k) L.push(ru ? "- Города и места:" : "- Places:"); L.push("  - " + o.text); });
        if (st.notes && String(st.notes).trim()) L.push((ru ? "- Заметки: " : "- Notes: ") + String(st.notes).trim().replace(/\s+/g, " "));
        L.push("");
      });
    }
    const loose = objLines.filter((o) => !o.owner || !p.states[o.owner] || !stateCells[o.owner]);
    if (loose.length) {
      L.push(ru ? "## Места вне государств" : "## Places outside states");
      loose.forEach((o) => L.push("- " + o.text));
      L.push("");
    }
    const unowned = feats.map((f, i) => i).filter((i) => !ownerOf(i) && an.cells[i].land);
    if (unowned.length && sids.length) {
      L.push(ru ? `Ничейные земли: ${unowned.length} пров., ≈${fmt(unowned.reduce((s, i) => s + an.cells[i].land, 0) * km * km)} км².` : `Unclaimed land: ${unowned.length} provinces, ≈${fmt(unowned.reduce((s, i) => s + an.cells[i].land, 0) * km * km)} km².`);
      L.push("");
    }

    // ---- provinces ----
    if (opts.provinces !== false && feats.length) {
      L.push(ru ? "## Провинции" : "## Provinces");
      L.push(ru ? "Формат: название [id] — владелец; рельеф; высота (средняя / максимум); центр (x, y) км; побережье; реки; соседи." : "Format: name [id] — owner; terrain; elevation (mean / max); centre (x, y) km; coast; rivers; neighbours.");
      L.push("");
      feats.forEach((f, i) => {
        const c = an.cells[i];
        if (!c.land) return;
        const cc = cellC(i);
        const e = eff(String(f.id));
        const parts = [stName(ownerOf(i))];
        if (e.status && e.status !== "core" && ownerOf(i)) parts[0] += ` (${e.status})`;
        parts.push(terrainPct([i]));
        parts.push(`${m(c.hsum / c.land)} / ${m(c.hmax)}`);
        parts.push(`(${fmt(cc[0] * km)}, ${fmt(cc[1] * km)})`);
        const wn = [...c.waters.keys()].filter((wc) => N.waterLabel[wc]).map((wc) => N.waterLabel[wc]);
        if (wn.length) parts.push((ru ? "берег: " : "coast: ") + wn.join(", "));
        const rn = bigRivers.filter((ri) => c.rivers.has(ri.k)).map((ri) => N.riverLabel[ri.k]);
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
