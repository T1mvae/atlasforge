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
  // lon/lat bbox [x0, y0, x1, y1] of a MultiPolygon; cached per geometry object
  function mpBBox(mp) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    mp.forEach((poly) => poly.forEach((ring) => ring.forEach((c) => {
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
    })));
    return [x0, y0, x1, y1];
  }
  const geomBBoxCache = new WeakMap();
  function geomBBox(geom) {
    let b = geomBBoxCache.get(geom);
    if (!b) { b = mpBBox(toMP(geom)); geomBBoxCache.set(geom, b); }
    return b;
  }
  function bboxOverlap(a, b, pad) {
    pad = pad || 0;
    return !(a[2] < b[0] - pad || b[2] < a[0] - pad || a[3] < b[1] - pad || b[3] < a[1] - pad);
  }
  const rectMP = (b) => [[[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]]];
  // the dataset attributes we carry across geometry edits
  function carryProps(p0) {
    return { color: p0.color || null, terrain: p0.terrain || null, historicalArea: p0.historicalArea || null,
             culturalArea: p0.culturalArea || null, admin: p0.admin || null };
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
  // Chaikin for an open polyline: the endpoints stay put (they are snapped to
  // borders), only the interior corners get rounded.
  function chaikinOpen(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (i > 0) out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (i + 1 < pts.length - 1) out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  GeomEdit.rdp = rdp; GeomEdit.chaikin = chaikin; GeomEdit.chaikinOpen = chaikinOpen;
  // Smooth a hand-drawn split / outline (screen coords): drop jitter, then round
  // the corners twice. `closed` for the draw tool, open for the split line.
  GeomEdit.smoothLine = function (pts, k, closed) {
    if (!pts || pts.length < 3) return pts;
    const eps = 1.2 / Math.max(0.2, k || 1);
    let out;
    if (closed) { out = rdp(pts.concat([pts[0]]), eps); out.pop(); }
    else out = rdp(pts, eps);
    if (out.length < 3) return pts;
    for (let i = 0; i < 2; i++) out = closed ? chaikin(out) : chaikinOpen(out);
    return out;
  };

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
    if (e0.autonomyId) r.autonomyId = e0.autonomyId;
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
      if (pol) { if (!sameStatus) { pol.status = "core"; delete pol.claimants; delete pol.occupiedFrom; delete pol.autonomyId; } pr.regions[newId] = pol; }
    }, "edit.mergedOk");
    return newId;
  };

  // Half-plane polygon along a polyline: the line is extended far past both
  // ends and closed off on its left side. Both halves of the region are then
  // computed against this very polygon, so their shared boundary coincides
  // vertex for vertex — no sliver is subtracted, no gap is left behind.
  function halfPlaneAlong(line, bbox) {
    const diag = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]) || 1;
    const D = diag * 4;
    const ext = (a, b) => {
      const dx = a[0] - b[0], dy = a[1] - b[1];
      const len = Math.hypot(dx, dy) || 1;
      return [a[0] + dx / len * D, a[1] + dy / len * D];
    };
    const p0 = ext(line[0], line[1]);
    const pn = ext(line[line.length - 1], line[line.length - 2]);
    let nx = -(pn[1] - p0[1]), ny = pn[0] - p0[0];
    const nl = Math.hypot(nx, ny);
    if (!nl) return null;
    nx = nx / nl * D; ny = ny / nl * D;
    const ring = [p0].concat(line.slice(1, -1), [pn, [pn[0] + nx, pn[1] + ny], [p0[0] + nx, p0[1] + ny], p0]);
    try { return polygonClipping.union([[ring]]); } // normalizes self-intersections
    catch (e) { console.warn("half-plane failed", e); return null; }
  }

  // split a region by a polyline drawn across it (screen pts -> lon/lat)
  Actions.splitRegionGeometry = function (id, screenPts) {
    if (!id || !screenPts || screenPts.length < 2) { Actions.toast(t("edit.tooFewPoints")); return; }
    const proj = App.basemap.proj;
    const line = [];
    screenPts.forEach((pt) => {
      const c = proj.invert(pt);
      if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
      const last = line[line.length - 1];
      if (last && Math.abs(last[0] - c[0]) < 1e-9 && Math.abs(last[1] - c[1]) < 1e-9) return;
      line.push(c);
    });
    if (line.length < 2) { Actions.toast(t("edit.opFailed")); return; }
    const mp = toMP(rawGeom(id));
    if (!mp.length) { Actions.toast(t("edit.opFailed")); return; }
    const half = halfPlaneAlong(line, mpBBox(mp));
    if (!half || !half.length) { Actions.toast(t("edit.opFailed")); return; }
    const A = pcIntersect(mp, half), B = pcDiff(mp, half);
    if (!A || !B || !A.length || !B.length || mpArea(A) < 1e-10 || mpArea(B) < 1e-10) { Actions.toast(t("edit.invalidSplit")); return; }
    const p = App.project;
    const e0 = window.effRegion(p, id);
    const srcProps = rawProps(id);
    const baseName = (p.regions[id] && p.regions[id].name) || srcProps.name || "Region";
    commit((pr) => {
      const ed = ensure(pr);
      if (ed.features[id]) delete ed.features[id];
      ed.removed[id] = true;
      delete pr.regions[id];
      const newIds = [];
      [[A, " I"], [B, " II"]].forEach(([part, suf]) => {
        const nid = "e" + uid();
        newIds.push(nid);
        ed.features[nid] = { geometry: fromMP(part), name: baseName + suf, props: carryProps(srcProps) };
        const pol = politicalClone(e0);
        if (pol) pr.regions[nid] = pol;
      });
      healInto(ed, newIds); // absorb any numeric crumbs along the new seam
    }, "edit.splitOk");
  };

  // ---------------- gap healing ----------------
  // A "gap" is land the base dataset covered that no current feature covers
  // any more (old sliver cuts, moved vertices). Thin or tiny gap pieces that
  // share an edge with one of `ids` are merged back into it; compact holes
  // (deliberately deleted regions) are left alone. Pure w.r.t. App.project:
  // reads and writes only the `ed` passed in.
  function ringLength(ring) {
    let s = 0;
    for (let i = 1; i < ring.length; i++) s += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
    return s;
  }
  function isSliver(poly, regionArea) {
    const a = mpArea([poly]);
    if (a < regionArea * 1e-4) return true; // numeric crumb
    const per = ringLength(poly[0]);
    return per > 0 && a / (per * per) < 0.02; // long and thin (a compact hole is ~0.06-0.08)
  }
  function edGeom(ed, id) {
    if (ed.features[id]) return ed.features[id].geometry;
    const f = App.basemap.rawById && App.basemap.rawById[id];
    return f ? f.geometry : null;
  }
  function healInto(ed, ids) {
    const bm = App.basemap;
    const stats = { filled: 0, skipped: 0 };
    if (!bm.raw) return stats;
    const base = (bm.base || bm.raw).features; // pristine dataset, incl. replaced / removed originals
    ids.forEach((id) => {
      let g = toMP(edGeom(ed, id));
      if (!g.length) return;
      const bb = mpBBox(g);
      const pad = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) * 0.02 || 1e-6; // units are lon/lat or pixels
      const rect = rectMP([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]);
      const near = (feats) => feats.filter((f) => f.geometry && bboxOverlap(geomBBox(f.geometry), bb, pad)).map((f) => toMP(f.geometry));
      const covered0 = pcUnion(near(base));
      const coveredNow = pcUnion(near(GeomEdit.applyToCollection(bm.raw, ed).features));
      if (!covered0 || !coveredNow) return;
      const gaps = pcDiff(pcIntersect(covered0, rect) || [], pcIntersect(coveredNow, rect) || []);
      if (!gaps || !gaps.length) return;
      const gArea = mpArea(g);
      let changed = false;
      gaps.forEach((gap) => {
        if (!isSliver(gap, gArea)) { stats.skipped++; return; }
        const u = pcUnion([g, [gap]]);
        if (!u || u.length > g.length) return; // touches at a point only, or not at all
        g = u; changed = true; stats.filled++;
      });
      if (changed) {
        const props0 = rawProps(id);
        ed.features[id] = { geometry: fromMP(g), name: props0.name || id, props: carryProps(props0) };
      }
    });
    return stats;
  }
  Actions.healGaps = function (ids) {
    const p = App.project;
    if (!p || !GeomEdit.enabled()) return;
    const ed = ensure(p);
    const list = (ids && ids.length ? ids : Object.keys(ed.features)).filter((id) => edGeom(ed, id));
    if (!list.length) { Actions.toast(t("edit.healNone")); return; }
    // work on a copy so a no-op does not cost an undo entry and a map rebuild
    const work = { removed: ed.removed, features: Object.assign({}, ed.features) };
    const stats = healInto(work, list);
    if (!stats.filled) { Actions.toast(t(stats.skipped ? "edit.healSkipped" : "edit.healNone")); return; }
    commit((pr) => { ensure(pr).features = work.features; }, null);
    Actions.toast(t("edit.healOk").replace("{n}", stats.filled));
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

  // screen rings from the vertex editor -> lon/lat MultiPolygon (null if invalid)
  function ringsToMP(screenRings) {
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
    if (!ok) return null;
    const mp = Object.keys(polyMap).sort((a, b) => a - b).map((pi) => {
      const rings = polyMap[pi];
      return Object.keys(rings).sort((a, b) => a - b).map((ri) => rings[ri]);
    });
    // validity check: polygon-clipping must accept it
    try { polygonClipping.union(mp, mp); } catch (e) { return null; }
    return mp;
  }
  // commit modified geometry from the vertex editor: the edited region plus
  // every neighbour whose shared vertices moved with it, in one undo step
  Actions.modifyRegionGeometries = function (list) {
    const built = [];
    for (const item of list) {
      const mp = ringsToMP(item.rings);
      if (!mp) { Actions.toast(t("edit.invalidGeom")); return; }
      built.push({ id: item.id, mp });
    }
    commit((pr) => {
      const ed = ensure(pr);
      built.forEach(({ id, mp }) => {
        const props0 = rawProps(id);
        ed.features[id] = { geometry: fromMP(mp), name: props0.name || id, props: carryProps(props0) };
      });
    }, null);
    Actions.toast(built.length > 1 ? t("edit.borderOkShared").replace("{n}", built.length - 1) : t("edit.borderOk"));
  };
  Actions.modifyRegionGeometry = function (id, screenRings) { Actions.modifyRegionGeometries([{ id, rings: screenRings }]); };

  // ---------------- whole-map repair of edited regions ----------------
  // Topology-aware: shared borders are processed as ONE arc with its ends
  // pinned, so neighbours stay glued (no gaps, no overlaps). Only regions that
  // were edited (plus neighbours sharing a modified arc) are written back.
  Actions.repairEdited = function (mode) {
    const p = App.project;
    const bm = App.basemap;
    if (!p || !bm.raw || !topojson.topology) return;
    const ed = ensure(p);
    const editedIds = Object.keys(ed.features).filter((id) => ed.features[id] && ed.features[id].geometry);
    if (!editedIds.length) { Actions.toast(t("edit.repairNone")); return; }
    const eff = GeomEdit.applyToCollection(bm.raw, ed);
    let topo;
    try { topo = topojson.topology({ regions: eff }); } // unquantized: arcs keep absolute coords
    catch (e) { console.warn("repair topology failed", e); Actions.toast(t("edit.opFailed")); return; }
    const obj = topo.objects.regions;
    const editedSet = new Set(editedIds);
    const walk = (arcs, fn) => arcs.forEach((a) => (Array.isArray(a) ? walk(a, fn) : fn(a < 0 ? ~a : a)));
    const arcSet = new Set();
    obj.geometries.forEach((g) => { if (g.arcs && editedSet.has(String(g.id))) walk(g.arcs, (i) => arcSet.add(i)); });
    // tolerance relative to the size of the edited regions
    const diags = editedIds.map((id) => { const b = geomBBox(ed.features[id].geometry); return Math.hypot(b[2] - b[0], b[3] - b[1]); }).sort((a, b) => a - b);
    const eps = (diags[Math.floor(diags.length / 2)] || 1) * 0.003;
    let changedArcs = 0;
    arcSet.forEach((ai) => {
      const arc = topo.arcs[ai];
      if (!arc || arc.length < 3) return;
      const out = mode === "simplify" ? rdp(arc, eps) : chaikinOpen(arc);
      if (out.length !== arc.length) changedArcs++;
      topo.arcs[ai] = out;
    });
    if (!changedArcs) { Actions.toast(t("edit.repairNone")); return; }
    const touched = new Set();
    obj.geometries.forEach((g) => { if (g.arcs) walk(g.arcs, (i) => { if (arcSet.has(i)) touched.add(String(g.id)); }); });
    const fc = topojson.feature(topo, obj);
    const out = [];
    fc.features.forEach((f) => {
      if (!touched.has(String(f.id)) || !f.geometry) return;
      const mp = toMP(f.geometry).map((poly) => poly.filter((ring) => ring.length >= 4)).filter((poly) => poly.length && poly[0].length >= 4);
      if (!mp.length) return;
      out.push({ id: String(f.id), mp });
    });
    commit((pr) => {
      const e2 = ensure(pr);
      out.forEach(({ id, mp }) => {
        const props0 = rawProps(id);
        e2.features[id] = { geometry: fromMP(mp), name: props0.name || id, props: carryProps(props0) };
      });
    }, null);
    Actions.toast(t("edit.repairOk").replace("{n}", out.length));
  };

  // ---------------- vertex edit session ----------------
  // Points are plain [x, y] screen-coordinate arrays. A vertex shared with a
  // neighbouring region is the SAME array object in both rings, so dragging,
  // deleting or inserting it in the edited region keeps the neighbour's border
  // glued to it. Neighbours that end up changed are saved together.
  function coordKey(c) { return c[0].toFixed(9) + "," + c[1].toFixed(9); }
  function recomputeShared(sess) {
    const main = new Set();
    sess.rings.forEach((r) => r.pts.forEach((pt) => main.add(pt)));
    const sharedWith = new Map();
    sess.neighbors.forEach((n, ni) => n.rings.forEach((r) => r.pts.forEach((pt) => {
      if (!main.has(pt)) return;
      const arr = sharedWith.get(pt) || [];
      if (!arr.includes(ni)) arr.push(ni);
      sharedWith.set(pt, arr);
    })));
    sess.sharedWith = sharedWith;
  }
  GeomEdit.startEdit = function (id) {
    const g = rawGeom(id);
    if (!g) { Actions.toast(t("edit.opFailed")); return; }
    const proj = App.basemap.proj;
    const index = new Map(); // lon/lat key -> shared screen point of the edited region
    const ringsOf = (geom, register) => {
      const rings = [];
      toMP(geom).forEach((poly, pi) => poly.forEach((ring, ri) => {
        const pts = [];
        ring.forEach((c, i) => {
          if (i === ring.length - 1 && c[0] === ring[0][0] && c[1] === ring[0][1]) return; // drop closing dup
          const k = coordKey(c);
          let pt = index.get(k);
          if (!pt) {
            const p2 = proj(c);
            if (!p2 || !isFinite(p2[0])) return;
            pt = [p2[0], p2[1]];
            if (register) index.set(k, pt);
          }
          pts.push(pt);
        });
        if (pts.length >= 3) rings.push({ poly: pi, ring: ri, pts });
      }));
      return rings;
    };
    const rings = ringsOf(g, true);
    if (!rings.length) { Actions.toast(t("edit.opFailed")); return; }
    const mainPts = new Set(index.values());
    const bb = geomBBox(g);
    const neighbors = [];
    ((App.basemap.raw && App.basemap.raw.features) || []).forEach((f) => {
      const fid = String((f.id != null ? f.id : (f.properties || {}).id) || "");
      if (!fid || fid === id || !f.geometry || !bboxOverlap(geomBBox(f.geometry), bb, 0)) return;
      const nr = ringsOf(f.geometry, false);
      if (!nr.some((r) => r.pts.some((pt) => mainPts.has(pt)))) return;
      neighbors.push({ id: fid, rings: nr, orig: nr.map((r) => r.pts.map((pt) => pt.slice())) });
    });
    const sess = { id, rings, neighbors, sharedWith: new Map(), drag: null };
    recomputeShared(sess);
    App.ui.geomEdit = sess;
    App.ui.tool = "select";
    App.emit();
  };
  GeomEdit.cancelEdit = function () { App.ui.geomEdit = null; App.emit(); };
  GeomEdit.saveEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    const list = [{ id: s.id, rings: s.rings }];
    s.neighbors.forEach((n) => {
      const changed = n.rings.some((r, i) => r.pts.length !== n.orig[i].length ||
        r.pts.some((pt, j) => pt[0] !== n.orig[i][j][0] || pt[1] !== n.orig[i][j][1]));
      if (changed) list.push({ id: n.id, rings: n.rings });
    });
    Actions.modifyRegionGeometries(list);
  };
  GeomEdit.isShared = function (sess, pt) { return !!(sess.sharedWith && sess.sharedWith.has(pt)); };
  // Alt+click: drop a vertex from the edited ring and from every neighbour ring holding it
  GeomEdit.removeVertex = function (sess, ri, vi) {
    const r = sess.rings[ri];
    if (!r || r.pts.length <= 3) return false;
    const [pt] = r.pts.splice(vi, 1);
    sess.neighbors.forEach((n) => n.rings.forEach((nr) => {
      const i = nr.pts.indexOf(pt);
      if (i >= 0 && nr.pts.length > 3) nr.pts.splice(i, 1);
    }));
    sess.sharedWith.delete(pt);
    return true;
  };
  // midpoint square: insert a vertex on edge (vi, vi+1); neighbours holding that
  // edge get the very same point so the border stays shared
  GeomEdit.insertVertex = function (sess, ri, vi) {
    const r = sess.rings[ri];
    const a = r.pts[vi], b = r.pts[(vi + 1) % r.pts.length];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    r.pts.splice(vi + 1, 0, m);
    sess.neighbors.forEach((n, ni) => n.rings.forEach((nr) => {
      const n2 = nr.pts.length;
      for (let j = 0; j < n2; j++) {
        const p = nr.pts[j], q = nr.pts[(j + 1) % n2];
        if ((p === a && q === b) || (p === b && q === a)) {
          nr.pts.splice(j + 1, 0, m);
          const arr = sess.sharedWith.get(m) || [];
          arr.push(ni); sess.sharedWith.set(m, arr);
          return;
        }
      }
    }));
    return vi + 1;
  };
  // Split each edited ring into arcs at junction points (where the set of
  // neighbours sharing the vertex changes), apply `op` to every arc with its
  // endpoints pinned, and patch the same arc inside the neighbour rings.
  function applyArcOp(sess, op) {
    const nbKey = (pt) => (sess.sharedWith.get(pt) || []).join(",");
    const patchNeighbours = (oldArc, newArc) => {
      const A = oldArc[0], C = oldArc[oldArc.length - 1];
      const oldIn = oldArc.slice(1, -1), newIn = newArc.slice(1, -1);
      if (!oldIn.length) return;
      sess.neighbors.forEach((n) => n.rings.forEach((nr) => {
        const pts = nr.pts, n2 = pts.length;
        const iA = pts.indexOf(A);
        if (iA < 0 || pts.indexOf(C) < 0) return;
        const rot = pts.slice(iA).concat(pts.slice(0, iA));
        if (rot[1] === oldIn[0] && rot[oldIn.length + 1] === C) {
          rot.splice(1, oldIn.length, ...newIn);
        } else if (rot[n2 - 1] === oldIn[0] && rot[n2 - oldIn.length - 1] === C) {
          rot.splice(n2 - oldIn.length, oldIn.length, ...newIn.slice().reverse());
        } else return;
        nr.pts = rot;
      }));
    };
    sess.rings.forEach((r) => {
      const pts = r.pts, n = pts.length;
      if (n < 3) return;
      const junctions = [];
      for (let i = 0; i < n; i++) {
        const k = nbKey(pts[i]);
        if (k !== nbKey(pts[(i - 1 + n) % n]) || k !== nbKey(pts[(i + 1) % n])) junctions.push(i);
      }
      if (!junctions.length) {
        // one closed arc (island, or an enclave fully shared with one neighbour)
        const out = op(pts, true);
        if (out.length < 3) return;
        sess.neighbors.forEach((nb) => nb.rings.forEach((nr) => {
          if (nr.pts.length === n && nr.pts.every((pt) => pts.includes(pt))) nr.pts = out.slice();
        }));
        r.pts = out;
        return;
      }
      const rot = pts.slice(junctions[0]).concat(pts.slice(0, junctions[0]));
      const js = junctions.map((j) => (j - junctions[0] + n) % n);
      const result = [];
      for (let t2 = 0; t2 < js.length; t2++) {
        const s0 = js[t2], e0 = t2 + 1 < js.length ? js[t2 + 1] : n;
        const arc = rot.slice(s0, e0 + 1);
        if (e0 === n) arc[arc.length - 1] = rot[0];
        const out = arc.length >= 3 ? op(arc, false) : arc;
        if (out !== arc && out.length !== arc.length) patchNeighbours(arc, out);
        else if (out !== arc) patchNeighbours(arc, out);
        for (let i = 0; i < out.length - 1; i++) result.push(out[i]);
      }
      if (result.length >= 3) r.pts = result;
    });
    recomputeShared(sess);
  }
  GeomEdit.smoothEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    applyArcOp(s, (arc, closed) => (closed ? chaikin(arc) : chaikinOpen(arc)));
    App.emit();
  };
  GeomEdit.simplifyEdit = function () {
    const s = App.ui.geomEdit;
    if (!s) return;
    const k = (window.MapAPI && MapAPI.viewK && MapAPI.viewK()) || 1;
    const eps = 1.6 / k;
    applyArcOp(s, (arc, closed) => {
      if (!closed) return rdp(arc, eps);
      const out = rdp(arc.concat([arc[0]]), eps);
      out.pop();
      return out.length >= 3 ? out : arc;
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
    const out = { key, borders: [], borderRings: [], rivers: [], riverRings: [], lakes: [], lakeRings: [], mountains: [] };
    const pushGeom = (arr, geom, step, rings) => {
      const polys = geom.type === "Polygon" ? [geom.coordinates] :
                    geom.type === "MultiPolygon" ? geom.coordinates :
                    geom.type === "LineString" ? [[geom.coordinates]] :
                    geom.type === "MultiLineString" ? [geom.coordinates] : [];
      polys.forEach((poly) => poly.forEach((ring) => {
        const flat = rings ? [] : null;
        for (let i = 0; i < ring.length; i += step) {
          const p2 = proj(ring[i]);
          if (p2 && isFinite(p2[0])) { arr.push(p2[0], p2[1]); if (flat) flat.push(p2[0], p2[1]); }
        }
        if (flat && flat.length >= 4) rings.push(flat);
      }));
    };
    if (bm.raw) {
      const eff = App.project ? GeomEdit.applyToCollection(bm.raw, App.project.regionGeomEdits) : bm.raw;
      eff.features.forEach((f) => { if (f.geometry) pushGeom(out.borders, f.geometry, 1, out.borderRings); });
    }
    const pr = bm.physicalRaw || {};
    const ringsFor = { rivers: out.riverRings, lakes: out.lakeRings, mountains: null };
    ["rivers", "lakes", "mountains"].forEach((k) => {
      if (pr[k]) pr[k].features.forEach((f) => { if (f.geometry) pushGeom(out[k], f.geometry, 1, ringsFor[k]); });
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
    // no vertex close enough: nearest point on a border / river / lake segment
    const scanSegs = (rings) => {
      const x = pt[0], y = pt[1];
      for (const ring of rings) {
        for (let i = 2; i < ring.length; i += 2) {
          const ax = ring[i - 2], ay = ring[i - 1], bx = ring[i], by = ring[i + 1];
          if ((ax < x - radius && bx < x - radius) || (ax > x + radius && bx > x + radius) ||
              (ay < y - radius && by < y - radius) || (ay > y + radius && by > y + radius)) continue;
          const dx = bx - ax, dy = by - ay;
          const l2 = dx * dx + dy * dy || 1e-12;
          const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
          const px = ax + tt * dx, py = ay + tt * dy;
          const d = (px - x) * (px - x) + (py - y) * (py - y);
          if (d < bd) { bd = d; best = [px, py]; }
        }
      }
    };
    if (!best) {
      if (cfg.borders !== false) scanSegs(src.borderRings);
      if (cfg.rivers !== false) scanSegs(src.riverRings);
      if (cfg.lakes !== false) scanSegs(src.lakeRings);
    }
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
