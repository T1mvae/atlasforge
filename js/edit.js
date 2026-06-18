// AtlasForge — manual region repair: merge / split / draw / vertex edit / delete,
// snapping, edit persistence (project JSON) and export of the edited layer.
// Edits never touch the base dataset: they live in project.regionGeomEdits as
// { removed: {id:true}, features: { id: {geometry(lon/lat), name, props} } }
// and are re-applied over the freshly loaded base GeoJSON on every load.
(function () {
  const App = window.App;
  const Actions = window.Actions;
  const uid = window.uid;

  const GeomEdit = (window.GeomEdit = {});

  // ---------------- availability ----------------
  GeomEdit.enabled = function () {
    const bm = App.basemap;
    return !!(bm && bm.status === "ready" && bm.raw && bm.proj && bm.proj.invert);
  };

  function ensure(p) {
    if (!p.regionGeomEdits) p.regionGeomEdits = { removed: {}, features: {} };
    if (!p.regionGeomEdits.removed) p.regionGeomEdits.removed = {};
    if (!p.regionGeomEdits.features) p.regionGeomEdits.features = {};
    return p.regionGeomEdits;
  }

  // ---------------- geometry helpers (lon/lat MultiPolygon arrays) ----------------
  // normalize GeoJSON geometry -> polygon-clipping MultiPolygon [poly[ring[[x,y]]]]
  function toMP(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return [geom.coordinates];
    if (geom.type === "MultiPolygon") return geom.coordinates;
    return [];
  }
  function fromMP(mp) {
    if (!mp || !mp.length) return null;
    // d3 spherical winding: exterior rings clockwise in planar lon/lat.
    // edge prev(j) -> cur(i): sum (x2-x1)(y2+y1) > 0 => clockwise (y-up)
    const area2 = (ring) => {
      let s = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
        s += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
      return s;
    };
    const fix = (poly) => poly.map((ring, ri) => {
      const cw = area2(ring) > 0;
      const wantCW = ri === 0;
      return cw === wantCW ? ring : ring.slice().reverse();
    });
    const polys = mp.map(fix);
    if (polys.length === 1) return { type: "Polygon", coordinates: polys[0] };
    return { type: "MultiPolygon", coordinates: polys };
  }
  function mpArea(mp) {
    let s = 0;
    mp.forEach((poly) => poly.forEach((ring, ri) => {
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
        a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
      s += (ri === 0 ? 1 : -1) * Math.abs(a / 2);
    }));
    return s;
  }
  function pcUnion(mps) {
    const valid = mps.filter((m) => m && m.length);
    if (!valid.length) return null;
    try { return polygonClipping.union.apply(polygonClipping, valid); }
    catch (e) { console.warn("union failed", e); return null; }
  }
  function pcDiff(a, b) {
    try { return polygonClipping.difference(a, b); }
    catch (e) { console.warn("difference failed", e); return null; }
  }
  function pcIntersect(a, b) {
    try { return polygonClipping.intersection(a, b); }
    catch (e) { return null; }
  }

  // Douglas-Peucker on one ring (keeps first/last)
  function rdp(pts, eps) {
    if (pts.length < 4) return pts;
    const sqEps = eps * eps;
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let maxD = -1, maxI = -1;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) {
        const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
        const px = ax + t * dx - pts[i][0], py = ay + t * dy - pts[i][1];
        const d = px * px + py * py;
        if (d > maxD) { maxD = d; maxI = i; }
      }
      if (maxD > sqEps) { keep[maxI] = true; stack.push([a, maxI], [maxI, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  // Chaikin corner cutting (one pass, closed ring)
  function chaikin(pts) {
    if (pts.length < 4) return pts;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    return out;
  }
  GeomEdit.rdp = rdp; GeomEdit.chaikin = chaikin;

  // ---------------- effective collection (base + edits) ----------------
  GeomEdit.applyToCollection = function (gj, edits) {
    const removed = (edits && edits.removed) || {};
    const extra = (edits && edits.features) || {};
    const out = [];
    (gj.features || []).forEach((f) => {
      const pid = String((f.id != null ? f.id : (f.properties || {}).id) || "");
      if (removed[pid]) return;
      if (extra[pid]) return; // replaced by modified version below
      const props = f.properties || {};
      out.push({ type: "Feature", id: pid || undefined, geometry: f.geometry,
                 properties: props });
    });
    for (const id in extra) {
      const rec = extra[id];
      if (!rec || !rec.geometry) continue;
      out.push({
        type: "Feature", id,
        geometry: rec.geometry,
        properties: Object.assign({ id, name: rec.name || id }, rec.props || {})
      });
    }
    return { type: "FeatureCollection", features: out };
  };

  // hash so geo.js can cache topology builds
  GeomEdit.editsKey = function (p) {
    const e = p && p.regionGeomEdits;
    if (!e) return "0";
    return Object.keys(e.removed || {}).length + ":" + Object.keys(e.features || {}).length + ":" +
      JSON.stringify(Object.keys(e.features || {}).sort());
  };

  // raw lon/lat geometry of a region as currently effective
  function rawGeom(id) {
    const p = App.project;
    const e = p && p.regionGeomEdits;
    if (e && e.features && e.features[id]) return e.features[id].geometry;
    const f = App.basemap.rawById && App.basemap.rawById[id];
    return f ? f.geometry : null;
  }
  GeomEdit.rawGeom = rawGeom;

  function rawProps(id) {
    const p = App.project;
    const e = p && p.regionGeomEdits;
    if (e && e.features && e.features[id]) return Object.assign({ name: e.features[id].name }, e.features[id].props || {});
    const f = App.basemap.rawById && App.basemap.rawById[id];
    return f ? (f.properties || {}) : {};
  }

  // ---------------- commit + rebuild ----------------
  function commit(fn, toastKey) {
    if (!App.project) return;
    Actions.mut((p) => { ensure(p); fn(p); }, { terr: true });
    App.ui.selection = [];
    App.ui.geomDraw = null;
    App.ui.geomEdit = null;
    if (toastKey) Actions.toast(t(toastKey));
    window.Geo.load(App.project);
  }

  // ---------------- operations ----------------
  // Carry the political identity (owner/status/disputes/etc.) across geometry
  // edits so mechanics survive split/merge — they live on the region, not the map.
  function politicalClone(e0) {
    if (!e0 || !e0.owner) return null;
    const r = { owner: e0.owner, status: e0.status || "core", color: e0.color || null,
      name: null, population: e0.population || "", culture: e0.culture || "",
      religion: e0.religion || "", language: e0.language || "", notes: "" };
    if (e0.claimants && e0.claimants.length) r.claimants = e0.claimants.slice();
    if (e0.occupiedFrom) r.occupiedFrom = e0.occupiedFrom;
    return r;
  }

  Actions.mergeRegionsGeometry = function (ids, name) {
    if (!ids || ids.length < 2) { Actions.toast(t("edit.needTwo")); return; }
    const mps = ids.map((id) => toMP(rawGeom(id)));
    const union = pcUnion(mps);
    if (!union || !union.length) { Actions.toast(t("edit.opFailed")); return; }
    const p = App.project;
    // ownership + status: keep if unanimous
    const recs = ids.map((id) => window.effRegion(p, id) || {});
    const owner = recs.every((r) => (r.owner || null) === (recs[0].owner || null)) ? (recs[0].owner || null) : null;
    const sameStatus = recs.every((r) => (r.status || "core") === (recs[0].status || "core"));
    const srcProps = rawProps(ids[0]);
    const newId = "e" + uid();
    const newName = name || ((p.regions[ids[0]] && p.regions[ids[0]].name) || srcProps.name || "Region");
    commit((pr) => {
      const ed = ensure(pr);
      ids.forEach((id) => {
        if (ed.features[id]) delete ed.features[id];
        ed.removed[id] = true;
        delete pr.regions[id];
      });
      ed.features[newId] = {
        geometry: fromMP(union), name: newName,
        props: { color: srcProps.color || null, terrain: srcProps.terrain || null, historicalArea: srcProps.historicalArea || null,
                 culturalArea: srcProps.culturalArea || null, admin: srcProps.admin || null }
      };
      const pol = politicalClone(recs[0]);
      if (pol) { if (!sameStatus) { pol.status = "core"; delete pol.claimants; delete pol.occupiedFrom; } pr.regions[newId] = pol; }
    }, "edit.mergedOk");
    return newId;
  };

  // split a region by a polyline drawn across it (screen pts -> lon/lat)
  Actions.splitRegionGeometry = function (id, screenPts) {
    if (!id || !screenPts || screenPts.length < 2) { Actions.toast(t("edit.tooFewPoints")); return; }
    const proj = App.basemap.proj;
    const line = screenPts.map((pt) => proj.invert(pt)).filter((c) => c && isFinite(c[0]));
    if (line.length < 2) { Actions.toast(t("edit.opFailed")); return; }
    const mp = toMP(rawGeom(id));
    if (!mp.length) { Actions.toast(t("edit.opFailed")); return; }
    // thin sliver along the cut line (≈0.02° wide), then difference
    const w = 0.012;
    const left = [], right = [];
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const len = Math.hypot(nx, ny) || 1;
      nx = nx / len * w; ny = ny / len * w;
      left.push([line[i][0] + nx, line[i][1] + ny]);
      right.push([line[i][0] - nx, line[i][1] - ny]);
    }
    const sliver = [[left.concat(right.reverse(), [left[0]])]];
    const cut = pcDiff(mp, sliver);
    if (!cut || cut.length < 2) { Actions.toast(t("edit.invalidSplit")); return; }
    // classify pieces by side of the line
    const sideOf = (pt) => {
      let best = 1e18, sign = 0;
      for (let i = 0; i + 1 < line.length; i++) {
        const ax = line[i][0], ay = line[i][1], bx = line[i + 1][0], by = line[i + 1][1];
        const dx = bx - ax, dy = by - ay;
        const t2 = Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / (dx * dx + dy * dy || 1e-12)));
        const px = ax + t2 * dx, py = ay + t2 * dy;
        const d = (pt[0] - px) ** 2 + (pt[1] - py) ** 2;
        if (d < best) { best = d; sign = Math.sign(dx * (pt[1] - ay) - dy * (pt[0] - ax)); }
      }
      return sign >= 0 ? 1 : -1;
    };
    const A = [], B = [];
    cut.forEach((poly) => {
      const ring = poly[0];
      let cx = 0, cy = 0;
      ring.forEach((q) => { cx += q[0]; cy += q[1]; });
      (sideOf([cx / ring.length, cy / ring.length]) > 0 ? A : B).push(poly);
    });
    if (!A.length || !B.length) { Actions.toast(t("edit.invalidSplit")); return; }
    const p = App.project;
    const e0 = window.effRegion(p, id);
    const owner = e0 ? e0.owner || null : null;
    const srcProps = rawProps(id);
    const baseName = (p.regions[id] && p.regions[id].name) || srcProps.name || "Region";
    commit((pr) => {
      const ed = ensure(pr);
      if (ed.features[id]) delete ed.features[id];
      ed.removed[id] = true;
      delete pr.regions[id];
      [[A, " I"], [B, " II"]].forEach(([part, suf]) => {
        const nid = "e" + uid();
        ed.features[nid] = {
          geometry: fromMP(part), name: baseName + suf,
          props: { color: srcProps.color || null, terrain: srcProps.terrain || null, historicalArea: srcProps.historicalArea || null,
                   culturalArea: srcProps.culturalArea || null, admin: srcProps.admin || null }
        };
        const pol = politicalClone(e0);
        if (pol) pr.regions[nid] = pol;
      });
    }, "edit.splitOk");
  };

  // draw a brand-new region; mode: "cut" (carve out of overlaps) | "draft" (overlay)
  Actions.drawNewRegion = function (screenPts, mode, name) {
    if (!screenPts || screenPts.length < 3) { Actions.toast(t("edit.tooFewPoints")); return; }
    const proj = App.basemap.proj;
    const ring = screenPts.map((pt) => proj.invert(pt)).filter((c) => c && isFinite(c[0]));
    if (ring.length < 3) { Actions.toast(t("edit.opFailed")); return; }
    ring.push(ring[0].slice());
    let newMP = [[ring]];
    const p = App.project;
    const newId = "e" + uid();
    commit((pr) => {
      const ed = ensure(pr);
      if (mode === "cut") {
        // subtract the new polygon from every overlapping region
        const bm = App.basemap;
        bm.features.forEach((f) => {
          const g = rawGeom(f.id);
          if (!g) return;
          const mp = toMP(g);
          const inter = pcIntersect(mp, newMP);
          if (!inter || !inter.length) return;
          const rest = pcDiff(mp, newMP);
          if (!rest || !rest.length || mpArea(rest) < 1e-4) {
            if (ed.features[f.id]) delete ed.features[f.id];
            ed.removed[f.id] = true;
            delete pr.regions[f.id];
          } else {
            const props0 = rawProps(f.id);
            ed.features[f.id] = {
              geometry: fromMP(rest), name: props0.name || f.id,
              props: { color: props0.color || null, terrain: props0.terrain || null, historicalArea: props0.historicalArea || null,
                       culturalArea: props0.culturalArea || null, admin: props0.admin || null }
            };
          }
        });
      }
      ed.features[newId] = { geometry: fromMP(newMP), name: name || t("edit.newRegionName"), props: {} };
    }, "edit.drawOk");
    return newId;
  };

  Actions.deleteRegionGeometry = function (id, mode) {
    const g = rawGeom(id);
    if (!g) return;
    commit((pr) => {
      const ed = ensure(pr);
      if (mode === "merge") {
        // merge area into the largest intersecting neighbour
        const mp = toMP(g);
        const grown = toMP(g); // pc handles touching fine; use intersection of buffered? keep touch-union
        let best = null, bestArea = -1;
        App.basemap.features.forEach((f) => {
          if (f.id === id) return;
          const ng = rawGeom(f.id);
          if (!ng) return;
          // quick bbox reject in screen space
          const a = App.basemap.byId[id], b2 = f;
          if (!a || a.b[1][0] < b2.b[0][0] - 2 || b2.b[1][0] < a.b[0][0] - 2 ||
              a.b[1][1] < b2.b[0][1] - 2 || b2.b[1][1] < a.b[0][1] - 2) return;
          if (f.area > bestArea) {
            // verify adjacency via union connectivity (cheap: bbox overlap accepted)
            bestArea = f.area; best = f;
          }
        });
        if (best) {
          const u = pcUnion([toMP(rawGeom(best.id)), mp]);
          if (u && u.length) {
            const propsN = rawProps(best.id);
            ed.features[best.id] = {
              geometry: fromMP(u), name: propsN.name || best.id,
              props: { color: propsN.color || null, terrain: propsN.terrain || null, historicalArea: propsN.historicalArea || null,
                       culturalArea: propsN.culturalArea || null, admin: propsN.admin || null }
            };
          }
        }
      }
      if (ed.features[id]) delete ed.features[id];
      ed.removed[id] = true;
      delete pr.regions[id];
    }, "edit.deleteOk");
  };

  // commit modified geometry from the vertex editor (screen rings -> lon/lat)
  Actions.modifyRegionGeometry = function (id, screenRings) {
    const proj = App.basemap.proj;
    const polyMap = {};
    let ok = true;
    screenRings.forEach((r) => {
      if (r.pts.length < 3) { ok = false; return; }
      const ring = r.pts.map((pt) => proj.invert(pt)).filter((c) => c && isFinite(c[0]));
      if (ring.length < 3) { ok = false; return; }
      ring.push(ring[0].slice());
      (polyMap[r.poly] = polyMap[r.poly] || {})[r.ring] = ring;
    });
    if (!ok) { Actions.toast(t("edit.invalidGeom")); return; }
    const mp = Object.keys(polyMap).sort((a, b) => a - b).map((pi) => {
      const rings = polyMap[pi];
      return Object.keys(rings).sort((a, b) => a - b).map((ri) => rings[ri]);
    });
    // validity check: polygon-clipping must accept it
    try { polygonClipping.union(mp, mp); } catch (e) { Actions.toast(t("edit.invalidGeom")); return; }
    const props0 = rawProps(id);
    commit((pr) => {
      const ed = ensure(pr);
      ed.features[id] = {
        geometry: fromMP(mp), name: props0.name || id,
        props: { color: props0.color || null, terrain: props0.terrain || null, historicalArea: props0.historicalArea || null,
                 culturalArea: props0.culturalArea || null, admin: props0.admin || null }
      };
    }, "edit.borderOk");
  };

  // ---------------- vertex edit session ----------------
  GeomEdit.startEdit = function (id) {
    const g = rawGeom(id);
    if (!g) { Actions.toast(t("edit.opFailed")); return; }
    const proj = App.basemap.proj;
    const rings = [];
    toMP(g).forEach((poly, pi) => {
      poly.forEach((ring, ri) => {
        const pts = [];
        ring.forEach((c, i) => {
          if (i === ring.length - 1 && c[0] === ring[0][0] && c[1] === ring[0][1]) return; // drop closing dup
          const p2 = proj(c);
          if (p2 && isFinite(p2[0])) pts.push([p2[0], p2[1]]);
        });
        if (pts.length >= 3) rings.push({ poly: pi, ring: ri, pts });
      });
    });
    if (!rings.length) { Actions.toast(t("edit.opFailed")); return; }
    App.ui.geomEdit = { id, rings, drag: null };
    App.ui.tool = "select";
    App.emit();
  };
  GeomEdit.cancelEdit = function () { App.ui.geomEdit = null; App.emit(); };
  GeomEdit.saveEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    Actions.modifyRegionGeometry(s.id, s.rings);
  };
  GeomEdit.smoothEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    s.rings.forEach((r) => { r.pts = chaikin(r.pts); });
    App.emit();
  };
  GeomEdit.simplifyEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    const k = (window.MapAPI && MapAPI.viewK && MapAPI.viewK()) || 1;
    s.rings.forEach((r) => {
      const closed = r.pts.concat([r.pts[0]]);
      const out = rdp(closed, 1.6 / k);
      out.pop();
      if (out.length >= 3) r.pts = out;
    });
    App.emit();
  };

  // ---------------- snapping ----------------
  let snapCache = null; // { key, pts: Float64Array pairs by source }
  function buildSnapSources() {
    const bm = App.basemap;
    const key = (bm.raw ? bm.raw.features.length : 0) + ":" + (App.project ? GeomEdit.editsKey(App.project) : "");
    if (snapCache && snapCache.key === key) return snapCache;
    const proj = bm.proj;
    const out = { key, borders: [], rivers: [], lakes: [], mountains: [] };
    const pushGeom = (arr, geom, step) => {
      const polys = geom.type === "Polygon" ? [geom.coordinates] :
                    geom.type === "MultiPolygon" ? geom.coordinates :
                    geom.type === "LineString" ? [[geom.coordinates]] :
                    geom.type === "MultiLineString" ? [geom.coordinates] : [];
      polys.forEach((poly) => poly.forEach((ring) => {
        for (let i = 0; i < ring.length; i += step) {
          const p2 = proj(ring[i]);
          if (p2 && isFinite(p2[0])) arr.push(p2[0], p2[1]);
        }
      }));
    };
    if (bm.raw) {
      const eff = App.project ? GeomEdit.applyToCollection(bm.raw, App.project.regionGeomEdits) : bm.raw;
      eff.features.forEach((f) => { if (f.geometry) pushGeom(out.borders, f.geometry, 1); });
    }
    const pr = bm.physicalRaw || {};
    ["rivers", "lakes", "mountains"].forEach((k) => {
      if (pr[k]) pr[k].features.forEach((f) => { if (f.geometry) pushGeom(out[k], f.geometry, 1); });
    });
    snapCache = out;
    return out;
  }
  GeomEdit.invalidateSnap = function () { snapCache = null; };

  GeomEdit.snap = function (pt, k) {
    const p = App.project;
    const cfg = (p && p.settings && p.settings.snap) || {};
    const radius = 8 / Math.max(0.2, k || 1);
    const src = buildSnapSources();
    let best = null, bd = radius * radius;
    const scan = (arr) => {
      for (let i = 0; i < arr.length; i += 2) {
        const dx = arr[i] - pt[0], dy = arr[i + 1] - pt[1];
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [arr[i], arr[i + 1]]; }
      }
    };
    if (cfg.borders !== false) scan(src.borders);
    if (cfg.rivers !== false) scan(src.rivers);
    if (cfg.lakes !== false) scan(src.lakes);
    if (cfg.mountains === true) scan(src.mountains);
    return best || pt;
  };

  // exact region hit test (screen coords) via Path2D
  let hitCtx = null;
  const path2dCache = {};
  GeomEdit.regionAt = function (x, y) {
    const bm = App.basemap;
    if (!hitCtx) hitCtx = document.createElement("canvas").getContext("2d");
    for (const f of bm.features) {
      if (x < f.b[0][0] || x > f.b[1][0] || y < f.b[0][1] || y > f.b[1][1]) continue;
      let p2 = path2dCache[f.id];
      if (!p2) { try { p2 = path2dCache[f.id] = new Path2D(f.d); } catch (e) { continue; } }
      if (hitCtx.isPointInPath(p2, x, y)) return f.id;
    }
    return null;
  };
  GeomEdit.invalidateHit = function () { for (const k in path2dCache) delete path2dCache[k]; };

  // ---------------- export ----------------
  function effectiveWithPolitics(simplify) {
    const p = App.project;
    const bm = App.basemap;
    const eff = GeomEdit.applyToCollection(bm.raw, p ? p.regionGeomEdits : null);
    const feats = eff.features.map((f) => {
      const id = String(f.id || (f.properties || {}).id || "");
      const r = p ? p.regions[id] : null;
      const e = p ? window.effRegion(p, id) : null;
      const st = e && e.owner && p.states[e.owner];
      let geom = f.geometry;
      if (simplify && geom) {
        const mp = toMP(geom).map((poly) => poly.map((ring) => {
          const out = rdp(ring, 0.02).map((c) => [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000]);
          return out.length >= 4 ? out : ring;
        }));
        geom = fromMP(mp);
      }
      return {
        type: "Feature", id,
        geometry: geom,
        properties: Object.assign({}, f.properties, {
          id,
          name: (r && r.name) || (f.properties || {}).name || id,
          ownerCountryId: e && e.owner ? e.owner : null,
          ownerName: st ? st.name : null,
          color: (r && r.color) || (st ? st.color : null) || null
        })
      };
    });
    return { type: "FeatureCollection", features: feats };
  }
  window.Exports.regionsGeoJSON = function (simplify) {
    if (!GeomEdit.enabled()) { Actions.toast(t("edit.notAvailable")); return; }
    const fc = effectiveWithPolitics(!!simplify);
    const blob = new Blob([JSON.stringify(fc)], { type: "application/geo+json" });
    window.downloadBlob(blob, (App.project.name || "map").replace(/\s+/g, "_") + (simplify ? "_regions_simplified.geojson" : "_regions.geojson"));
  };
})();
