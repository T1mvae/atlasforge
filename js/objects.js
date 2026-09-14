// AtlasForge — places on the map: cities, fortresses, ports, ruins… and roads between
// them. Works on every basemap; positions are MAP coordinates (the 2000×1020 frame,
// like labels), so they stay put for a given basemap. On custom worlds roads follow the
// terrain (A* over the data grid) and the atlas lists every place.
(function () {
  const App = window.App;
  const Actions = window.Actions;

  // size: icon scale; city: counts as a settlement (province seeds, atlas "cities")
  const TYPES = [
    { id: "village", size: 0.7, city: true },
    { id: "town", size: 0.85, city: true },
    { id: "city", size: 1, city: true },
    { id: "capital", size: 1.15, city: true },
    { id: "port", size: 0.95, city: true },
    { id: "fortress", size: 1 },
    { id: "castle", size: 0.95 },
    { id: "tower", size: 0.8 },
    { id: "ruins", size: 0.85 },
    { id: "temple", size: 0.9 },
    { id: "monastery", size: 0.9 },
    { id: "mine", size: 0.8 },
    { id: "lighthouse", size: 0.8 },
    { id: "bridge", size: 0.8 },
    { id: "pass", size: 0.85 },
    { id: "battle", size: 0.85 },
    { id: "camp", size: 0.75 },
    { id: "marker", size: 0.8 }
  ];
  const TYPE = Object.fromEntries(TYPES.map((t0) => [t0.id, t0]));
  const ROAD_KINDS = ["road", "trail", "sea"];

  const Objects = (window.Objects = { TYPES, TYPE, ROAD_KINDS });

  const ensure = (p) => {
    if (!p.objects) p.objects = {};
    if (!p.roads) p.roads = {};
  };

  // visible in the current timeline year?
  Objects.visible = function (o, p) {
    const y = p && p.currentYear;
    if (y == null) return true;
    if (o.founded != null && o.founded !== "" && +o.founded > y) return false;
    if (o.destroyed != null && o.destroyed !== "" && +o.destroyed <= y) return false;
    return true;
  };

  Objects.list = function (p) {
    p = p || App.project;
    return p && p.objects ? Object.values(p.objects) : [];
  };

  Actions.addObject = function (type, x, y, patch) {
    let id = null;
    Actions.mut((p) => {
      ensure(p);
      id = window.uid();
      const n = Object.values(p.objects).filter((o) => o.type === type).length + 1;
      p.objects[id] = Object.assign({ id, type, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100,
        name: t("obj.type." + type) + " " + n, population: "", owner: null, founded: null, destroyed: null,
        notes: "", importance: 2, labelDx: 0, labelDy: 0 }, patch || {});
    });
    return id;
  };
  Actions.setObject = function (id, patch, opts) {
    Actions.mut((p) => { if (p.objects && p.objects[id]) Object.assign(p.objects[id], patch); }, opts);
  };
  Actions.deleteObject = function (id) {
    Actions.mut((p) => {
      if (!p.objects) return;
      delete p.objects[id];
      for (const rid in (p.roads || {})) {
        const r = p.roads[rid];
        if (r.from === id || r.to === id) delete p.roads[rid];
      }
    });
  };
  Actions.deleteRoad = function (id) {
    Actions.mut((p) => { if (p.roads) delete p.roads[id]; });
  };
  Actions.setRoad = function (id, patch, opts) {
    Actions.mut((p) => { if (p.roads && p.roads[id]) Object.assign(p.roads[id], patch); }, opts);
  };

  // the province under a place and its owner (explicit owner wins)
  Objects.provinceOf = function (o) {
    if (!window.GeomEdit || !GeomEdit.enabled || !GeomEdit.enabled()) return null;
    try { return GeomEdit.regionAt(o.x, o.y); } catch (e) { return null; }
  };
  Objects.ownerOf = function (o, p) {
    p = p || App.project;
    if (o.owner && p.states[o.owner]) return o.owner;
    const rid = Objects.provinceOf(o);
    const e = rid ? window.effRegion(p, rid) : null;
    return e && e.owner && p.states[e.owner] ? e.owner : null;
  };

  // settlements as province seeds for smart generation (data units)
  Objects.citySeeds = function (p) {
    if (!window.World || !World.active()) return [];
    return Objects.list(p).filter((o) => TYPE[o.type] && TYPE[o.type].city).map((o) => World.mapToGrid([o.x, o.y]));
  };

  // ---------- roads ----------
  function mapLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }
  // road length in km (custom worlds only: the frame has a real scale)
  Objects.roadKm = function (road, p) {
    p = p || App.project;
    if (!window.World || !World.active() || !road.pts || road.pts.length < 2) return null;
    const perCell = World.mapUnitsPerCell();
    return mapLength(road.pts) / perCell * (+p.world.scaleKm || 5);
  };
  // speed per road kind (km/day)
  Objects.dayKm = { road: 40, trail: 25, sea: 120 };

  // A* over the custom world's data grid. Land routes avoid water, prefer low ground
  // and gentle slopes and take passes through ranges; sea routes stay on water.
  function routeOnWorld(a, b, kind) {
    const W = World.GW, H = World.GH;
    const dg = World.dataGrid();
    const h = dg.h, lake = dg.lake;
    const ga = World.mapToGrid([a.x, a.y]), gb = World.mapToGrid([b.x, b.y]);
    const sx = Math.max(0, Math.min(W - 1, Math.floor(ga[0]))), sy = Math.max(0, Math.min(H - 1, Math.floor(ga[1])));
    const tx = Math.max(0, Math.min(W - 1, Math.floor(gb[0]))), ty = Math.max(0, Math.min(H - 1, Math.floor(gb[1])));
    const start = sy * W + sx, goal = ty * W + tx;
    const sea = kind === "sea";
    const isWater = (i) => h[i] <= 0 || lake[i];
    const N = W * H;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new window.TerrainAlgos.Heap(N);
    const NX = [1, -1, 0, 0, 1, 1, -1, -1], NY = [0, 0, 1, -1, 1, -1, 1, -1], ND = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
    const hx = (i) => Math.hypot(i % W - tx, ((i / W) | 0) - ty);
    g[start] = 0;
    heap.push(start, hx(start));
    // rivers slow a land road down (fords, bridges)
    const riverCell = new Uint8Array(N);
    if (!sea) World.displayRivers().forEach((rv) => { if (rv.major) World.riverCellsOf(rv).forEach((c) => { riverCell[c] = 1; }); });
    let found = false, steps = 0;
    while (heap.n && steps++ < N * 2) {
      const c = heap.pop();
      if (closed[c]) continue;
      closed[c] = 1;
      if (c === goal) { found = true; break; }
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const xx = cx + NX[k], yy = cy + NY[k];
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (closed[n]) continue;
        let cost;
        if (sea) {
          if (!isWater(n) && n !== goal) continue;
          cost = ND[k];
        } else {
          if (isWater(n) && n !== goal) continue;
          const climb = Math.abs(h[n] - h[c]);
          const alt = h[n];
          cost = ND[k] * (1 + climb / 60 + (alt > 3500 ? 30 : alt > 1500 ? 5 : alt > 500 ? 1.2 : 0)) + (riverCell[n] && !riverCell[c] ? 4 : 0);
        }
        const ng = g[c] + cost;
        if (ng < g[n]) { g[n] = ng; from[n] = c; heap.push(n, ng + hx(n)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c >= 0; c = from[c]) cells.push(c);
    cells.reverse();
    let pts = cells.map((c) => [c % W + 0.5, ((c / W) | 0) + 0.5]);
    pts[0] = ga; pts[pts.length - 1] = gb;
    pts = window.TerrainAlgos.rdp(window.TerrainAlgos.chaikin(pts, 2, false), 0.35);
    const proj = App.basemap.proj;
    return pts.map((q) => { const m = proj(q); return [Math.round(m[0] * 100) / 100, Math.round(m[1] * 100) / 100]; });
  }

  Actions.addRoad = function (fromId, toId, kind) {
    const p = App.project;
    const a = p.objects && p.objects[fromId], b = p.objects && p.objects[toId];
    if (!a || !b || fromId === toId) return null;
    kind = kind || "road";
    let pts = null;
    if (window.World && World.active()) {
      pts = routeOnWorld(a, b, kind);
      if (!pts) { Actions.toast(t(kind === "sea" ? "obj.noSeaRoute" : "obj.noLandRoute")); return null; }
    } else {
      pts = [[a.x, a.y], [b.x, b.y]];
    }
    let id = null;
    Actions.mut((pp) => {
      ensure(pp);
      id = window.uid();
      pp.roads[id] = { id, kind, from: fromId, to: toId, pts, name: "" };
    });
    return id;
  };

  // ---------- atlas ----------
  Objects.atlasLines = function (p, lang, ctx) {
    const ru = lang === "ru";
    const out = [];
    const typeName = (ty) => t("obj.type." + ty);
    Objects.list(p).filter((o) => Objects.visible(o, p)).forEach((o) => {
      const g = World.mapToGrid([o.x, o.y]);
      const prov = ctx.provinceAt(g[0], g[1]);
      const owner = o.owner && p.states[o.owner] ? o.owner : prov && prov.owner;
      const parts = [`**${o.name || typeName(o.type)}** — ${typeName(o.type).toLowerCase()}`];
      if (o.population) parts.push((ru ? "население " : "population ") + o.population);
      if (prov) parts.push((ru ? "провинция " : "province ") + prov.name);
      parts.push(`(${ctx.fmt(g[0] * ctx.km)}, ${ctx.fmt(g[1] * ctx.km)})`);
      if (o.founded != null && o.founded !== "") parts.push((ru ? "основан в " : "founded ") + o.founded);
      if (o.notes && String(o.notes).trim()) parts.push(String(o.notes).trim().replace(/\s+/g, " "));
      const roads = Object.values(p.roads || {}).filter((r) => r.from === o.id || r.to === o.id).map((r) => {
        const other = p.objects[r.from === o.id ? r.to : r.from];
        const km = Objects.roadKm(r, p);
        if (!other) return null;
        const days = km ? Math.max(1, Math.round(km / (Objects.dayKm[r.kind] || 30))) : null;
        return `${t("obj.road." + r.kind).toLowerCase()} → ${other.name}${km ? ` ~${ctx.fmt(km)} ${ru ? "км" : "km"}, ≈${days} ${ru ? "дн." : "d"}` : ""}`;
      }).filter(Boolean);
      if (roads.length) parts.push((ru ? "пути: " : "routes: ") + roads.join("; "));
      out.push({ owner, text: parts.join(", ") });
    });
    return out;
  };
})();
