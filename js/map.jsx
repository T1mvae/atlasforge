// AtlasForge — map view: rendering, zoom/pan, tools
const { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } = React;

function useStore() {
  return useSyncExternalStore(
    (cb) => App.subscribe(cb),
    () => App.version
  );
}

// ---------- fill resolution ----------
function regionFill(r, states, settings, feat) {
  const baseLand = (settings.provinceTint && feat) ? ColorUtil.provinceTint(settings.land, feat.id) : settings.land;
  if (!r) return baseLand;
  if (r.color) return r.color;
  const st = r.owner ? states[r.owner] : null;
  if (!st) return baseLand;
  const flagMode = settings.mapMode === "flag";
  const L = ColorUtil.lighten;
  switch (r.status) {
    case "vassal": return (flagMode && st.flag) ? `url(#flag-${r.owner})` : L(st.color, 0.32);
    case "colony": return (flagMode && st.flag) ? `url(#flag-${r.owner})` : L(st.color, 0.52);
    case "neutral": return ColorUtil.mixHex(st.color, settings.land, 0.6);
    case "disputed": return `url(#pat-${r.owner}-disputed)`;
    case "occupied": return `url(#pat-${r.owner}-occupied)`;
    default:
      if (st.flag && (flagMode || st.flagFill)) return `url(#flag-${r.owner})`;
      return st.color;
  }
}

const TERRAIN_COLORS = {
  plains: "#cdbf86", forest: "#5f8a52", hills: "#b09a64", mountain: "#9a8d7d",
  desert: "#e3cd8f", marsh: "#7f9a78", jungle: "#3f7a46", urban: "#b08f8a",
  tundra: "#cfd8d2", lakes: "#8fb6cf", ocean: "#9fc1d6"
};

// Province fill, chosen by the project display mode. Region display modes mute the
// province base so the region overlay reads clearly; provinces always stay the base.
function provinceFill(displayMode, r, states, settings, feat) {
  if (displayMode === "terrain") return TERRAIN_COLORS[feat && feat.terrain] || settings.land;
  if (displayMode === "province") return feat ? ColorUtil.provinceTint(settings.land, feat.id) : settings.land;
  if (RegionModel.modeType[displayMode]) {
    // a region display mode: keep a soft owner hint but dim it under the regions
    const owner = r && r.owner ? states[r.owner] : null;
    const base = ColorUtil.provinceTint(settings.land, feat ? feat.id : "x");
    return owner ? ColorUtil.mixHex(base, owner.color, 0.18) : base;
  }
  return regionFill(r, states, settings, feat); // "country" (default)
}

const Region = React.memo(function Region({ id, d, fill, stroke, sw, sel, clip, gap }) {
  return (
    <path
      className={sel ? "region sel" : "region"}
      data-id={id}
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      clipPath={clip}
      style={gap ? { vectorEffect: "none" } : undefined}
    ></path>
  );
});

// One mid-level region (state / custom). Drawn above provinces.
const RegionShape = React.memo(function RegionShape({ id, d, fill, fillOpacity, stroke, sw, sel, interactive }) {
  return (
    <path
      className={sel ? "mapregion sel" : "mapregion"}
      data-region-id={id}
      d={d}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={sw}
      pointerEvents={interactive ? "auto" : "none"}
    ></path>
  );
});

// ---------- state label computation ----------
// Atlas-style country labels that STAY INSIDE their territory:
//  1) collect owned regions per country;
//  2) anchor at a safe interior point (weighted centroid if it is exactly
//     inside an owned region — tested via Path2D — else the largest region's
//     centroid, else its bbox centre);
//  3) PCA main axis over owned-region centroids;
//  4) measure the usable span along/across the axis, symmetric around the anchor;
//  5) scale font from area, clamp, drop letter-spacing, shrink, finally hide;
//  6) apply per-state manual overrides (labelStyle / labelOffset).
function computeStateLabels(project, basemap) {
  const groups = {};
  for (const rid in project.regions) {
    const e = effRegion(project, rid);
    if (!e || !e.owner) continue;
    const f = basemap.byId[rid];
    if (!f) continue;
    const g = groups[e.owner] || (groups[e.owner] = { regions: [], total: 0, sw: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, best: null });
    const w = Math.sqrt(Math.max(1, f.area));
    g.regions.push(f);
    g.total += f.area;
    g.sw += w; g.sx += f.c[0] * w; g.sy += f.c[1] * w;
    g.sxx += f.c[0] * f.c[0] * w; g.syy += f.c[1] * f.c[1] * w; g.sxy += f.c[0] * f.c[1] * w;
    if (!g.best || f.area > g.best.area) g.best = f;
  }
  const ctx = computeStateLabels._ctx || (computeStateLabels._ctx = document.createElement("canvas").getContext("2d"));
  const insideOwned = (g, x, y) => {
    for (const f of g.regions) {
      if (x < f.b[0][0] || x > f.b[1][0] || y < f.b[0][1] || y > f.b[1][1]) continue;
      if (!f._p2d) { try { f._p2d = new Path2D(f.d); } catch (e) { continue; } }
      if (ctx.isPointInPath(f._p2d, x, y)) return true;
    }
    return false;
  };
  const out = [];
  for (const sid in groups) {
    const st = project.states[sid];
    const g = groups[sid];
    if (!st || !g.sw) continue;
    const ls = st.labelStyle || {};
    if (ls.hidden) continue;
    const mx = g.sx / g.sw, my = g.sy / g.sw;
    // safe interior anchor
    let ax = mx, ay = my;
    if (!insideOwned(g, ax, ay)) {
      ax = g.best.c[0]; ay = g.best.c[1];
      if (!insideOwned(g, ax, ay)) {
        ax = (g.best.b[0][0] + g.best.b[1][0]) / 2;
        ay = (g.best.b[0][1] + g.best.b[1][1]) / 2;
      }
    }
    // PCA main axis
    const cxx = g.sxx / g.sw - mx * mx, cyy = g.syy / g.sw - my * my, cxy = g.sxy / g.sw - mx * my;
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
    const disc = Math.max(0, tr * tr / 4 - det);
    const l1 = tr / 2 + Math.sqrt(disc), l2 = Math.max(0.01, tr / 2 - Math.sqrt(disc));
    let angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;
    const ratio = l1 / l2;
    if (ratio < 1.45 || Math.abs(angle) < 7) angle = 0;
    angle = Math.max(-25, Math.min(25, angle));
    // usable span along / across the axis, symmetric around the anchor so the
    // centered label cannot stick out of the far side
    const rad = angle * Math.PI / 180;
    const ux = Math.cos(rad), uy = Math.sin(rad);
    let minP = 0, maxP = 0, minQ = 0, maxQ = 0;
    g.regions.forEach((f) => {
      const px = f.c[0] - ax, py = f.c[1] - ay;
      const halfW = (f.b[1][0] - f.b[0][0]) / 2, halfH = (f.b[1][1] - f.b[0][1]) / 2;
      const halfOn = (Math.abs(halfW * ux) + Math.abs(halfH * uy)) * 0.8;
      const halfOff = (Math.abs(halfW * uy) + Math.abs(halfH * ux)) * 0.8;
      const pr = px * ux + py * uy;
      const pq = -px * uy + py * ux;
      if (pr - halfOn < minP) minP = pr - halfOn;
      if (pr + halfOn > maxP) maxP = pr + halfOn;
      if (pq - halfOff < minQ) minQ = pq - halfOff;
      if (pq + halfOff > maxQ) maxQ = pq + halfOff;
    });
    const axisSpan = Math.max(4, 2 * Math.min(-minP, maxP) || (maxP - minP));
    const minorSpan = Math.max(3, 2 * Math.min(-minQ, maxQ) || (maxQ - minQ));
    const len = Math.max(1, st.name.length);
    const glyphW = 0.62;
    let size = Math.min(26, Math.max(4, Math.sqrt(g.total) * 0.14)) * (project.settings.fontScale || 1);
    size = Math.min(size, Math.max(3.2, minorSpan * 0.7));
    let spacing = size * 0.12;
    const maxW = axisSpan * 0.92;
    if (len * size * glyphW + spacing * (len - 1) > maxW) spacing = 0;
    if (len * size * glyphW > maxW) size = Math.max(3.2, maxW / (len * glyphW));
    // unfittable even at minimum size -> hide (tiny countries)
    if (size <= 3.25 && len * size * glyphW > axisSpan * 1.5 && !ls.size) continue;
    // manual overrides
    if (ls.size) size = ls.size;
    if (ls.spacing != null) spacing = +ls.spacing;
    if (ls.angle != null) angle = +ls.angle;
    const off = st.labelOffset || [0, 0];
    out.push({ sid, name: st.name, x: ax + off[0], y: ay + off[1], size, angle, spacing,
               flag: st.flag, atlas: project.settings.labelAtlas !== false });
  }
  return out;
}

function MapView() {
  useStore();
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const marqueeRef = useRef(null);
  const minimapRef = useRef(null);
  const minimapVpRef = useRef(null);
  const hoverRef = useRef(null);
  const zoomTextRef = useRef(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const gesture = useRef(null);
  const dragLabel = useRef(null);

  const project = App.project;
  const bm = App.basemap;
  const ready = bm.status === "ready" && project;
  const settings = project ? project.settings : MAP_STYLES.standard;
  const states = project ? project.states : {};
  const regions = project ? project.regions : {};
  const effOf = useCallback((rid) => {
    const p = App.project;
    if (!p) return null;
    const r = p.regions[rid];
    if (r && r.group && p.groups && p.groups[r.group]) return p.groups[r.group];
    return r;
  }, []);
  const selSet = useMemo(() => new Set(App.ui.selection), [App.version]);
  const regSelSet = useMemo(() => new Set(App.ui.regionSelection), [App.version]);

  // ---------- mid-level region layer ----------
  const displayMode = project ? (project.displayMode || "country") : "country";
  const regionMode = App.ui.selectMode === "region";
  const regionDisplay = !!RegionModel.modeType[displayMode];
  const activeLayer = ready && RegionModel.supportsRegions() ? RegionModel.activeLayer() : null;
  const showRegionLayer = !!activeLayer && activeLayer.visible !== false &&
    (regionMode || regionDisplay || settings.showRegionBorders !== false);
  const layerRegions = useMemo(() => {
    if (!showRegionLayer) return [];
    return RegionModel.regionsOfLayer(activeLayer);
  }, [showRegionLayer, App.regionVersion, ready, activeLayer && activeLayer.id]);
  const activeProvToRegion = useMemo(() => {
    if (!ready || !activeLayer) return {};
    if (activeLayer.builtin && activeLayer.type === "state") return App.regionData.provinceToRegion || {};
    const m = {};
    (activeLayer.regionIds || []).forEach((rid) => {
      const r = RegionModel.resolve(rid);
      RegionModel.provinceFeatureIds(r).forEach((fid) => { m[fid] = rid; });
    });
    return m;
  }, [ready, App.regionVersion, activeLayer && activeLayer.id]);
  // refs so the (stable) pointer handlers can read the latest region data
  const provRegionRef = useRef({});
  const layerRegionsRef = useRef([]);
  provRegionRef.current = activeProvToRegion;
  layerRegionsRef.current = layerRegions;

  // ---------- view transform (non-reactive) ----------
  const applyView = useCallback(() => {
    const v = view.current;
    if (zoomRef.current) zoomRef.current.setAttribute("transform", `translate(${v.x},${v.y}) scale(${v.k})`);
    if (zoomTextRef.current) zoomTextRef.current.textContent = Math.round(v.k * 100) + "%";
    if (minimapVpRef.current) {
      const mw = 168, mh = 88, sx = mw / MAP_W, sy = mh / MAP_H;
      const w = (MAP_W / v.k) * sx, h = (MAP_H / v.k) * sy;
      const x = (-v.x / v.k) * sx, y = (-v.y / v.k) * sy;
      Object.assign(minimapVpRef.current.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    }
  }, []);

  const zoomEmitRaf = useRef(false);
  const setView = useCallback((x, y, k) => {
    k = Math.max(0.6, Math.min(90, k));
    view.current = { x, y, k };
    applyView();
    // geometry overlays (handles, dashed previews) size themselves by 1/k —
    // re-render them on zoom, throttled to animation frames
    if ((App.ui.geomEdit || App.ui.geomDraw) && !zoomEmitRaf.current) {
      zoomEmitRaf.current = true;
      requestAnimationFrame(() => { zoomEmitRaf.current = false; App.emit(); });
    }
  }, [applyView]);

  useEffect(() => {
    window.MapAPI = {
      fit: () => setView(0, 0, 1),
      zoomBy: (f) => {
        const v = view.current;
        const cx = MAP_W / 2, cy = MAP_H / 2;
        setView(cx - (cx - v.x) * f, cy - (cy - v.y) * f, v.k * f);
      },
      zoomTo: (b) => {
        const bw = Math.max(4, b[1][0] - b[0][0]), bh = Math.max(4, b[1][1] - b[0][1]);
        const k = Math.min(60, 0.55 * Math.min(MAP_W / bw, MAP_H / bh));
        const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
        setView(MAP_W / 2 - k * cx, MAP_H / 2 - k * cy, k);
      },
      viewK: () => view.current.k,
      finishGeomDraw
    };
    applyView();
  }, [setView, applyView, finishGeomDraw]);

  // ---------- coordinate helpers ----------
  const clientToViewbox = useCallback((e) => {
    const svg = svgRef.current;
    const m = svg.getScreenCTM().inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  }, []);
  const clientToMap = useCallback((e) => {
    const [vx, vy] = clientToViewbox(e);
    const v = view.current;
    return [(vx - v.x) / v.k, (vy - v.y) / v.k];
  }, [clientToViewbox]);

  // ---------- wheel zoom ----------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0016);
      const [px, py] = clientToViewbox(e);
      const v = view.current;
      const nk = Math.max(0.6, Math.min(90, v.k * f));
      const ff = nk / v.k;
      setView(px - (px - v.x) * ff, py - (py - v.y) * ff, nk);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [clientToViewbox, setView]);

  // ---------- painting ----------
  const paintRegion = useCallback((rid, erase) => {
    if (!rid) return;
    if (erase) {
      const e = effOf(rid);
      if (e && e.owner) Actions.assign([rid], null, { undo: false });
      return;
    }
    const sid = App.ui.activeState;
    if (!sid) { Actions.toast(t("hint.paintNoState")); return; }
    const e = effOf(rid);
    if (!e || e.owner !== sid) Actions.assign([rid], sid, { undo: false });
  }, [effOf]);

  const fillByOwner = useCallback((rid) => {
    const sid = App.ui.activeState;
    if (!sid) { Actions.toast(t("hint.paintNoState")); return; }
    const p = App.project;
    const e0 = effOf(rid);
    const srcOwner = e0 ? e0.owner : null;
    if (srcOwner === sid) return;
    const f0 = bm.byId[rid];
    const targets = [];
    bm.features.forEach((f) => {
      const e = effOf(f.id);
      const o = e ? e.owner : null;
      if (o !== srcOwner) return;
      // for unowned land on country-subdivided maps, restrict to the same country
      if (!srcOwner && f0 && f0.country && f.country !== f0.country) return;
      targets.push(f.id);
    });
    Actions.assign(targets, sid);
  }, [bm, effOf]);

  // ---------- pointer gestures ----------
  // finish an in-progress split/draw polyline (double-click, Enter or button)
  const finishGeomDraw = useCallback(() => {
    const gd = App.ui.geomDraw;
    if (!gd || !gd.pts.length) { App.ui.geomDraw = null; App.emit(); return; }
    if (gd.tool === "split") {
      if (gd.pts.length < 2) { Actions.toast(t("edit.tooFewPoints")); return; }
      const mid = gd.pts[Math.floor(gd.pts.length / 2)];
      const target = App.ui.selection[0] || (window.GeomEdit && GeomEdit.regionAt(mid[0], mid[1]));
      if (!target) { Actions.toast(t("edit.noTarget")); App.ui.geomDraw = null; App.emit(); return; }
      Actions.splitRegionGeometry(target, gd.pts);
    } else {
      if (gd.pts.length < 3) { Actions.toast(t("edit.tooFewPoints")); return; }
      const cut = confirm(t("edit.drawCutAsk"));
      const nm = prompt(t("edit.drawNameAsk"), "");
      if (nm === null) { App.ui.geomDraw = null; App.emit(); return; }
      Actions.drawNewRegion(gd.pts, cut ? "cut" : "draft", nm || null);
    }
    App.ui.geomDraw = null;
    App.emit();
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button === 2) return;
    const tool = App.ui.tool;
    const rid = e.target.dataset ? e.target.dataset.id : null;
    const regId = e.target.dataset ? e.target.dataset.regionId : null;
    const lbl = e.target.dataset ? e.target.dataset.label : null;
    const slbl = e.target.dataset ? e.target.dataset.slabel : null;
    const [vx, vy] = clientToViewbox(e);
    const mapPt = clientToMap(e);

    // ---- reference backdrop move / resize ----
    if (e.target.dataset && (e.target.dataset.backdrop || e.target.dataset.bdresize)) {
      const bd = App.project.backdrop;
      Actions.beginStroke();
      gesture.current = { mode: e.target.dataset.bdresize ? "bdresize" : "bdmove",
        start: mapPt, orig: { x: bd.x, y: bd.y, w: bd.w, h: bd.h } };
      e.stopPropagation();
      return;
    }

    // ---- geometry editing: vertex handles ----
    const sess = App.ui.geomEdit;
    if (sess) {
      const vh = e.target.dataset ? e.target.dataset.vertex : null;
      const mh = e.target.dataset ? e.target.dataset.midpoint : null;
      if (vh) {
        const [ri, vi] = vh.split(":").map(Number);
        if (e.altKey) { // delete vertex
          if (sess.rings[ri].pts.length > 3) { sess.rings[ri].pts.splice(vi, 1); App.emit(); }
          else Actions.toast(t("edit.minPoints"));
        } else {
          gesture.current = { mode: "vertex", ri, vi };
        }
        e.stopPropagation();
        return;
      }
      if (mh) { // insert a vertex at the segment midpoint and start dragging it
        const [ri, vi] = mh.split(":").map(Number);
        const r = sess.rings[ri];
        const a = r.pts[vi], b2 = r.pts[(vi + 1) % r.pts.length];
        r.pts.splice(vi + 1, 0, [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]);
        gesture.current = { mode: "vertex", ri, vi: vi + 1 };
        App.emit();
        e.stopPropagation();
        return;
      }
    }

    // ---- geometry tools: collect polyline points ----
    if ((tool === "split" || tool === "draw") && e.button === 0) {
      const k = view.current.k;
      const pt = window.GeomEdit ? GeomEdit.snap(mapPt, k) : mapPt;
      let gd = App.ui.geomDraw;
      if (!gd || gd.tool !== tool) gd = App.ui.geomDraw = { tool, pts: [] };
      const last = gd.pts[gd.pts.length - 1];
      if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 1.5 / k) gd.pts.push(pt);
      if (e.detail >= 2 && gd.pts.length >= (tool === "split" ? 2 : 3)) { finishGeomDraw(); return; }
      App.emit();
      return;
    }

    if (tool === "select" && (lbl || slbl)) {
      dragLabel.current = { kind: lbl ? "custom" : "state", id: lbl || slbl, start: mapPt, moved: false, orig: null };
      if (slbl) {
        const st = App.project.states[slbl];
        dragLabel.current.orig = (st.labelOffset || [0, 0]).slice();
      } else {
        const l = App.project.labels.find((x) => x.id === lbl);
        dragLabel.current.orig = [l.x, l.y];
      }
      gesture.current = { mode: "label" };
      Actions.beginStroke();
      e.stopPropagation();
      return;
    }

    if (tool === "paint" || tool === "erase") {
      Actions.beginStroke();
      paintRegion(rid, tool === "erase");
      gesture.current = { mode: "paint", erase: tool === "erase" };
      return;
    }
    if (tool === "select" && e.shiftKey && !rid && !regId) {
      gesture.current = { mode: "marquee", x0: vx, y0: vy };
      return;
    }
    gesture.current = {
      mode: "down", vx, vy, rid, regId, shift: e.shiftKey, tool,
      panOk: tool === "pan" || tool === "select" || tool === "fill" || tool === "label" || e.button === 1
    };
  }, [clientToViewbox, clientToMap, paintRegion]);

  const onPointerMove = useCallback((e) => {
    const g = gesture.current;
    // hover readout
    if (hoverRef.current) {
      const rid = e.target.dataset ? e.target.dataset.id : null;
      const hovRegId = e.target.dataset ? e.target.dataset.regionId : null;
      let txt = "";
      if (hovRegId) {
        const r = RegionModel.resolve(hovRegId);
        if (r) {
          const n = RegionModel.provinceCount(r);
          txt = RegionModel.displayName(r) + " · " + t("rtype." + r.type) + " · " + n + " " + t("region.provincesShort");
        }
      } else if (rid && App.basemap.byId[rid]) {
        const f = App.basemap.byId[rid];
        const er = App.project ? effRegion(App.project, rid) : null;
        const owner = er && er.owner && App.project.states[er.owner];
        const baseName = (App.ui.lang === "ru" && f.nameRu) ? f.nameRu : f.name;
        txt = (er && er.name ? er.name : baseName) + (owner ? " — " + owner.name : "") + (f.terrain ? " · " + f.terrain : "") + (f.histArea ? " · " + f.histArea : "");
      }
      hoverRef.current.textContent = txt;
    }
    if (!g) return;
    if (g.mode === "bdmove" || g.mode === "bdresize") {
      const [mx, my] = clientToMap(e);
      const dx = mx - g.start[0], dy = my - g.start[1];
      if (g.mode === "bdmove") {
        Actions.setBackdrop({ x: g.orig.x + dx, y: g.orig.y + dy });
      } else {
        const ar = g.orig.w / g.orig.h || 1;
        let w = Math.max(20, g.orig.w + dx);
        Actions.setBackdrop({ w, h: w / ar });
      }
      return;
    }
    if (g.mode === "vertex") {
      const sess = App.ui.geomEdit;
      if (sess && sess.rings[g.ri]) {
        const [mx, my] = clientToMap(e);
        const pt = window.GeomEdit ? GeomEdit.snap([mx, my], view.current.k) : [mx, my];
        sess.rings[g.ri].pts[g.vi] = pt;
        if (!g.raf) {
          g.raf = true;
          requestAnimationFrame(() => { g.raf = false; App.emit(); });
        }
      }
      return;
    }
    if (g.mode === "label" && dragLabel.current) {
      const [mx, my] = clientToMap(e);
      const dl = dragLabel.current;
      dl.moved = true;
      const dx = mx - dl.start[0], dy = my - dl.start[1];
      if (dl.kind === "custom") {
        Actions.setLabel(dl.id, { x: dl.orig[0] + dx, y: dl.orig[1] + dy }, { undo: false });
      } else {
        Actions.setState(dl.id, { labelOffset: [dl.orig[0] + dx, dl.orig[1] + dy] }, { undo: false });
      }
      return;
    }
    if (g.mode === "paint") {
      const rid = e.target.dataset ? e.target.dataset.id : null;
      if (rid && rid !== g.last) { g.last = rid; paintRegion(rid, g.erase); }
      return;
    }
    if (g.mode === "marquee") {
      const [vx, vy] = clientToViewbox(e);
      const r = marqueeRef.current;
      if (r) {
        const v = view.current;
        const x = Math.min(g.x0, vx), y = Math.min(g.y0, vy);
        r.setAttribute("x", (x - v.x) / v.k); r.setAttribute("y", (y - v.y) / v.k);
        r.setAttribute("width", Math.abs(vx - g.x0) / v.k); r.setAttribute("height", Math.abs(vy - g.y0) / v.k);
        r.style.display = "block";
        g.x1 = vx; g.y1 = vy;
      }
      return;
    }
    if (g.mode === "down" || g.mode === "panning") {
      const [vx, vy] = clientToViewbox(e);
      const dist = Math.hypot(vx - g.vx, vy - g.vy);
      if (g.mode === "down" && dist > 4 && g.panOk) {
        g.mode = "panning";
        g.lx = vx; g.ly = vy;
        svgRef.current.closest(".map-stage").classList.add("panning");
      }
      if (g.mode === "panning") {
        const v = view.current;
        setView(v.x + (vx - (g.lx ?? g.vx)), v.y + (vy - (g.ly ?? g.vy)), v.k);
        g.lx = vx; g.ly = vy;
      }
    }
  }, [clientToViewbox, clientToMap, paintRegion, setView]);

  const onPointerUp = useCallback((e) => {
    const g = gesture.current;
    gesture.current = null;
    svgRef.current && svgRef.current.closest(".map-stage").classList.remove("panning");
    if (!g) return;
    if (g.mode === "bdmove" || g.mode === "bdresize") { Actions.endStroke(); return; }
    if (g.mode === "vertex") { App.emit(); return; }
    if (g.mode === "label") {
      const dl = dragLabel.current;
      dragLabel.current = null;
      Actions.endStroke();
      if (dl && !dl.moved && dl.kind === "custom") {
        Actions.ui({ selLabel: dl.id, panel: "region", selection: [] });
      }
      return;
    }
    if (g.mode === "paint") { Actions.endStroke(); return; }
    if (g.mode === "marquee") {
      const r = marqueeRef.current;
      if (r) r.style.display = "none";
      if (g.x1 === undefined) return;
      const v = view.current;
      const x0 = (Math.min(g.x0, g.x1) - v.x) / v.k, x1 = (Math.max(g.x0, g.x1) - v.x) / v.k;
      const y0 = (Math.min(g.y0, g.y1) - v.y) / v.k, y1 = (Math.max(g.y0, g.y1) - v.y) / v.k;
      if (App.ui.selectMode === "region") {
        const hit = layerRegionsRef.current
          .filter((r) => r.c && r.c[0] >= x0 && r.c[0] <= x1 && r.c[1] >= y0 && r.c[1] <= y1)
          .map((r) => r.id);
        Actions.selectRegions(hit, true);
      } else {
        const hit = App.basemap.features.filter((f) => f.c[0] >= x0 && f.c[0] <= x1 && f.c[1] >= y0 && f.c[1] <= y1).map((f) => f.id);
        Actions.select(hit, true);
      }
      return;
    }
    if (g.mode === "down") {
      const tool = g.tool;
      if (tool === "label") {
        const [mx, my] = clientToMap(e);
        const id = Actions.addLabel(mx, my);
        Actions.ui({ selLabel: id, panel: "region", selection: [], tool: "select" });
        return;
      }
      if (tool === "fill" && g.rid) { fillByOwner(g.rid); return; }
      if (tool === "select" || tool === "pan") {
        if (App.ui.selectMode === "region") {
          const regId = g.regId || provRegionRef.current[g.rid];
          if (regId) {
            Actions.ui({ selLabel: null });
            Actions.selectRegions([regId], g.shift);
          } else if (!g.shift) {
            Actions.clearRegionSelection();
          }
        } else if (g.rid) {
          Actions.ui({ selLabel: null });
          Actions.select([g.rid], g.shift);
        } else if (!g.shift) {
          Actions.ui({ selLabel: null });
          Actions.select([], false);
        }
      }
    }
  }, [clientToMap, fillByOwner]);

  // ---------- borders (topo meshes) ----------
  const meshes = useMemo(() => {
    if (!ready || !bm.topo) return null;
    const p = App.project;
    const cof = bm.clusterOf;
    const fidOf = (gid) => (cof ? cof[gid] || gid : gid);
    const ownerOf = (gid) => {
      const e = effRegion(p, fidOf(gid));
      return e ? e.owner || "" : "";
    };
    const unitOf = (gid) => {
      const fid = fidOf(gid);
      const r = p.regions[fid];
      return r && r.group ? "g:" + r.group : fid;
    };
    if (bm.raw) {
      // region-grid datasets: borders that did not snap perfectly are NOT shared
      // arcs, so mesh(a!==b) misses them and mesh(a===b) renders them as dark
      // dash fragments. Use only the owner mesh here; region borders & coast are
      // drawn from per-region outlines / landPath instead (continuous everywhere).
      return { state: Geo.stateMesh(ownerOf), coast: null, inner: null };
    }
    return { coast: Geo.coastMesh(), inner: Geo.innerMesh(unitOf), state: Geo.stateMesh(ownerOf) };
  }, [ready, bm.topo, App.terrVersion]);

  // one concatenated outline of ALL regions: a single path strokes every border
  // exactly once (no double-darkening, no missing unsnapped segments)
  const outlinePath = useMemo(() => {
    if (!ready || !bm.topo || !bm.raw) return null;
    return bm.features.map((f) => f.d).join("");
  }, [ready, bm.count]);

  // ---------- status patterns ----------
  const patterns = useMemo(() => {
    if (!project) return [];
    const need = new Set();
    for (const rid in regions) {
      const e = effOf(rid);
      if (e && e.owner && (e.status === "disputed" || e.status === "occupied")) need.add(e.owner + "|" + e.status);
    }
    return [...need].map((key) => {
      const [sid, status] = key.split("|");
      const st = states[sid];
      if (!st) return null;
      return { sid, status, color: st.color };
    }).filter(Boolean);
  }, [App.version]);

  const stateLabels = useMemo(() => (ready ? computeStateLabels(project, bm) : []), [App.version, ready]);

  const flagPatterns = useMemo(() => {
    if (!project || !ready) return [];
    const flagMode = settings.mapMode === "flag";
    const op = settings.flagOpacity == null ? 1 : settings.flagOpacity;
    const out = [];
    project.stateOrder.forEach((sid) => {
      const s = states[sid];
      if (!s || !s.flag || !(flagMode || s.flagFill)) return;
      let b = null;
      for (const rid in regions) {
        const e = effOf(rid);
        if (!e || e.owner !== sid) continue;
        const f = bm.byId[rid];
        if (!f) continue;
        b = b
          ? [[Math.min(b[0][0], f.b[0][0]), Math.min(b[0][1], f.b[0][1])], [Math.max(b[1][0], f.b[1][0]), Math.max(b[1][1], f.b[1][1])]]
          : [f.b[0].slice(), f.b[1].slice()];
      }
      if (!b) return;
      out.push({ id: sid, flag: s.flag, color: s.color, op, x: b[0][0], y: b[0][1], w: Math.max(4, b[1][0] - b[0][0]), h: Math.max(4, b[1][1] - b[0][1]) });
    });
    return out;
  }, [App.version, ready, settings.mapMode, settings.flagOpacity]);

  // anchors for merged-region (group) name labels
  const groupLabels = useMemo(() => {
    if (!ready || !project.groups) return {};
    const out = {};
    for (const gid in project.groups) {
      const g = project.groups[gid];
      let best = null, total = 0;
      (g.members || []).forEach((rid) => {
        const f = bm.byId[rid];
        if (!f) return;
        total += f.area;
        if (!best || f.area > best.area) best = f;
      });
      if (best) out[best.id] = { name: g.name, total };
    }
    return out;
  }, [App.version, ready]);

  // ---------- minimap ----------
  useEffect(() => {
    if (!ready || !minimapRef.current) return;
    const cv = minimapRef.current;
    const ctx = cv.getContext("2d");
    cv.width = 336; cv.height = 176;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = settings.sea;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(cv.width / MAP_W, cv.height / MAP_H);
    ctx.fillStyle = ColorUtil.mixHex(settings.land, "#888888", 0.25);
    bm.features.forEach((f) => { try { ctx.fill(new Path2D(f.d)); } catch (e) {} });
    ctx.restore();
    applyView();
  }, [ready, bm.count, settings.sea, settings.land, applyView]);

  const onMinimapClick = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * MAP_W;
    const my = ((e.clientY - r.top) / r.height) * MAP_H;
    const v = view.current;
    setView(MAP_W / 2 - v.k * mx, MAP_H / 2 - v.k * my, v.k);
  }, [setView]);

  // ---------- render ----------
  const strokeOnRegions = !meshes;
  const innerOn = settings.innerBorders !== false;
  const bw = settings.borderW;
  // region borders and country borders are SEPARATE layers with separate toggles:
  // showRegionBorders -> faint internal region mesh (legacy fallback: innerBorders);
  // showCountryBorders + countryBorderW -> owner-boundary mesh only.
  const regionBordersOn = settings.showRegionBorders !== undefined ? settings.showRegionBorders !== false : innerOn;
  const countryBordersOn = settings.showCountryBorders !== false;
  const cbw = settings.countryBorderW != null ? +settings.countryBorderW : bw * 1.8;
  const provinceBordersOn = strokeOnRegions && settings.showProvinceBorders !== false;
  const regionInteractive = regionMode && App.ui.tool === "select";
  const regionFillOn = regionMode || regionDisplay; // fill regions vs borders-only
  const regBorderColor = ColorUtil.darken(settings.borders, 0.2);

  // ---------- physical geography (atlas layers) ----------
  const phys = App.physical;
  const physReady = ready && phys && phys.status === "ready";
  const waterColor = useMemo(
    () => ColorUtil.mixHex(ColorUtil.darken(settings.sea, 0.10), "#2e6da3", 0.35),
    [settings.sea]);
  const RIVER_W = { major: 1.3, medium: 0.85, minor: 0.55 };

  return (
    <div className={"map-stage tool-" + App.ui.tool} data-screen-label="Map canvas" style={{ background: settings.sea }}>
      {bm.status === "loading" && (
        <div className="map-loading">
          <div style={{ textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto" }}></div>
            <div className="map-loading-text">{t("loading.map")}</div>
          </div>
        </div>
      )}
      {bm.status === "error" && (
        <div className="map-loading">
          <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div className="map-loading-text">{t("loading.error")}</div>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => Geo.load(App.project)}>{t("retry")}</button>
          </div>
        </div>
      )}
      <svg
        id="map-svg"
        ref={svgRef}
        className="mapsvg"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <filter id="lblShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0.7" stdDeviation="0.9" floodColor="#000000" floodOpacity="0.55"></feDropShadow>
          </filter>
          {patterns.map((p) => (
            <pattern key={p.sid + p.status} id={`pat-${p.sid}-${p.status}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill={p.status === "occupied" ? ColorUtil.darken(p.color, 0.25) : ColorUtil.lighten(p.color, 0.45)}></rect>
              <rect width="3.5" height="7" fill={p.color}></rect>
            </pattern>
          ))}
          {flagPatterns.map((s) => (
            <pattern key={"fp" + s.id} id={`flag-${s.id}`} patternUnits="userSpaceOnUse" x={s.x} y={s.y} width={s.w} height={s.h}>
              <rect width={s.w} height={s.h} fill={s.color}></rect>
              <image href={s.flag} width={s.w} height={s.h} preserveAspectRatio="xMidYMid slice" opacity={s.op}></image>
            </pattern>
          ))}
          {ready && bm.clipLand && bm.landPath && (
            <clipPath id="land-clip"><path d={bm.landPath}></path></clipPath>
          )}
          {ready && bm.clips && bm.clips.map((sc) => (
            <clipPath key={sc.id} id={sc.id}><path d={sc.d}></path></clipPath>
          ))}
        </defs>
        <rect width={MAP_W} height={MAP_H} fill={settings.sea}></rect>
        <g id="zoom-root" ref={zoomRef}>
          {ready && bm.graticule && <path d={bm.graticule} fill="none" stroke={settings.borders} strokeOpacity="0.14" strokeWidth="0.5" vectorEffect="non-scaling-stroke"></path>}
          {ready && bm.sphere && <path d={bm.sphere} fill="none" stroke={settings.borders} strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke"></path>}
          {ready && bm.landPath && <path d={bm.landPath} fill={settings.land} stroke={settings.land} strokeWidth="1.1" vectorEffect="non-scaling-stroke" pointerEvents="none"></path>}
          <g id="regions" clipPath={ready && bm.clipLand && bm.landPath ? "url(#land-clip)" : undefined}
             pointerEvents={regionInteractive ? "none" : "auto"}>
            {ready && bm.features.map((f) => {
              const fillV = provinceFill(displayMode, effOf(f.id), states, settings, f);
              // with topo meshes the borders are drawn separately; stroke each
              // fill with ITS OWN colour (screen-constant ~1px) so anti-aliasing
              // seams and hairline gaps between neighbours never show the sea
              const gapFill = !strokeOnRegions && typeof fillV === "string" && fillV[0] === "#";
              return (
                <Region
                  key={f.id}
                  id={f.id}
                  d={f.d}
                  fill={fillV}
                  stroke={gapFill ? fillV : (provinceBordersOn ? settings.borders : "none")}
                  sw={gapFill ? 1.1 : (strokeOnRegions ? bw * 0.7 : 0)}
                  sel={!regionMode && selSet.has(f.id)}
                  clip={f.clipId ? "url(#" + f.clipId + ")" : undefined}
                ></Region>
              );
            })}
          </g>
          {/* ---- reference image backdrop for tracing (above fills, below borders) ---- */}
          {ready && project && project.backdrop && project.backdrop.visible !== false && project.backdropHref && (() => {
            const bd = project.backdrop;
            const moving = App.ui.moveBackdrop;
            const k = view.current.k;
            return (
              <g data-export-skip="1">
                <image data-backdrop={moving ? "1" : undefined}
                  pointerEvents={moving ? "auto" : "none"}
                  href={project.backdropHref} x={bd.x} y={bd.y} width={bd.w} height={bd.h}
                  opacity={bd.opacity == null ? 0.55 : bd.opacity}
                  preserveAspectRatio="none"
                  style={moving ? { cursor: "move" } : undefined}></image>
                {moving && (
                  <React.Fragment>
                    <rect x={bd.x} y={bd.y} width={bd.w} height={bd.h} fill="none" stroke="#ff9f2e" strokeWidth={1.2 / k} strokeDasharray={`${5 / k} ${4 / k}`} pointerEvents="none"></rect>
                    <rect data-bdresize="1" x={bd.x + bd.w - 6 / k} y={bd.y + bd.h - 6 / k} width={12 / k} height={12 / k} fill="#ff9f2e" stroke="#fff" strokeWidth={1 / k} style={{ cursor: "nwse-resize" }}></rect>
                  </React.Fragment>
                )}
              </g>
            );
          })()}
          {ready && bm.staticBorders && (
            <g className="borders" pointerEvents="none">
              {settings.innerBorders !== false && bm.staticBorders.prov && <path d={bm.staticBorders.prov} fill="none" stroke={settings.borders} strokeOpacity="0.5" strokeWidth={bw * 0.6}></path>}
              {bm.staticBorders.stateMesh && settings.innerBorders !== false && <path d={bm.staticBorders.stateMesh} fill="none" stroke={settings.borders} strokeOpacity="0.75" strokeWidth={bw * 1.1}></path>}
              {bm.staticBorders.coast && <path d={bm.staticBorders.coast} fill="none" stroke={settings.borders} strokeOpacity="0.9" strokeWidth={bw * 0.85}></path>}
            </g>
          )}
          {meshes && (
            <g className="borders" pointerEvents="none">
              {/* 1) faint internal region borders — own toggle only.
                     region-grid maps stroke ONE concatenated outline of all
                     regions: continuous everywhere, no dash fragments where
                     neighbours' arcs did not snap exactly */}
              {regionBordersOn && (outlinePath || meshes.inner) && (
                <path className="border-regions" d={outlinePath || meshes.inner} fill="none"
                  stroke={settings.borders} strokeOpacity={outlinePath ? 0.4 : 0.45} strokeWidth={bw * 0.55}></path>
              )}
              {/* 2) coastline — own toggle; for region-grid maps a FILTERED
                     landmass outline (sliver holes removed), not the arc mesh */}
              {settings.showCoastlines !== false && (bm.raw ? bm.coastPath : meshes.coast) && (
                <path className="border-coast" d={bm.raw ? bm.coastPath : meshes.coast} fill="none"
                  stroke={settings.borders} strokeOpacity="0.85" strokeWidth={bw * 0.75}></path>
              )}
              {/* 3) country borders (different owners only) — own toggle + own thickness */}
              {countryBordersOn && meshes.state && <path className="border-countries" d={meshes.state} fill="none" stroke={ColorUtil.darken(settings.borders, 0.4)} strokeWidth={cbw} strokeLinejoin="round"></path>}
            </g>
          )}
          {/* ---- physical relief (under region overlay): ranges + deserts ---- */}
          {physReady && settings.showMountains !== false && phys.relief.length > 0 && (
            <g id="phys-relief" pointerEvents="none">
              {phys.relief.map((f) => (
                <path key={"rel" + f.id} d={f.d}
                  fill={f.typ === "desert" ? "#c9a96a" : "#5d4f40"}
                  fillOpacity={f.typ === "desert" ? 0.10 : 0.13}
                  stroke={f.typ === "desert" ? "none" : "#5d4f40"}
                  strokeOpacity="0.18" strokeWidth="0.5" vectorEffect="non-scaling-stroke"></path>
              ))}
            </g>
          )}
          {/* ---- physical display layers (rivers / lakes / mountains) ---- */}
          {ready && bm.physical && (
            <g id="physical" pointerEvents="none">
              {settings.showMountains !== false && bm.physical.mountains && (
                <path d={bm.physical.mountains} fill="#8a7a5a" fillOpacity="0.16" stroke="#7a6a4a" strokeOpacity="0.25" strokeWidth="0.4" vectorEffect="non-scaling-stroke"></path>
              )}
              {settings.showLakes !== false && bm.physical.lakes && (
                <path d={bm.physical.lakes} fill={settings.sea} stroke={ColorUtil.darken(settings.sea, 0.18)} strokeWidth="0.5" vectorEffect="non-scaling-stroke"></path>
              )}
              {settings.showRivers !== false && bm.physical.rivers && (
                <path d={bm.physical.rivers} fill="none" stroke={ColorUtil.darken(settings.sea, 0.22)} strokeWidth="0.8" strokeOpacity="0.85" vectorEffect="non-scaling-stroke"></path>
              )}
            </g>
          )}
          {/* ---- mid-level region layer (above provinces) ---- */}
          {ready && showRegionLayer && (
            <g id="map-regions">
              {layerRegions.map((r) => (
                <RegionShape
                  key={r.id}
                  id={r.id}
                  d={r.d}
                  fill={regionFillOn ? RegionModel.regionColor(r) : "none"}
                  fillOpacity={regionFillOn ? (regionMode ? 0.55 : 0.72) : 0}
                  stroke={regBorderColor}
                  sw={bw * 1.3}
                  sel={regSelSet.has(r.id)}
                  interactive={regionInteractive}
                ></RegionShape>
              ))}
            </g>
          )}
          {/* ---- water: lakes & rivers (always visible above fills) ---- */}
          {physReady && (
            <g id="phys-water" pointerEvents="none">
              {settings.showLakes !== false && phys.lakes.map((f) => (
                <path key={"lk" + f.id} d={f.d} fill={waterColor} fillOpacity="0.9"
                  stroke={ColorUtil.darken(waterColor, 0.18)} strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"></path>
              ))}
              {settings.showRivers !== false && phys.rivers.map((f) => (
                <path key={"rv" + f.id} d={f.d} fill="none" stroke={waterColor}
                  strokeOpacity={f.importance === "minor" ? 0.6 : 0.85}
                  strokeWidth={RIVER_W[f.importance] || 0.5} strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"></path>
              ))}
            </g>
          )}
          <g id="overlay">
            {ready && settings.showLabels && bm.features.map((f) => {
              const r = regions[f.id];
              const grouped = r && r.group;
              if (grouped) {
                const gl = groupLabels[f.id];
                if (!gl) return null;
                return (
                  <text key={"rl" + f.id} x={f.c[0]} y={f.c[1]} textAnchor="middle" pointerEvents="none"
                    fontSize={Math.min(14, Math.max(5, Math.sqrt(gl.total) * 0.1))}
                    fill={settings.labelColor} opacity="0.75"
                    style={{ fontFamily: settings.labelFont }}>
                    {gl.name}
                  </text>
                );
              }
              return f.area > 260 ? (
                <text key={"rl" + f.id} x={f.c[0]} y={f.c[1]} textAnchor="middle" pointerEvents="none"
                  fontSize={Math.min(11, Math.max(4, Math.sqrt(f.area) * 0.12))}
                  fill={settings.labelColor} opacity="0.65"
                  style={{ fontFamily: settings.labelFont }}>
                  {(r && r.name) || ((App.ui.lang === "ru" && f.nameRu) ? f.nameRu : f.name)}
                </text>
              ) : null;
            })}
            {physReady && settings.showSeaLabels !== false && phys.seas.map((f) => (
              f.importance !== "minor" && f.c ? (
                <text key={"sea" + f.id} x={f.c[0]} y={f.c[1]} textAnchor="middle" pointerEvents="none"
                  fontSize={f.importance === "major" ? 11 : 7}
                  fontStyle="italic" fill={ColorUtil.darken(settings.sea, 0.38)} opacity="0.85"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", userSelect: "none", letterSpacing: "0.5px" }}>
                  {(App.ui.lang === "ru" && f.nameRu) ? f.nameRu : f.name}
                </text>
              ) : null
            ))}
            {physReady && settings.showMountains !== false && phys.relief.map((f) => (
              f.importance === "major" && f.c && f.name ? (
                <text key={"rln" + f.id} x={f.c[0]} y={f.c[1]} textAnchor="middle" pointerEvents="none"
                  fontSize="6.5" fill="#5d4f40" opacity="0.75"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", userSelect: "none",
                           letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  {(App.ui.lang === "ru" && f.nameRu) ? f.nameRu : f.name}
                </text>
              ) : null
            ))}
            {ready && showRegionLayer && regionFillOn && layerRegions.map((r) => (
              r.area > 240 && r.c ? (
                <text key={"mrl" + r.id} x={r.c[0]} y={r.c[1]} textAnchor="middle" pointerEvents="none"
                  fontSize={Math.min(15, Math.max(5, Math.sqrt(r.area) * 0.11))}
                  fontWeight="600" fill={settings.labelColor}
                  stroke={settings.sea} strokeWidth={Math.min(15, Math.max(5, Math.sqrt(r.area) * 0.11)) * 0.07} paintOrder="stroke"
                  opacity="0.9" style={{ fontFamily: settings.labelFont, userSelect: "none" }}>
                  {RegionModel.displayName(r)}
                </text>
              ) : null
            ))}
            {ready && settings.showStateLabels && stateLabels.map((l) => {
              const flagW = l.size * 1.4;
              return (
                <g key={"sl" + l.sid} transform={`rotate(${l.angle || 0} ${l.x} ${l.y})`}>
                  {settings.showFlags && l.flag && (
                    <image data-slabel={l.sid} href={l.flag} x={l.x - flagW / 2} y={l.y - l.size * 1.9}
                      width={flagW} height={flagW * 0.62} preserveAspectRatio="xMidYMid slice"
                      style={{ cursor: "move" }}></image>
                  )}
                  <text data-slabel={l.sid}
                    className={l.atlas ? "country-label" : "country-label plain"}
                    x={l.x} y={l.y} textAnchor="middle" fontSize={l.size}
                    strokeWidth={Math.max(0.5, l.size * 0.13)}
                    style={{ letterSpacing: (l.spacing || 0) + "px", cursor: "move" }}>
                    {l.name}
                  </text>
                </g>
              );
            })}
            {ready && project.labels.map((l) => (
              <text key={l.id} data-label={l.id} x={l.x} y={l.y} textAnchor="middle"
                fontSize={l.size} fill={l.color || settings.labelColor}
                fontWeight={l.bold ? 700 : 400} stroke={settings.sea} strokeWidth={l.size * 0.05} paintOrder="stroke"
                style={{ cursor: "move", fontFamily: settings.labelFont, userSelect: "none", outline: App.ui.selLabel === l.id ? "1px dashed #ff9f2e" : "none" }}>
                {l.text}
              </text>
            ))}
          </g>
          {/* ---- manual edit overlays (split/draw preview, vertex editor) ---- */}
          {App.ui.geomDraw && App.ui.geomDraw.pts.length > 0 && (() => {
            const k = view.current.k;
            const pts = App.ui.geomDraw.pts;
            const dstr = "M" + pts.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join("L") + (App.ui.geomDraw.tool === "draw" && pts.length > 2 ? "Z" : "");
            return (
              <g data-export-skip="1" pointerEvents="none">
                <path d={dstr} fill={App.ui.geomDraw.tool === "draw" ? "rgba(255,159,46,0.14)" : "none"}
                  stroke="#ff9f2e" strokeWidth={1.6 / k} strokeDasharray={`${4 / k} ${3 / k}`}></path>
                {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3 / k} fill="#ff9f2e" stroke="#fff" strokeWidth={0.8 / k}></circle>)}
              </g>
            );
          })()}
          {App.ui.geomEdit && (() => {
            const k = view.current.k;
            return (
              <g data-export-skip="1">
                {App.ui.geomEdit.rings.map((r, ri) => {
                  const dstr = "M" + r.pts.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join("L") + "Z";
                  return (
                    <g key={ri}>
                      <path d={dstr} fill="none" stroke="#ff9f2e" strokeWidth={1.4 / k} pointerEvents="none"></path>
                      {r.pts.map((p, vi) => {
                        const q = r.pts[(vi + 1) % r.pts.length];
                        return (
                          <React.Fragment key={vi}>
                            <rect data-midpoint={ri + ":" + vi}
                              x={(p[0] + q[0]) / 2 - 2.2 / k} y={(p[1] + q[1]) / 2 - 2.2 / k}
                              width={4.4 / k} height={4.4 / k}
                              fill="#ffffff" stroke="#ff9f2e" strokeWidth={0.9 / k} style={{ cursor: "copy" }}></rect>
                            <circle data-vertex={ri + ":" + vi} cx={p[0]} cy={p[1]} r={4 / k}
                              fill="#ff9f2e" stroke="#ffffff" strokeWidth={1 / k} style={{ cursor: "grab" }}></circle>
                          </React.Fragment>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })()}
          <rect ref={marqueeRef} data-export-skip="1" style={{ display: "none" }} fill="rgba(61,123,196,0.15)" stroke="#3d7bc4" strokeWidth="1" vectorEffect="non-scaling-stroke"></rect>
        </g>
      </svg>

      <div className="statusbar">
        <span ref={hoverRef} style={{ minWidth: 80, textAlign: "center" }}></span>
        <span>{bm.count ? <b>{bm.count}</b> : "…"} {(function(){ const ty = (BASEMAPS[project && project.basemapId] || {}).type; return t(ty === "state-grid" ? "stat.states" : ty === "region-grid" ? "stat.regions" : "stat.provinces"); })()}</span>
        {App.regionData.status === "ready" && App.regionData.regions.length > 0 && <span><b>{App.regionData.regions.length}</b> {t("stat.regionsShort")}</span>}
        {RegionModel.supportsRegions() && <span>{regionMode ? t("mode.region") : t("mode.province")}</span>}
        <span ref={zoomTextRef}>100%</span>
      </div>

      <div className="zoom-controls">
        <button className="btn icon" title="+" onClick={() => MapAPI.zoomBy(1.4)}>+</button>
        <button className="btn icon" title="−" onClick={() => MapAPI.zoomBy(1 / 1.4)}>−</button>
        <button className="btn icon" title={t("zoom.fit")} onClick={() => MapAPI.fit()}>⤢</button>
      </div>

      {App.ui.geomEdit && (
        <div className="geom-bar" data-export-skip="1">
          <span className="muted">{t("edit.editingBorders")}</span>
          <button className="btn outline" onClick={() => GeomEdit.smoothEdit()}>{t("edit.smooth")}</button>
          <button className="btn outline" onClick={() => GeomEdit.simplifyEdit()}>{t("edit.simplify")}</button>
          <button className="btn primary" onClick={() => GeomEdit.saveEdit()}>{t("edit.save")}</button>
          <button className="btn outline" onClick={() => GeomEdit.cancelEdit()}>{t("edit.cancel")}</button>
        </div>
      )}
      {!App.ui.geomEdit && App.ui.geomDraw && (
        <div className="geom-bar" data-export-skip="1">
          <span className="muted">{t(App.ui.geomDraw.tool === "split" ? "edit.splitHint" : "edit.drawHint")}</span>
          <button className="btn primary" disabled={App.ui.geomDraw.pts.length < (App.ui.geomDraw.tool === "split" ? 2 : 3)}
            onClick={finishGeomDraw}>{t("edit.finish")}</button>
          <button className="btn outline" onClick={() => { App.ui.geomDraw = null; Actions.ui({ tool: "select" }); }}>{t("edit.cancel")}</button>
        </div>
      )}

      <div className="minimap" onPointerDown={onMinimapClick}>
        <canvas ref={minimapRef}></canvas>
        <div className="minimap-vp" ref={minimapVpRef}></div>
      </div>
    </div>
  );
}

Object.assign(window, { MapView, useStore, regionFill, computeStateLabels });
