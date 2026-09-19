"use strict";

function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
// AtlasForge — map view: rendering, zoom/pan, tools
var _React = React,
  useState = _React.useState,
  useEffect = _React.useEffect,
  useRef = _React.useRef,
  useMemo = _React.useMemo,
  useCallback = _React.useCallback,
  useSyncExternalStore = _React.useSyncExternalStore;
function useStore() {
  return useSyncExternalStore(function (cb) {
    return App.subscribe(cb);
  }, function () {
    return App.version;
  });
}

// ---------- vassal shading ----------
// A vassal's own colour blended toward its overlord's colour: its territory reads
// as "part of the overlord's bloc" while each vassal keeps enough of its own hue to
// stay distinct from the other vassals and from the overlord itself.
var VASSAL_TINT = 0.4;
function ownerColor(states, id) {
  var st = states[id];
  if (!st) return null;
  if (st.vassalOf && states[st.vassalOf]) return ColorUtil.mixHex(st.color, states[st.vassalOf].color, VASSAL_TINT);
  return st.color;
}

// ---------- status stripes (disputed / occupied / assimilation) ----------
// Colours of every country involved, so a glance shows ALL sides:
// disputed -> owner + claimants, occupied -> occupier + who it was taken from,
// assimilation -> owner self-hatch. References state ids only (map-independent).
// The owner's colour is vassal-shaded everywhere; other parties are shown true.
function stripeColors(r, states) {
  var own = r.owner && states[r.owner] ? ownerColor(states, r.owner) : null;
  if (r.status === "disputed") {
    var ids = [r.owner].concat(_toConsumableArray(r.claimants || [])).filter(function (x, i, a) {
      return x && states[x] && a.indexOf(x) === i;
    });
    var cols = ids.map(function (x) {
      return x === r.owner && own ? own : states[x].color;
    });
    return cols.length ? cols : own ? [own] : null;
  }
  if (r.status === "occupied") {
    var from = r.occupiedFrom && states[r.occupiedFrom] ? states[r.occupiedFrom].color : null;
    var _cols = [own, from].filter(Boolean);
    return _cols.length ? _cols : null;
  }
  if (r.status === "assimilation") return own ? [own, ColorUtil.lighten(own, 0.55)] : null;
  return null;
}
function stripeId(cols, kind) {
  return "pat-" + (kind || "x") + "-" + cols.map(function (c) {
    return String(c).replace(/[^0-9a-fA-F]/g, "");
  }).join("-");
}

// relative luminance of a #rrggbb colour; used to pick a contrasting black/white
// (capital stars, label halos). Non-hex (e.g. a url(#pattern) fill) -> mid grey.
function luminance(hex) {
  if (typeof hex !== "string" || hex[0] !== "#" || hex.length < 7) return 0.5;
  var p = function p(i) {
    return parseInt(hex.slice(i, i + 2), 16) / 255;
  };
  return 0.2126 * p(1) + 0.7152 * p(3) + 0.0722 * p(5);
}
function contrastBW(hex) {
  return luminance(hex) > 0.55 ? "#000000" : "#ffffff";
}

// ---------- map-independent country borders ----------
function geomToMP(g) {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}
// Country borders that DON'T rely on map topology: union each owner's region
// polygons (polygon-clipping) and stroke the outline. Robust to split/merge/draw
// (no shared arcs needed) and works on every map. Per-owner cache keyed by
// membership + geometry edits, so painting only re-unions the owner that changed.
function ownerUnionPath(raw, proj, project, cacheRef) {
  if (!proj || !raw || typeof polygonClipping === "undefined") return {
    d: null,
    segs: null
  };
  var path = d3.geoPath(proj);
  var groups = new Map();
  raw.features.forEach(function (f) {
    var e = window.effRegion(project, f.id);
    var owner = e && e.owner;
    if (!owner || !f.geometry) return;
    if (!groups.has(owner)) groups.set(owner, {
      ids: [],
      mps: []
    });
    var g = groups.get(owner);
    g.ids.push(f.id);
    g.mps.push(geomToMP(f.geometry));
  });
  var editKey = window.GeomEdit && GeomEdit.editsKey ? GeomEdit.editsKey(project) : "0";
  var cache = cacheRef.current || {};
  var fresh = {};
  var d = "";
  var segs = {};
  groups.forEach(function (g, owner) {
    var sig = owner + "@" + editKey + "@" + g.ids.sort().join(",");
    var seg = cache[sig];
    if (seg == null) {
      var u = null;
      try {
        u = polygonClipping.union.apply(polygonClipping, g.mps);
      } catch (e) {
        u = null;
      }
      seg = "";
      if (u && u.length) {
        try {
          seg = path({
            type: "MultiPolygon",
            coordinates: u
          }) || "";
        } catch (e) {}
      }
    }
    fresh[sig] = seg;
    segs[owner] = seg;
    d += seg;
  });
  cacheRef.current = fresh;
  return {
    d: d || null,
    segs: segs
  };
}

// ---------- fill resolution ----------
function regionFill(r, states, settings, feat) {
  // a dataset that ships its own per-region colour (e.g. the vectorized OWB map)
  // shows it as the base when the region has no owner / no manual override
  // datasets that ship their own per-region colour still follow the active map
  // style: blend that base colour a little toward the theme's land tone so the
  // unowned land re-themes with the style (owned regions keep their own colour).
  var baseLand = feat && feat.baseColor ? ColorUtil.mixHex(feat.baseColor, settings.land, 0.3) : settings.provinceTint && feat ? ColorUtil.provinceTint(settings.land, feat.id) : settings.land;
  if (!r) return baseLand;
  if (r.color) return r.color;
  var st = r.owner ? states[r.owner] : null;
  if (!st) return baseLand;
  var flagMode = settings.mapMode === "flag";
  var L = ColorUtil.lighten;
  // owner colour, vassal-shaded toward the overlord (the status tints below are
  // computed off this so a vassal's whole territory carries the overlord's shade).
  var oc = ownerColor(states, r.owner) || st.color;
  switch (r.status) {
    case "autonomy":
      return flagMode && st.flag ? "url(#flag-".concat(r.owner, ")") : L(oc, 0.30);
    case "colony":
      return flagMode && st.flag ? "url(#flag-".concat(r.owner, ")") : L(oc, 0.52);
    case "disputed":
    case "occupied":
    case "assimilation":
      {
        var cols = stripeColors(r, states);
        return cols ? "url(#".concat(stripeId(cols, r.status), ")") : oc;
      }
    default:
      if (st.flag && (flagMode || st.flagFill)) return "url(#flag-".concat(r.owner, ")");
      return oc;
  }
}
var TERRAIN_COLORS = {
  plains: "#cdbf86",
  forest: "#5f8a52",
  hills: "#b09a64",
  mountain: "#9a8d7d",
  desert: "#e3cd8f",
  marsh: "#7f9a78",
  jungle: "#3f7a46",
  urban: "#b08f8a",
  tundra: "#cfd8d2",
  lakes: "#8fb6cf",
  ocean: "#9fc1d6",
  taiga: "#55805d",
  savanna: "#cbbd7a",
  glacier: "#e8eef2"
};

// Province fill, chosen by the project display mode. Region display modes mute the
// province base so the region overlay reads clearly; provinces always stay the base.
function provinceFill(displayMode, r, states, settings, feat, project) {
  if (displayMode === "terrain") return TERRAIN_COLORS[feat && feat.terrain] || settings.land;
  if (displayMode === "province") return feat ? ColorUtil.provinceTint(settings.land, feat.id) : settings.land;
  if (["culture", "religion", "language"].includes(displayMode)) {
    var value = window.Metadata && Metadata.value(project, displayMode, r, feat);
    return value ? Metadata.color(project, displayMode, value) : settings.land;
  }
  if (RegionModel.modeType[displayMode]) {
    // a region display mode: keep a soft owner hint but dim it under the regions
    var owner = r && r.owner ? states[r.owner] : null;
    var base = ColorUtil.provinceTint(settings.land, feat ? feat.id : "x");
    return owner ? ColorUtil.mixHex(base, owner.color, 0.18) : base;
  }
  return regionFill(r, states, settings, feat); // "country" (default)
}
var Region = React.memo(function Region(_ref) {
  var id = _ref.id,
    d = _ref.d,
    fill = _ref.fill,
    stroke = _ref.stroke,
    sw = _ref.sw,
    sel = _ref.sel,
    clip = _ref.clip,
    gap = _ref.gap;
  return /*#__PURE__*/React.createElement("path", {
    className: sel ? "region sel" : "region",
    "data-id": id,
    d: d,
    fill: fill,
    stroke: stroke,
    strokeWidth: sw,
    clipPath: clip,
    style: gap ? {
      vectorEffect: "none"
    } : undefined
  });
});

// One mid-level region (state / custom). Drawn above provinces.
var RegionShape = React.memo(function RegionShape(_ref2) {
  var id = _ref2.id,
    d = _ref2.d,
    fill = _ref2.fill,
    fillOpacity = _ref2.fillOpacity,
    stroke = _ref2.stroke,
    sw = _ref2.sw,
    sel = _ref2.sel,
    interactive = _ref2.interactive;
  return /*#__PURE__*/React.createElement("path", {
    className: sel ? "mapregion sel" : "mapregion",
    "data-region-id": id,
    d: d,
    fill: fill,
    fillOpacity: fillOpacity,
    stroke: stroke,
    strokeWidth: sw,
    pointerEvents: interactive ? "auto" : "none"
  });
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
  var groups = {};
  for (var rid in project.regions) {
    var e = effRegion(project, rid);
    if (!e || !e.owner) continue;
    var f = basemap.byId[rid];
    if (!f) continue;
    var g = groups[e.owner] || (groups[e.owner] = {
      regions: [],
      total: 0,
      sw: 0,
      sx: 0,
      sy: 0,
      sxx: 0,
      syy: 0,
      sxy: 0,
      best: null
    });
    var w = Math.sqrt(Math.max(1, f.area));
    g.regions.push(f);
    g.total += f.area;
    g.sw += w;
    g.sx += f.c[0] * w;
    g.sy += f.c[1] * w;
    g.sxx += f.c[0] * f.c[0] * w;
    g.syy += f.c[1] * f.c[1] * w;
    g.sxy += f.c[0] * f.c[1] * w;
    if (!g.best || f.area > g.best.area) g.best = f;
  }
  var ctx = computeStateLabels._ctx || (computeStateLabels._ctx = document.createElement("canvas").getContext("2d"));
  var insideOwned = function insideOwned(g, x, y) {
    var _iterator = _createForOfIteratorHelper(g.regions),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var _f = _step.value;
        if (x < _f.b[0][0] || x > _f.b[1][0] || y < _f.b[0][1] || y > _f.b[1][1]) continue;
        if (!_f._p2d) {
          try {
            _f._p2d = new Path2D(_f.d);
          } catch (e) {
            continue;
          }
        }
        if (ctx.isPointInPath(_f._p2d, x, y)) return true;
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return false;
  };
  var out = [];
  var _loop = function _loop() {
      var st = project.states[sid];
      var g = groups[sid];
      if (!st || !g.sw) return 0; // continue
      var ls = st.labelStyle || {};
      if (ls.hidden) return 0; // continue
      var mx = g.sx / g.sw,
        my = g.sy / g.sw;
      // safe interior anchor
      var ax = mx,
        ay = my;
      if (!insideOwned(g, ax, ay)) {
        ax = g.best.c[0];
        ay = g.best.c[1];
        if (!insideOwned(g, ax, ay)) {
          ax = (g.best.b[0][0] + g.best.b[1][0]) / 2;
          ay = (g.best.b[0][1] + g.best.b[1][1]) / 2;
        }
      }
      // PCA main axis
      var cxx = g.sxx / g.sw - mx * mx,
        cyy = g.syy / g.sw - my * my,
        cxy = g.sxy / g.sw - mx * my;
      var tr = cxx + cyy,
        det = cxx * cyy - cxy * cxy;
      var disc = Math.max(0, tr * tr / 4 - det);
      var l1 = tr / 2 + Math.sqrt(disc),
        l2 = Math.max(0.01, tr / 2 - Math.sqrt(disc));
      var angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;
      var ratio = l1 / l2;
      if (ratio < 1.45 || Math.abs(angle) < 7) angle = 0;
      angle = Math.max(-25, Math.min(25, angle));
      // usable span along / across the axis, symmetric around the anchor so the
      // centered label cannot stick out of the far side
      var rad = angle * Math.PI / 180;
      var ux = Math.cos(rad),
        uy = Math.sin(rad);
      var minP = 0,
        maxP = 0,
        minQ = 0,
        maxQ = 0;
      g.regions.forEach(function (f) {
        var px = f.c[0] - ax,
          py = f.c[1] - ay;
        var halfW = (f.b[1][0] - f.b[0][0]) / 2,
          halfH = (f.b[1][1] - f.b[0][1]) / 2;
        var halfOn = (Math.abs(halfW * ux) + Math.abs(halfH * uy)) * 0.8;
        var halfOff = (Math.abs(halfW * uy) + Math.abs(halfH * ux)) * 0.8;
        var pr = px * ux + py * uy;
        var pq = -px * uy + py * ux;
        if (pr - halfOn < minP) minP = pr - halfOn;
        if (pr + halfOn > maxP) maxP = pr + halfOn;
        if (pq - halfOff < minQ) minQ = pq - halfOff;
        if (pq + halfOff > maxQ) maxQ = pq + halfOff;
      });
      var axisSpan = Math.max(4, 2 * Math.min(-minP, maxP) || maxP - minP);
      var minorSpan = Math.max(3, 2 * Math.min(-minQ, maxQ) || maxQ - minQ);
      var len = Math.max(1, st.name.length);
      var glyphW = 0.62;
      var size = Math.min(26, Math.max(4, Math.sqrt(g.total) * 0.14)) * (project.settings.fontScale || 1);
      size = Math.min(size, Math.max(3.2, minorSpan * 0.7));
      var spacing = size * 0.12;
      var maxW = axisSpan * 0.92;
      if (len * size * glyphW + spacing * (len - 1) > maxW) spacing = 0;
      if (len * size * glyphW > maxW) size = Math.max(3.2, maxW / (len * glyphW));
      // unfittable even at minimum size -> hide (tiny countries)
      if (size <= 3.25 && len * size * glyphW > axisSpan * 1.5 && !ls.size) return 0; // continue
      // manual overrides
      if (ls.size) size = ls.size;
      if (ls.spacing != null) spacing = +ls.spacing;
      if (ls.angle != null) angle = +ls.angle;
      var off = st.labelOffset || [0, 0];
      out.push({
        sid: sid,
        name: st.name,
        x: ax + off[0],
        y: ay + off[1],
        size: size,
        angle: angle,
        spacing: spacing,
        flag: st.flag,
        atlas: project.settings.labelAtlas !== false
      });
    },
    _ret;
  for (var sid in groups) {
    _ret = _loop();
    if (_ret === 0) continue;
  }
  return out;
}

// Better label anchor than the bare area-weighted centroid: for crescent /
// donut / multi-island shapes the centroid can fall in a bay or in the sea, so
// nudge it to an interior point (bbox centre if that lands inside the polygon).
// Cached on the feature (geometry is stable per basemap load).
function featAnchor(f) {
  if (f._anchor) return f._anchor;
  var a = f.c;
  try {
    var ctx = featAnchor._ctx || (featAnchor._ctx = document.createElement("canvas").getContext("2d"));
    if (!f._p2d && f.d) f._p2d = new Path2D(f.d);
    if (f._p2d && f.b && !ctx.isPointInPath(f._p2d, a[0], a[1])) {
      var bx = (f.b[0][0] + f.b[1][0]) / 2,
        by = (f.b[0][1] + f.b[1][1]) / 2;
      if (ctx.isPointInPath(f._p2d, bx, by)) a = [bx, by];
    }
  } catch (e) {/* keep centroid */}
  return f._anchor = a;
}
function MapView() {
  useStore();
  var svgRef = useRef(null);
  var zoomRef = useRef(null);
  var marqueeRef = useRef(null);
  var rubberRef = useRef(null); // split/draw: dashed segment from the last vertex to the cursor
  var minimapRef = useRef(null);
  var minimapVpRef = useRef(null);
  var hoverRef = useRef(null);
  var zoomTextRef = useRef(null);
  var view = useRef({
    x: 0,
    y: 0,
    k: 1
  });
  var gesture = useRef(null);
  var dragLabel = useRef(null);
  var unionCacheRef = useRef({});
  var worldLayerRef = useRef(null); // custom world: host of the terrain canvas (under the SVG)
  var brushRef = useRef(null); // custom world: brush outline following the pen
  var riverPrevRef = useRef(null); // custom world: river stroke preview
  var riverEditRef = useRef(null); // custom world: new course while a river end is dragged
  var touches = useRef(new Map()); // active touch pointers (pinch zoom / two-finger pan)
  var tapRef = useRef(null); // multi-finger tap recognizer: { t0, max, moved, starts }
  var longPressRef = useRef(null); // finger long-press (eyedropper) timer
  var autonomyCacheRef = useRef({});
  var project = App.project;
  var bm = App.basemap;
  var ready = bm.status === "ready" && project;
  var settings = project ? project.settings : MAP_STYLES.standard;
  var states = project ? project.states : {};
  var regions = project ? project.regions : {};
  var effOf = useCallback(function (rid) {
    var p = App.project;
    if (!p) return null;
    var r = p.regions[rid];
    if (r && r.group && p.groups && p.groups[r.group]) return p.groups[r.group];
    return r;
  }, []);
  var selSet = useMemo(function () {
    return new Set(App.ui.selection);
  }, [App.version]);
  var regSelSet = useMemo(function () {
    return new Set(App.ui.regionSelection);
  }, [App.version]);

  // ---------- mid-level region layer ----------
  var displayMode = project ? project.displayMode || "country" : "country";
  var regionMode = App.ui.selectMode === "region";
  var regionDisplay = !!RegionModel.modeType[displayMode];
  var activeLayer = ready && RegionModel.supportsRegions() ? RegionModel.activeLayer() : null;
  var showRegionLayer = !!activeLayer && activeLayer.visible !== false && (regionMode || regionDisplay || settings.showRegionBorders !== false);
  var layerRegions = useMemo(function () {
    if (!showRegionLayer) return [];
    return RegionModel.regionsOfLayer(activeLayer);
  }, [showRegionLayer, App.regionVersion, ready, activeLayer && activeLayer.id]);
  var activeProvToRegion = useMemo(function () {
    if (!ready || !activeLayer) return {};
    if (activeLayer.builtin && activeLayer.type === "state") return App.regionData.provinceToRegion || {};
    var m = {};
    (activeLayer.regionIds || []).forEach(function (rid) {
      var r = RegionModel.resolve(rid);
      RegionModel.provinceFeatureIds(r).forEach(function (fid) {
        m[fid] = rid;
      });
    });
    return m;
  }, [ready, App.regionVersion, activeLayer && activeLayer.id]);
  // refs so the (stable) pointer handlers can read the latest region data
  var provRegionRef = useRef({});
  var layerRegionsRef = useRef([]);
  provRegionRef.current = activeProvToRegion;
  layerRegionsRef.current = layerRegions;

  // ---------- view transform (non-reactive) ----------
  var applyView = useCallback(function () {
    var v = view.current;
    if (zoomRef.current) zoomRef.current.setAttribute("transform", "translate(".concat(v.x, ",").concat(v.y, ") scale(").concat(v.k, ")"));
    if (zoomTextRef.current) zoomTextRef.current.textContent = Math.round(v.k * 100) + "%";
    if (window.World && World.active()) World.place(svgRef.current, v);
    var ends = svgRef.current && svgRef.current.querySelector("#river-ends");
    if (ends) {
      var ctm = svgRef.current.getScreenCTM();
      var per = v.k * (ctm && ctm.a || 1); // screen px per map unit
      var _iterator2 = _createForOfIteratorHelper(ends.querySelectorAll("[data-rpx]")),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var el = _step2.value;
          el.setAttribute("r", (+el.getAttribute("data-rpx") / per).toFixed(3));
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
    // places keep a readable size at every zoom (no React render per zoom step)
    var og = svgRef.current && svgRef.current.querySelector("#objects");
    if (og && App.project && App.project.objects && window.objectTransform) {
      var _iterator3 = _createForOfIteratorHelper(og.children),
        _step3;
      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var _el = _step3.value;
          var o = App.project.objects[_el.getAttribute("data-object")];
          if (o) _el.setAttribute("transform", objectTransform(o, v.k));
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
    }
    if (minimapVpRef.current) {
      var mw = 168,
        mh = 88,
        sx = mw / MAP_W,
        sy = mh / MAP_H;
      var w = MAP_W / v.k * sx,
        h = MAP_H / v.k * sy;
      var x = -v.x / v.k * sx,
        y = -v.y / v.k * sy;
      Object.assign(minimapVpRef.current.style, {
        left: x + "px",
        top: y + "px",
        width: w + "px",
        height: h + "px"
      });
    }
  }, []);
  var zoomEmitRaf = useRef(false);
  var setView = useCallback(function (x, y, k) {
    k = Math.max(0.6, Math.min(90, k));
    view.current = {
      x: x,
      y: y,
      k: k
    };
    applyView();
    // geometry overlays (handles, dashed previews) size themselves by 1/k —
    // re-render them on zoom, throttled to animation frames
    if ((App.ui.geomEdit || App.ui.geomDraw) && !zoomEmitRaf.current) {
      zoomEmitRaf.current = true;
      requestAnimationFrame(function () {
        zoomEmitRaf.current = false;
        App.emit();
      });
    }
  }, [applyView]);
  useEffect(function () {
    window.MapAPI = {
      fit: function fit() {
        return setView(0, 0, 1);
      },
      zoomBy: function zoomBy(f) {
        var v = view.current;
        var cx = MAP_W / 2,
          cy = MAP_H / 2;
        setView(cx - (cx - v.x) * f, cy - (cy - v.y) * f, v.k * f);
      },
      zoomTo: function zoomTo(b) {
        var bw = Math.max(4, b[1][0] - b[0][0]),
          bh = Math.max(4, b[1][1] - b[0][1]);
        var k = Math.min(60, 0.55 * Math.min(MAP_W / bw, MAP_H / bh));
        var cx = (b[0][0] + b[1][0]) / 2,
          cy = (b[0][1] + b[1][1]) / 2;
        setView(MAP_W / 2 - k * cx, MAP_H / 2 - k * cy, k);
      },
      viewK: function viewK() {
        return view.current.k;
      },
      // screen pixels per map unit at zoom 1 (the SVG viewBox scale)
      pxPerUnit: function pxPerUnit() {
        var m = svgRef.current && svgRef.current.getScreenCTM();
        return m ? m.a : 1;
      },
      finishGeomDraw: finishGeomDraw
    };
    applyView();
  }, [setView, applyView, finishGeomDraw]);

  // ---------- coordinate helpers ----------
  var clientToViewbox = useCallback(function (e) {
    var svg = svgRef.current;
    var m = svg.getScreenCTM().inverse();
    var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  }, []);
  var clientToMap = useCallback(function (e) {
    var _clientToViewbox = clientToViewbox(e),
      _clientToViewbox2 = _slicedToArray(_clientToViewbox, 2),
      vx = _clientToViewbox2[0],
      vy = _clientToViewbox2[1];
    var v = view.current;
    return [(vx - v.x) / v.k, (vy - v.y) / v.k];
  }, [clientToViewbox]);

  // ---------- wheel zoom ----------
  useEffect(function () {
    var svg = svgRef.current;
    if (!svg) return;
    var onWheel = function onWheel(e) {
      e.preventDefault();
      var f = Math.exp(-e.deltaY * 0.0016);
      var _clientToViewbox3 = clientToViewbox(e),
        _clientToViewbox4 = _slicedToArray(_clientToViewbox3, 2),
        px = _clientToViewbox4[0],
        py = _clientToViewbox4[1];
      var v = view.current;
      var nk = Math.max(0.6, Math.min(90, v.k * f));
      var ff = nk / v.k;
      setView(px - (px - v.x) * ff, py - (py - v.y) * ff, nk);
    };
    svg.addEventListener("wheel", onWheel, {
      passive: false
    });
    return function () {
      return svg.removeEventListener("wheel", onWheel);
    };
  }, [clientToViewbox, setView]);

  // ---------- custom world: mount the terrain canvas & keep it aligned ----------
  var worldOn = !!(window.World && World.active());
  useEffect(function () {
    if (!worldOn) return;
    World.sync();
    var host = worldLayerRef.current;
    if (host && World.canvas && World.canvas.parentNode !== host) host.appendChild(World.canvas);
    applyView();
  });
  useEffect(function () {
    var stage = svgRef.current && svgRef.current.parentNode;
    if (!stage || typeof ResizeObserver === "undefined") return;
    var ro = new ResizeObserver(function () {
      return applyView();
    });
    ro.observe(stage);
    return function () {
      return ro.disconnect();
    };
  }, [applyView]);

  // ---------- painting ----------
  var paintRegion = useCallback(function (rid, erase) {
    if (!rid) return;
    if (erase) {
      var _e = effOf(rid);
      if (_e && _e.owner) Actions.assign([rid], null, {
        undo: false
      });
      return;
    }
    var sid = App.ui.activeState;
    if (!sid) {
      Actions.toast(t("hint.paintNoState"));
      return;
    }
    var e = effOf(rid);
    if (!e || e.owner !== sid) Actions.assign([rid], sid, {
      undo: false
    });
  }, [effOf]);
  var fillByOwner = useCallback(function (rid) {
    var sid = App.ui.activeState;
    if (!sid) {
      Actions.toast(t("hint.paintNoState"));
      return;
    }
    var p = App.project;
    var e0 = effOf(rid);
    var srcOwner = e0 ? e0.owner : null;
    if (srcOwner === sid) return;
    var f0 = bm.byId[rid];
    var targets = [];
    bm.features.forEach(function (f) {
      var e = effOf(f.id);
      var o = e ? e.owner : null;
      if (o !== srcOwner) return;
      // for unowned land on country-subdivided maps, restrict to the same country
      if (!srcOwner && f0 && f0.country && f.country !== f0.country) return;
      targets.push(f.id);
    });
    Actions.assign(targets, sid);
  }, [bm, effOf]);

  // ---------- pointer gestures ----------
  // the region a polyline mostly runs through (9 samples along it)
  var lineTarget = function lineTarget(pts) {
    if (!window.GeomEdit || !pts || !pts.length) return null;
    var hits = {};
    for (var i = 0; i < 9; i++) {
      var q = pts[Math.min(pts.length - 1, Math.round((pts.length - 1) * (i + 0.5) / 9))];
      var hid = GeomEdit.regionAt(q[0], q[1]);
      if (hid) hits[hid] = (hits[hid] || 0) + 1;
    }
    return Object.keys(hits).sort(function (x, y) {
      return hits[y] - hits[x];
    })[0] || null;
  };
  // finish an in-progress split/draw polyline (double-click, Enter or button)
  var finishGeomDraw = useCallback(function () {
    var gd = App.ui.geomDraw;
    if (!gd || !gd.pts.length) {
      App.ui.geomDraw = null;
      App.emit();
      return;
    }
    if (rubberRef.current) rubberRef.current.style.display = "none";
    var smooth = window.GeomEdit && App.project && App.project.settings && App.project.settings.cutSmooth !== false;
    var k = view.current.k;
    var pts = gd.pts;
    if (gd.tool === "split") {
      if (pts.length < 2) {
        Actions.toast(t("edit.tooFewPoints"));
        return;
      }
      if (smooth && pts.length >= 3) pts = GeomEdit.smoothLine(pts, k, false);
      // cut the region the line actually runs through (most samples along it);
      // a stale selection elsewhere must not redirect the cut
      var target = lineTarget(pts) || App.ui.selection[0];
      if (!target) {
        Actions.toast(t("edit.noTarget"));
        App.ui.geomDraw = null;
        App.emit();
        return;
      }
      Actions.splitRegionGeometry(target, pts);
    } else {
      if (pts.length < 3) {
        Actions.toast(t("edit.tooFewPoints"));
        return;
      }
      if (smooth && pts.length >= 4) pts = GeomEdit.smoothLine(pts, k, true);
      var cut = confirm(t("edit.drawCutAsk"));
      var nm = prompt(t("edit.drawNameAsk"), "");
      if (nm === null) {
        App.ui.geomDraw = null;
        App.emit();
        return;
      }
      Actions.drawNewRegion(pts, cut ? "cut" : "draft", nm || null);
    }
    App.ui.geomDraw = null;
    App.emit();
  }, []);

  // finger long-press = eyedropper: terrain brush on custom worlds, else the owner state
  var armLongPress = function armLongPress(e, rid) {
    clearTimeout(longPressRef.current);
    var cx = e.clientX,
      cy = e.clientY;
    longPressRef.current = setTimeout(function () {
      var g = gesture.current;
      if (!g || g.mode !== "down" || touches.current.size !== 1) return;
      gesture.current = null; // the lift that follows must not also select
      if (window.World && World.active() && App.ui.tool === "world") {
        var b = World.pickBrush(World.mapToGrid(clientToMap({
          clientX: cx,
          clientY: cy
        })));
        if (b) {
          Actions.ui({
            worldBrush: b
          });
          Actions.toast(t("input.pickedBrush").replace("{b}", t("world.brush." + b)));
        }
        return;
      }
      var e0 = rid && App.project ? effRegion(App.project, rid) : null;
      if (e0 && e0.owner && App.project.states[e0.owner]) {
        Actions.ui({
          activeState: e0.owner
        });
        Actions.toast(t("input.pickedState").replace("{s}", App.project.states[e0.owner].name));
      }
    }, 520);
  };
  var onPointerDown = useCallback(function (e) {
    if (e.button === 2) return;
    var tool = App.ui.tool;
    // ---- touch: two fingers pinch-zoom / pan on every map ----
    if (e.pointerType === "touch") {
      var now = performance.now();
      touches.current.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.current.size === 1) tapRef.current = {
        t0: now,
        max: 1,
        moved: false,
        starts: new Map()
      };
      var tap = tapRef.current;
      if (tap) {
        tap.max = Math.max(tap.max, touches.current.size);
        tap.starts.set(e.pointerId, [e.clientX, e.clientY]);
      }
      clearTimeout(longPressRef.current);
      if (touches.current.size >= 2) {
        // a second finger: this is a gesture. A stroke the first finger started a
        // moment ago was part of it (two-finger tap / pinch) — drop it, don't commit.
        var g0 = gesture.current;
        var young = tap && now - tap.t0 < 350;
        if (g0 && g0.mode === "world") {
          try {
            svgRef.current.releasePointerCapture(g0.pointerId);
          } catch (err) {}
          young ? World.strokeCancel() : World.strokeEnd();
        } else if (g0 && g0.mode === "riverEnd") {
          try {
            svgRef.current.releasePointerCapture(g0.pointerId);
          } catch (err) {}
          World.endEditCancel();
          if (riverEditRef.current) riverEditRef.current.style.display = "none";
          App.emit();
        } else if (g0 && g0.mode === "paint") {
          young ? Actions.cancelStroke() : Actions.endStroke();
        }
        var _ref3 = _toConsumableArray(touches.current.values()),
          a = _ref3[0],
          b = _ref3[1];
        gesture.current = {
          mode: "pinch",
          dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
          mid: clientToViewbox({
            clientX: (a[0] + b[0]) / 2,
            clientY: (a[1] + b[1]) / 2
          })
        };
        return;
      }
    }
    var rid = e.target.dataset ? e.target.dataset.id : null;
    var regId = e.target.dataset ? e.target.dataset.regionId : null;
    var lbl = e.target.dataset ? e.target.dataset.label : null;
    var slbl = e.target.dataset ? e.target.dataset.slabel : null;
    var flbl = e.target.dataset ? e.target.dataset.flabel : null;
    var _clientToViewbox5 = clientToViewbox(e),
      _clientToViewbox6 = _slicedToArray(_clientToViewbox5, 2),
      vx = _clientToViewbox6[0],
      vy = _clientToViewbox6[1];
    var mapPt = clientToMap(e);
    if (e.pointerType === "pen" && window.World && !World.penSeen) {
      World.penSeen = true;
      App.emit();
    }
    // ---- stylus draws, fingers navigate: once a pen has been seen (and the
    // "pencil only" preference is on) a finger pans, pinches, taps to select and
    // long-presses to pick — it never paints ----
    var fingerNav = e.pointerType === "touch" && window.World && World.penSeen && App.ui.pencilOnly !== false;
    // ---- the source / mouth handles of the river whose card is open ----
    var endEl = e.target.closest ? e.target.closest("[data-river-end]") : null;
    if (endEl && e.button === 0 && window.World && World.active() && App.ui.card && App.ui.card.kind === "river") {
      var ctm = svgRef.current.getScreenCTM();
      var tol = (e.pointerType === "touch" ? 18 : 12) / Math.max(0.0001, view.current.k * World.mapUnitsPerCell() * (ctm && ctm.a || 1));
      if (World.endEditStart(App.ui.card.index, endEl.getAttribute("data-river-end"), World.mapToGrid(mapPt), tol)) {
        gesture.current = {
          mode: "riverEnd",
          pointerId: e.pointerId,
          end: endEl.getAttribute("data-river-end")
        };
        try {
          svgRef.current.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
      e.stopPropagation();
      return;
    }
    // ---- places (cities, fortresses…) ----
    var objEl = e.target.closest ? e.target.closest("[data-object]") : null;
    var objId = objEl ? objEl.getAttribute("data-object") : null;
    if (App.ui.roadFrom && e.button === 0) {
      var rf = App.ui.roadFrom;
      if (objId && objId !== rf.id) {
        Actions.ui({
          roadFrom: null
        });
        if (Actions.addRoad(rf.id, objId, rf.kind)) Actions.toast(t("obj.roadAdded"));
        return;
      }
      if (objId) return;
    }
    var objTools = tool === "select" || tool === "place" || tool === "pan" || tool === "label";
    if (objId && e.button === 0 && (objTools || fingerNav)) {
      var o = App.project.objects[objId];
      gesture.current = {
        mode: "objdown",
        id: objId,
        vx: vx,
        vy: vy,
        start: mapPt,
        orig: [o.x, o.y],
        finger: e.pointerType === "touch"
      };
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch (err) {}
      return;
    }
    if (tool === "place" && e.button === 0 && !fingerNav) {
      var id = Actions.addObject(App.ui.placeType || "town", mapPt[0], mapPt[1]);
      Actions.ui({
        card: {
          kind: "object",
          id: id
        },
        selection: []
      });
      return;
    }
    if (fingerNav) {
      gesture.current = {
        mode: "down",
        vx: vx,
        vy: vy,
        rid: rid,
        regId: regId,
        shift: false,
        tool: "select",
        panOk: true,
        finger: true
      };
      armLongPress(e, rid);
      return;
    }
    // ---- custom world terrain brushes ----
    if (tool === "world" && window.World && World.active() && e.button === 0) {
      var g = World.mapToGrid(clientToMap(e));
      World.strokeStart(g, e.pressure, e.pointerType, e.altitudeAngle);
      gesture.current = {
        mode: "world",
        pointerId: e.pointerId
      };
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch (err) {}
      return;
    }

    // ---- reference backdrop move / resize ----
    if (e.target.dataset && (e.target.dataset.backdrop || e.target.dataset.bdresize)) {
      var bd = App.project.backdrop;
      Actions.beginStroke();
      gesture.current = {
        mode: e.target.dataset.bdresize ? "bdresize" : "bdmove",
        start: mapPt,
        orig: {
          x: bd.x,
          y: bd.y,
          w: bd.w,
          h: bd.h
        }
      };
      e.stopPropagation();
      return;
    }

    // ---- geometry editing: vertex handles ----
    var sess = App.ui.geomEdit;
    if (sess) {
      var vh = e.target.dataset ? e.target.dataset.vertex : null;
      var mh = e.target.dataset ? e.target.dataset.midpoint : null;
      if (vh) {
        var _vh$split$map = vh.split(":").map(Number),
          _vh$split$map2 = _slicedToArray(_vh$split$map, 2),
          ri = _vh$split$map2[0],
          vi = _vh$split$map2[1];
        if (e.altKey) {
          // delete vertex (neighbours sharing it drop it too)
          if (GeomEdit.removeVertex(sess, ri, vi)) App.emit();else Actions.toast(t("edit.minPoints"));
        } else {
          gesture.current = {
            mode: "vertex",
            ri: ri,
            vi: vi
          };
        }
        e.stopPropagation();
        return;
      }
      if (mh) {
        // insert a vertex at the segment midpoint and start dragging it
        var _mh$split$map = mh.split(":").map(Number),
          _mh$split$map2 = _slicedToArray(_mh$split$map, 2),
          _ri = _mh$split$map2[0],
          _vi = _mh$split$map2[1];
        var nvi = GeomEdit.insertVertex(sess, _ri, _vi);
        gesture.current = {
          mode: "vertex",
          ri: _ri,
          vi: nvi
        };
        App.emit();
        e.stopPropagation();
        return;
      }
    }

    // ---- geometry tools: collect polyline points ----
    if ((tool === "split" || tool === "draw") && e.button === 0) {
      var k = view.current.k;
      var pt = window.GeomEdit ? GeomEdit.snap(mapPt, k) : mapPt;
      var gd = App.ui.geomDraw;
      if (!gd || gd.tool !== tool) gd = App.ui.geomDraw = {
        tool: tool,
        pts: []
      };
      var last = gd.pts[gd.pts.length - 1];
      if (!last || Math.hypot(last[0] - pt[0], last[1] - pt[1]) > 1.5 / k) gd.pts.push(pt);
      if (e.detail >= 2 && gd.pts.length >= (tool === "split" ? 2 : 3)) {
        finishGeomDraw();
        return;
      }
      // hold and drag = freehand stroke; a plain click (even with a little
      // hand jitter) just adds one vertex — see the pointer-up handler
      gesture.current = {
        mode: "freehand",
        tool: tool,
        moved: false,
        len: 0,
        base: gd.pts.length
      };
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch (err) {} // keep the stroke over overlays
      App.emit();
      return;
    }
    if ((tool === "select" || tool === "label") && flbl) {
      var ov = (App.project.featLabels || {})[flbl] || {};
      dragLabel.current = {
        kind: "feat",
        id: flbl,
        start: mapPt,
        moved: false,
        orig: [ov.dx || 0, ov.dy || 0]
      };
      gesture.current = {
        mode: "label"
      };
      Actions.beginStroke();
      e.stopPropagation();
      return;
    }
    if (tool === "select" && (lbl || slbl)) {
      dragLabel.current = {
        kind: lbl ? "custom" : "state",
        id: lbl || slbl,
        start: mapPt,
        moved: false,
        orig: null
      };
      if (slbl) {
        var st = App.project.states[slbl];
        dragLabel.current.orig = (st.labelOffset || [0, 0]).slice();
      } else {
        var l = App.project.labels.find(function (x) {
          return x.id === lbl;
        });
        dragLabel.current.orig = [l.x, l.y];
      }
      gesture.current = {
        mode: "label"
      };
      Actions.beginStroke();
      e.stopPropagation();
      return;
    }
    if (tool === "paint" || tool === "erase") {
      Actions.beginStroke();
      paintRegion(rid, tool === "erase");
      gesture.current = {
        mode: "paint",
        erase: tool === "erase"
      };
      return;
    }
    if (tool === "select" && e.shiftKey && !rid && !regId) {
      gesture.current = {
        mode: "marquee",
        x0: vx,
        y0: vy
      };
      return;
    }
    gesture.current = {
      mode: "down",
      vx: vx,
      vy: vy,
      rid: rid,
      regId: regId,
      shift: e.shiftKey,
      tool: tool,
      panOk: tool === "pan" || tool === "select" || tool === "fill" || tool === "label" || tool === "world" || e.button === 1
    };
  }, [clientToViewbox, clientToMap, paintRegion]);
  var onPointerMove = useCallback(function (e) {
    var g = gesture.current;
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, [e.clientX, e.clientY]);
      var tap = tapRef.current;
      var st = tap && tap.starts.get(e.pointerId);
      if (st && Math.hypot(e.clientX - st[0], e.clientY - st[1]) > 12) {
        tap.moved = true;
        clearTimeout(longPressRef.current);
      }
      if (g && g.mode === "pinch" && touches.current.size >= 2) {
        var _ref4 = _toConsumableArray(touches.current.values()),
          a = _ref4[0],
          b = _ref4[1];
        var dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        var mid = clientToViewbox({
          clientX: (a[0] + b[0]) / 2,
          clientY: (a[1] + b[1]) / 2
        });
        var v = view.current;
        var nk = Math.max(0.6, Math.min(90, v.k * (dist / (g.dist || dist))));
        var f = nk / v.k;
        setView(mid[0] - (g.mid[0] - v.x) * f, mid[1] - (g.mid[1] - v.y) * f, nk);
        g.dist = dist;
        g.mid = mid;
        return;
      }
    }
    if (g && g.mode === "riverEnd") {
      var evs = e.nativeEvent && e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : null;
      var prev = null;
      (evs && evs.length ? evs : [e]).forEach(function (ev) {
        prev = World.endEditMove(World.mapToGrid(clientToMap(ev)));
      });
      var proj = App.basemap.proj;
      if (prev && proj && riverEditRef.current) {
        var m = prev.map(function (q) {
          return proj(q);
        });
        riverEditRef.current.setAttribute("d", "M" + m.map(function (q) {
          return q[0].toFixed(2) + "," + q[1].toFixed(2);
        }).join("L"));
        riverEditRef.current.style.display = "block";
        // the dragged handle follows the end of the new course
        var end = g.end === "source" ? m[0] : m[m.length - 1];
        var ends = svgRef.current.querySelectorAll('#river-ends [data-river-end="' + g.end + '"] circle');
        ends.forEach(function (el) {
          el.setAttribute("cx", end[0]);
          el.setAttribute("cy", end[1]);
        });
      }
      return;
    }
    // custom world: brush outline + live stroke
    if (window.World && App.ui.tool === "world" && World.active()) {
      var _clientToMap = clientToMap(e),
        _clientToMap2 = _slicedToArray(_clientToMap, 2),
        mx = _clientToMap2[0],
        my = _clientToMap2[1];
      if (brushRef.current) {
        var hideBrush = e.pointerType === "touch" || App.ui.worldBrush === "river";
        var r = World.brushRadius(e.pressure || 0.5, e.pointerType) * World.mapUnitsPerCell();
        brushRef.current.setAttribute("cx", mx);
        brushRef.current.setAttribute("cy", my);
        brushRef.current.setAttribute("r", r);
        brushRef.current.style.display = hideBrush ? "none" : "block";
      }
      if (g && g.mode === "world") {
        var _evs = e.nativeEvent && e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : null;
        var list = _evs && _evs.length ? _evs : [e];
        World.strokeMove(list.map(function (ev) {
          return {
            g: World.mapToGrid(clientToMap(ev)),
            pressure: ev.pressure,
            altitude: ev.altitudeAngle
          };
        }));
        var _prev = World.strokePreview();
        var _proj = App.basemap.proj;
        if (_prev && riverPrevRef.current && _proj) {
          riverPrevRef.current.setAttribute("d", "M" + _prev.map(function (q) {
            var m = _proj(q);
            return m[0].toFixed(2) + "," + m[1].toFixed(2);
          }).join("L"));
          riverPrevRef.current.style.display = "block";
        }
        return;
      }
    }
    // hover readout
    if (hoverRef.current) {
      var rid = e.target.dataset ? e.target.dataset.id : null;
      var hovRegId = e.target.dataset ? e.target.dataset.regionId : null;
      var txt = "";
      if (hovRegId) {
        var _r = RegionModel.resolve(hovRegId);
        if (_r) {
          var n = RegionModel.provinceCount(_r);
          txt = RegionModel.displayName(_r) + " · " + t("rtype." + _r.type) + " · " + n + " " + t("region.provincesShort");
        }
      } else if (rid && App.basemap.byId[rid]) {
        var _f2 = App.basemap.byId[rid];
        var er = App.project ? effRegion(App.project, rid) : null;
        var owner = er && er.owner && App.project.states[er.owner];
        var baseName = App.ui.lang === "ru" && _f2.nameRu ? _f2.nameRu : _f2.name;
        txt = (er && er.name ? er.name : baseName) + (owner ? " — " + owner.name : "") + (_f2.terrain ? " · " + _f2.terrain : "") + (_f2.histArea ? " · " + _f2.histArea : "");
      }
      hoverRef.current.textContent = txt;
    }
    // split / draw in progress: sample freehand points while the button is
    // held, otherwise show a rubber band from the last vertex to the cursor.
    // Both touch the DOM directly — an App.emit() per mousemove would re-render
    // every province.
    var gd = App.ui.geomDraw;
    if (gd && gd.pts.length && rubberRef.current) {
      var _clientToMap3 = clientToMap(e),
        _clientToMap4 = _slicedToArray(_clientToMap3, 2),
        _mx = _clientToMap4[0],
        _my = _clientToMap4[1];
      var last = gd.pts[gd.pts.length - 1];
      if (g && g.mode === "freehand") {
        var k = view.current.k;
        var step = Math.hypot(last[0] - _mx, last[1] - _my);
        if (step > 2 / k) {
          var hp = [_mx, _my];
          hp.hand = true; // freehand sample: smoothing may move it; clicked vertices are anchors
          gd.pts.push(hp);
          g.moved = true;
          g.len += step * k; // stroke length in screen px
          if (!g.raf) {
            g.raf = true;
            requestAnimationFrame(function () {
              g.raf = false;
              App.emit();
            });
          }
        }
        rubberRef.current.style.display = "none";
        return;
      }
      rubberRef.current.setAttribute("d", "M" + last[0].toFixed(2) + "," + last[1].toFixed(2) + "L" + _mx.toFixed(2) + "," + _my.toFixed(2));
      rubberRef.current.style.display = "block";
    } else if (rubberRef.current && rubberRef.current.style.display !== "none") {
      rubberRef.current.style.display = "none";
    }
    if (!g) return;
    if (g.mode === "objdown" || g.mode === "objdrag") {
      var _clientToViewbox7 = clientToViewbox(e),
        _clientToViewbox8 = _slicedToArray(_clientToViewbox7, 2),
        vx = _clientToViewbox8[0],
        vy = _clientToViewbox8[1];
      if (g.mode === "objdown" && Math.hypot(vx - g.vx, vy - g.vy) > 5) {
        if (g.finger) {
          // a finger dragging from a place pans the map
          gesture.current = {
            mode: "panning",
            vx: g.vx,
            vy: g.vy,
            lx: vx,
            ly: vy,
            panOk: true
          };
          svgRef.current.closest(".map-stage").classList.add("panning");
          return;
        }
        g.mode = "objdrag";
        Actions.beginStroke();
      }
      if (g.mode === "objdrag") {
        var _clientToMap5 = clientToMap(e),
          _clientToMap6 = _slicedToArray(_clientToMap5, 2),
          _mx2 = _clientToMap6[0],
          _my2 = _clientToMap6[1];
        Actions.setObject(g.id, {
          x: Math.round((g.orig[0] + _mx2 - g.start[0]) * 100) / 100,
          y: Math.round((g.orig[1] + _my2 - g.start[1]) * 100) / 100
        }, {
          undo: false
        });
      }
      return;
    }
    if (g.mode === "bdmove" || g.mode === "bdresize") {
      var _clientToMap7 = clientToMap(e),
        _clientToMap8 = _slicedToArray(_clientToMap7, 2),
        _mx3 = _clientToMap8[0],
        _my3 = _clientToMap8[1];
      var dx = _mx3 - g.start[0],
        dy = _my3 - g.start[1];
      if (g.mode === "bdmove") {
        Actions.setBackdrop({
          x: g.orig.x + dx,
          y: g.orig.y + dy
        });
      } else {
        var ar = g.orig.w / g.orig.h || 1;
        var w = Math.max(20, g.orig.w + dx);
        Actions.setBackdrop({
          w: w,
          h: w / ar
        });
      }
      return;
    }
    if (g.mode === "vertex") {
      var sess = App.ui.geomEdit;
      if (sess && sess.rings[g.ri]) {
        var _clientToMap9 = clientToMap(e),
          _clientToMap0 = _slicedToArray(_clientToMap9, 2),
          _mx4 = _clientToMap0[0],
          _my4 = _clientToMap0[1];
        var pt = window.GeomEdit ? GeomEdit.snap([_mx4, _my4], view.current.k) : [_mx4, _my4];
        // mutate in place: a shared vertex is the same object in the neighbour's ring
        var cur = sess.rings[g.ri].pts[g.vi];
        cur[0] = pt[0];
        cur[1] = pt[1];
        if (!g.raf) {
          g.raf = true;
          requestAnimationFrame(function () {
            g.raf = false;
            App.emit();
          });
        }
      }
      return;
    }
    if (g.mode === "label" && dragLabel.current) {
      var _clientToMap1 = clientToMap(e),
        _clientToMap10 = _slicedToArray(_clientToMap1, 2),
        _mx5 = _clientToMap10[0],
        _my5 = _clientToMap10[1];
      var dl = dragLabel.current;
      dl.moved = true;
      var _dx = _mx5 - dl.start[0],
        _dy = _my5 - dl.start[1];
      if (dl.kind === "custom") {
        Actions.setLabel(dl.id, {
          x: dl.orig[0] + _dx,
          y: dl.orig[1] + _dy
        }, {
          undo: false
        });
      } else if (dl.kind === "feat") {
        Actions.setFeatLabel(dl.id, {
          dx: dl.orig[0] + _dx,
          dy: dl.orig[1] + _dy
        }, {
          undo: false
        });
      } else {
        Actions.setState(dl.id, {
          labelOffset: [dl.orig[0] + _dx, dl.orig[1] + _dy]
        }, {
          undo: false
        });
      }
      return;
    }
    if (g.mode === "paint") {
      var _rid = e.target.dataset ? e.target.dataset.id : null;
      if (_rid && _rid !== g.last) {
        g.last = _rid;
        paintRegion(_rid, g.erase);
      }
      return;
    }
    if (g.mode === "marquee") {
      var _clientToViewbox9 = clientToViewbox(e),
        _clientToViewbox0 = _slicedToArray(_clientToViewbox9, 2),
        _vx = _clientToViewbox0[0],
        _vy = _clientToViewbox0[1];
      var _r2 = marqueeRef.current;
      if (_r2) {
        var _v = view.current;
        var x = Math.min(g.x0, _vx),
          y = Math.min(g.y0, _vy);
        _r2.setAttribute("x", (x - _v.x) / _v.k);
        _r2.setAttribute("y", (y - _v.y) / _v.k);
        _r2.setAttribute("width", Math.abs(_vx - g.x0) / _v.k);
        _r2.setAttribute("height", Math.abs(_vy - g.y0) / _v.k);
        _r2.style.display = "block";
        g.x1 = _vx;
        g.y1 = _vy;
      }
      return;
    }
    if (g.mode === "down" || g.mode === "panning") {
      var _clientToViewbox1 = clientToViewbox(e),
        _clientToViewbox10 = _slicedToArray(_clientToViewbox1, 2),
        _vx2 = _clientToViewbox10[0],
        _vy2 = _clientToViewbox10[1];
      var _dist = Math.hypot(_vx2 - g.vx, _vy2 - g.vy);
      if (g.mode === "down" && _dist > 4 && g.panOk) {
        g.mode = "panning";
        g.lx = _vx2;
        g.ly = _vy2;
        svgRef.current.closest(".map-stage").classList.add("panning");
      }
      if (g.mode === "panning") {
        var _g$lx, _g$ly;
        var _v2 = view.current;
        setView(_v2.x + (_vx2 - ((_g$lx = g.lx) !== null && _g$lx !== void 0 ? _g$lx : g.vx)), _v2.y + (_vy2 - ((_g$ly = g.ly) !== null && _g$ly !== void 0 ? _g$ly : g.vy)), _v2.k);
        g.lx = _vx2;
        g.ly = _vy2;
      }
    }
  }, [clientToViewbox, clientToMap, paintRegion, setView]);
  var onPointerUp = useCallback(function (e) {
    if (e.pointerType === "touch") {
      touches.current["delete"](e.pointerId);
      clearTimeout(longPressRef.current);
      var tap = tapRef.current;
      if (tap && touches.current.size === 0) {
        tapRef.current = null;
        // two-finger tap = undo, three-finger tap = redo (Procreate convention)
        if (!tap.moved && tap.max >= 2 && performance.now() - tap.t0 < 350) {
          gesture.current = null;
          if (tap.max === 2) Actions.undo();else Actions.redo();
          Actions.toast(t(tap.max === 2 ? "input.undo" : "input.redo"));
          return;
        }
      }
    }
    if (e.type === "pointerleave" && brushRef.current) brushRef.current.style.display = "none";
    var g = gesture.current;
    if (g && g.mode === "pinch") {
      if (touches.current.size < 2) gesture.current = null;
      return;
    }
    if (g && g.mode === "riverEnd") {
      if (e.type === "pointerleave" && svgRef.current && svgRef.current.hasPointerCapture && svgRef.current.hasPointerCapture(e.pointerId)) return;
      gesture.current = null;
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (riverEditRef.current) riverEditRef.current.style.display = "none";
      if (e.type === "pointerup") {
        World.endEditMove(World.mapToGrid(clientToMap(e)));
        World.endEditEnd();
      } else {
        World.endEditCancel();
      }
      App.emit();
      return;
    }
    if (g && g.mode === "world") {
      if (e.type === "pointerleave" && svgRef.current && svgRef.current.hasPointerCapture && svgRef.current.hasPointerCapture(e.pointerId)) return;
      gesture.current = null;
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (riverPrevRef.current) riverPrevRef.current.style.display = "none";
      if (e.type === "pointerup") World.strokeMove([{
        g: World.mapToGrid(clientToMap(e)),
        pressure: e.pressure,
        altitude: e.altitudeAngle,
        "final": true
      }]);
      World.strokeEnd();
      return;
    }
    gesture.current = null;
    svgRef.current && svgRef.current.closest(".map-stage").classList.remove("panning");
    if (!g) return;
    if (g.mode === "objdown") {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      Actions.ui({
        card: {
          kind: "object",
          id: g.id
        },
        selection: []
      });
      return;
    }
    if (g.mode === "objdrag") {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      Actions.endStroke();
      return;
    }
    if (g.mode === "bdmove" || g.mode === "bdresize") {
      Actions.endStroke();
      return;
    }
    if (g.mode === "vertex") {
      App.emit();
      return;
    }
    if (g.mode === "freehand") {
      if (e.type === "pointerleave" && svgRef.current && svgRef.current.hasPointerCapture && svgRef.current.hasPointerCapture(e.pointerId)) {
        gesture.current = g; // captured: the pointer only left an overlay, the stroke goes on
        return;
      }
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      var gd = App.ui.geomDraw;
      if (!g.moved || !gd || !gd.pts.length) return;
      var k = view.current.k;
      if (e.type !== "pointerleave") {
        // the release point ends the stroke
        var _clientToMap11 = clientToMap(e),
          _clientToMap12 = _slicedToArray(_clientToMap11, 2),
          mx = _clientToMap12[0],
          my = _clientToMap12[1];
        var prev = gd.pts[gd.pts.length - 1];
        var step = Math.hypot(prev[0] - mx, prev[1] - my);
        if (step > 0.5 / k) {
          var hp = [mx, my];
          hp.hand = true;
          gd.pts.push(hp);
          g.len += step * k;
        }
      }
      if (g.len < 6) {
        // hand jitter during a click: keep just the clicked vertex
        gd.pts.length = g.base;
        App.emit();
        return;
      }
      var first = gd.pts[0],
        last = gd.pts[gd.pts.length - 1];
      if (gd.tool === "split" && g.len >= 40 && window.GeomEdit) {
        // a stroke that clearly crosses one region (both ends outside it) cuts it right away
        var target = lineTarget(gd.pts);
        var strokeStart = gd.pts[Math.max(0, g.base - 1)];
        if (target && GeomEdit.regionAt(strokeStart[0], strokeStart[1]) !== target && GeomEdit.regionAt(last[0], last[1]) !== target) {
          finishGeomDraw();
          return;
        }
      }
      if (gd.tool === "draw" && g.len >= 40 && gd.pts.length >= 6 && Math.hypot(last[0] - first[0], last[1] - first[1]) < 10 / k) {
        gd.pts.pop(); // came back to the start: close the outline
        finishGeomDraw();
        return;
      }
      App.emit();
      return;
    }
    if (g.mode === "label") {
      var dl = dragLabel.current;
      dragLabel.current = null;
      Actions.endStroke();
      if (dl && !dl.moved && dl.kind === "custom") {
        Actions.ui({
          selLabel: dl.id,
          panel: "region",
          selection: []
        });
      } else if (dl && !dl.moved && dl.kind === "feat") {
        Actions.ui({
          selFeatLabel: dl.id,
          selLabel: null,
          panel: "region",
          selection: []
        });
      }
      return;
    }
    if (g.mode === "paint") {
      Actions.endStroke();
      return;
    }
    if (g.mode === "marquee") {
      var r = marqueeRef.current;
      if (r) r.style.display = "none";
      if (g.x1 === undefined) return;
      var v = view.current;
      var x0 = (Math.min(g.x0, g.x1) - v.x) / v.k,
        x1 = (Math.max(g.x0, g.x1) - v.x) / v.k;
      var y0 = (Math.min(g.y0, g.y1) - v.y) / v.k,
        y1 = (Math.max(g.y0, g.y1) - v.y) / v.k;
      if (App.ui.selectMode === "region") {
        var hit = layerRegionsRef.current.filter(function (r) {
          return r.c && r.c[0] >= x0 && r.c[0] <= x1 && r.c[1] >= y0 && r.c[1] <= y1;
        }).map(function (r) {
          return r.id;
        });
        Actions.selectRegions(hit, true);
      } else {
        var _hit = App.basemap.features.filter(function (f) {
          return f.c[0] >= x0 && f.c[0] <= x1 && f.c[1] >= y0 && f.c[1] <= y1;
        }).map(function (f) {
          return f.id;
        });
        Actions.select(_hit, true);
      }
      return;
    }
    if (g.mode === "down") {
      var tool = g.tool;
      if (tool === "label") {
        var _clientToMap13 = clientToMap(e),
          _clientToMap14 = _slicedToArray(_clientToMap13, 2),
          _mx6 = _clientToMap14[0],
          _my6 = _clientToMap14[1];
        var id = Actions.addLabel(_mx6, _my6);
        Actions.ui({
          selLabel: id,
          panel: "region",
          selection: [],
          tool: "select"
        });
        return;
      }
      if (tool === "fill" && g.rid) {
        fillByOwner(g.rid);
        return;
      }
      if ((tool === "select" || tool === "pan") && window.World && World.active()) {
        // a river under the tap (generous finger tolerance) opens its card
        var _k = view.current.k;
        var _clientToMap15 = clientToMap(e),
          _clientToMap16 = _slicedToArray(_clientToMap15, 2),
          _mx7 = _clientToMap16[0],
          _my7 = _clientToMap16[1];
        var tolData = (g.finger || e.pointerType === "touch" ? 16 : 8) / Math.max(0.0001, _k * World.mapUnitsPerCell() * (svgRef.current.getScreenCTM().a || 1));
        var rv = World.preview ? null : World.riverAt(World.mapToGrid([_mx7, _my7]), tolData);
        if (rv) {
          Actions.ui({
            card: {
              kind: "river",
              index: rv.index
            },
            selection: []
          });
          return;
        }
        if (App.ui.card) Actions.ui({
          card: null
        });
      }
      if (tool === "select" || tool === "pan") {
        if (App.ui.selectMode === "region") {
          var regId = g.regId || provRegionRef.current[g.rid];
          if (regId) {
            Actions.ui({
              selLabel: null,
              selFeatLabel: null
            });
            Actions.selectRegions([regId], g.shift);
          } else if (!g.shift) {
            Actions.clearRegionSelection();
          }
        } else if (g.rid) {
          Actions.ui({
            selLabel: null,
            selFeatLabel: null
          });
          Actions.select([g.rid], g.shift);
        } else if (!g.shift) {
          Actions.ui({
            selLabel: null,
            selFeatLabel: null
          });
          Actions.select([], false);
        }
      }
    }
  }, [clientToMap, fillByOwner, finishGeomDraw]);

  // ---------- borders (topo meshes) ----------
  var meshes = useMemo(function () {
    if (!ready || !bm.topo) return null;
    var p = App.project;
    var cof = bm.clusterOf;
    var fidOf = function fidOf(gid) {
      return cof ? cof[gid] || gid : gid;
    };
    var ownerOf = function ownerOf(gid) {
      var e = effRegion(p, fidOf(gid));
      return e ? e.owner || "" : "";
    };
    var unitOf = function unitOf(gid) {
      var fid = fidOf(gid);
      var r = p.regions[fid];
      return r && r.group ? "g:" + r.group : fid;
    };
    if (bm.raw) {
      // region-grid datasets: borders that did not snap perfectly are NOT shared
      // arcs, so mesh(a!==b) misses them and mesh(a===b) renders them as dark
      // dash fragments. Use only the owner mesh here; region borders & coast are
      // drawn from per-region outlines / landPath instead (continuous everywhere).
      // country borders from owner-region polygon unions (topology-independent,
      // survives split/merge/draw); region borders & coast come from outlines.
      var u = ownerUnionPath(bm.raw, bm.proj, p, unionCacheRef);
      return {
        state: u.d,
        segs: u.segs,
        coast: null,
        inner: null
      };
    }
    return {
      coast: Geo.coastMesh(),
      inner: Geo.innerMesh(unitOf),
      state: Geo.stateMesh(ownerOf),
      segs: null
    };
  }, [ready, bm.topo, App.terrVersion]);

  // one concatenated outline of ALL regions: a single path strokes every border
  // exactly once (no double-darkening, no missing unsnapped segments)
  var outlinePath = useMemo(function () {
    if (!ready || !bm.topo || !bm.raw) return null;
    return bm.features.map(function (f) {
      return f.d;
    }).join("");
  }, [ready, bm.count]);

  // ---------- status patterns (multi-colour stripes per party-set) ----------
  var patterns = useMemo(function () {
    if (!project) return [];
    var map = new Map(); // id -> { colors, kind }
    var consider = function consider(e) {
      if (!e || !e.owner) return;
      if (e.status === "disputed" || e.status === "occupied" || e.status === "assimilation") {
        var cols = stripeColors(e, states);
        if (cols) map.set(stripeId(cols, e.status), {
          colors: cols,
          kind: e.status
        });
      }
    };
    for (var rid in regions) consider(effOf(rid));
    for (var gid in project.groups || {}) consider(project.groups[gid]);
    return _toConsumableArray(map.entries()).map(function (_ref5) {
      var _ref6 = _slicedToArray(_ref5, 2),
        id = _ref6[0],
        v = _ref6[1];
      return {
        id: id,
        colors: v.colors,
        kind: v.kind
      };
    });
  }, [App.version]);
  var stateLabels = useMemo(function () {
    return ready ? computeStateLabels(project, bm) : [];
  }, [App.version, ready]);

  // named-autonomy overlays: union each autonomy's regions into one outline (same
  // topology-independent approach as the country border) + a label anchor. Works
  // on region-grid (bm.raw) maps only, matching the country-union-border constraint.
  var autonomyOverlays = useMemo(function () {
    if (!project || !bm.raw || typeof polygonClipping === "undefined") return [];
    var autos = project.autonomies || {};
    if (!Object.keys(autos).length) return [];
    var path = d3.geoPath(bm.proj);
    var groups = new Map(); // aid -> { ids, mps, best }
    bm.raw.features.forEach(function (f) {
      var e = window.effRegion(project, f.id);
      var aid = e && e.autonomyId;
      if (!aid || !autos[aid] || !f.geometry || e.status !== "autonomy") return;
      if (!groups.has(aid)) groups.set(aid, {
        ids: [],
        mps: [],
        best: null
      });
      var g = groups.get(aid);
      g.ids.push(f.id);
      g.mps.push(geomToMP(f.geometry));
      var bf = bm.byId[f.id];
      if (bf && (!g.best || bf.area > g.best.area)) g.best = bf;
    });
    var editKey = window.GeomEdit && GeomEdit.editsKey ? GeomEdit.editsKey(project) : "0";
    var cache = autonomyCacheRef.current || {};
    var fresh = {};
    var out = [];
    groups.forEach(function (g, aid) {
      var a = autos[aid];
      var sig = aid + "@" + editKey + "@" + g.ids.sort().join(",");
      var d = cache[sig];
      if (d == null) {
        var u = null;
        try {
          u = polygonClipping.union.apply(polygonClipping, g.mps);
        } catch (e) {
          u = null;
        }
        d = "";
        if (u && u.length) {
          try {
            d = path({
              type: "MultiPolygon",
              coordinates: u
            }) || "";
          } catch (e) {}
        }
      }
      fresh[sig] = d;
      if (d) out.push({
        id: aid,
        d: d,
        color: a.color || "#c8c8c8",
        name: a.name,
        best: g.best
      });
    });
    autonomyCacheRef.current = fresh;
    return out;
  }, [App.version, ready]);
  var flagPatterns = useMemo(function () {
    if (!project || !ready) return [];
    var flagMode = settings.mapMode === "flag";
    var op = settings.flagOpacity == null ? 1 : settings.flagOpacity;
    var out = [];
    project.stateOrder.forEach(function (sid) {
      var s = states[sid];
      if (!s || !s.flag || !(flagMode || s.flagFill)) return;
      var b = null;
      for (var rid in regions) {
        var e = effOf(rid);
        if (!e || e.owner !== sid) continue;
        var f = bm.byId[rid];
        if (!f) continue;
        b = b ? [[Math.min(b[0][0], f.b[0][0]), Math.min(b[0][1], f.b[0][1])], [Math.max(b[1][0], f.b[1][0]), Math.max(b[1][1], f.b[1][1])]] : [f.b[0].slice(), f.b[1].slice()];
      }
      if (!b) return;
      out.push({
        id: sid,
        flag: s.flag,
        color: s.color,
        op: op,
        x: b[0][0],
        y: b[0][1],
        w: Math.max(4, b[1][0] - b[0][0]),
        h: Math.max(4, b[1][1] - b[0][1])
      });
    });
    return out;
  }, [App.version, ready, settings.mapMode, settings.flagOpacity]);

  // anchors for merged-region (group) name labels
  var groupLabels = useMemo(function () {
    if (!ready || !project.groups) return {};
    var out = {};
    var _loop2 = function _loop2() {
      var g = project.groups[gid];
      var best = null,
        total = 0;
      (g.members || []).forEach(function (rid) {
        var f = bm.byId[rid];
        if (!f) return;
        total += f.area;
        if (!best || f.area > best.area) best = f;
      });
      if (best) out[best.id] = {
        name: g.name,
        total: total
      };
    };
    for (var gid in project.groups) {
      _loop2();
    }
    return out;
  }, [App.version, ready]);

  // ---------- minimap ----------
  useEffect(function () {
    if (!ready || !minimapRef.current) return;
    var cv = minimapRef.current;
    var ctx = cv.getContext("2d");
    cv.width = 336;
    cv.height = 176;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = settings.sea;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (window.World && World.active() && World.canvas && bm.proj) {
      var p0 = bm.proj([0, 0]),
        p1 = bm.proj([World.GW, World.GH]);
      var sx = cv.width / MAP_W,
        sy = cv.height / MAP_H;
      ctx.drawImage(World.canvas, p0[0] * sx, p0[1] * sy, (p1[0] - p0[0]) * sx, (p1[1] - p0[1]) * sy);
      applyView();
      return;
    }
    ctx.save();
    ctx.scale(cv.width / MAP_W, cv.height / MAP_H);
    ctx.fillStyle = ColorUtil.mixHex(settings.land, "#888888", 0.25);
    bm.features.forEach(function (f) {
      try {
        ctx.fill(new Path2D(f.d));
      } catch (e) {}
    });
    ctx.restore();
    applyView();
  }, [ready, bm.count, settings.sea, settings.land, applyView, worldOn && project.world.rev]);
  var onMinimapClick = useCallback(function (e) {
    var r = e.currentTarget.getBoundingClientRect();
    var mx = (e.clientX - r.left) / r.width * MAP_W;
    var my = (e.clientY - r.top) / r.height * MAP_H;
    var v = view.current;
    setView(MAP_W / 2 - v.k * mx, MAP_H / 2 - v.k * my, v.k);
  }, [setView]);

  // ---------- render ----------
  var strokeOnRegions = !meshes;
  var innerOn = settings.innerBorders !== false;
  var bw = settings.borderW;
  // region borders and country borders are SEPARATE layers with separate toggles:
  // showRegionBorders -> faint internal region mesh (legacy fallback: innerBorders);
  // showCountryBorders + countryBorderW -> owner-boundary mesh only.
  var regionBordersOn = settings.showRegionBorders !== undefined ? settings.showRegionBorders !== false : innerOn;
  var countryBordersOn = settings.showCountryBorders !== false;
  var cbw = settings.countryBorderW != null ? +settings.countryBorderW : bw * 1.8;
  var provinceBordersOn = strokeOnRegions && settings.showProvinceBorders !== false;
  var regionInteractive = regionMode && App.ui.tool === "select";
  var regionFillOn = regionMode || regionDisplay; // fill regions vs borders-only
  var regBorderColor = ColorUtil.darken(settings.borders, 0.2);

  // ---------- physical geography (atlas layers) ----------
  var phys = App.physical;
  var physReady = ready && phys && phys.status === "ready";
  var waterColor = useMemo(function () {
    return ColorUtil.mixHex(ColorUtil.darken(settings.sea, 0.10), "#2e6da3", 0.35);
  }, [settings.sea]);
  var RIVER_W = {
    major: 1.3,
    medium: 0.85,
    minor: 0.55
  };

  // ---------- per-region name labels (draggable / rotatable on every map) ----------
  var flOv = project && project.featLabels || {};
  var labelsGrabbable = App.ui.tool === "select" || App.ui.tool === "label";
  // obj = feature/region (needs .c/.b/.d), key = featLabels store key, name, baseSize, opacity
  var renderFeatLabel = function renderFeatLabel(obj, key, name, baseSize, opacity) {
    if (!name) return null;
    var ov = flOv[key];
    if (ov && ov.hidden) return null;
    var anc = featAnchor(obj);
    var x = anc[0] + (ov && ov.dx || 0);
    var y = anc[1] + (ov && ov.dy || 0);
    var size = ov && ov.size || baseSize;
    var angle = ov && ov.angle || 0;
    var sel = App.ui.selFeatLabel === key;
    return /*#__PURE__*/React.createElement("text", {
      key: "rl" + key,
      "data-flabel": key,
      x: x,
      y: y,
      textAnchor: "middle",
      transform: angle ? "rotate(".concat(angle, " ").concat(x, " ").concat(y, ")") : undefined,
      pointerEvents: labelsGrabbable ? "auto" : "none",
      fontSize: size,
      fill: settings.labelColor,
      opacity: opacity,
      stroke: settings.sea,
      strokeWidth: size * 0.05,
      paintOrder: "stroke",
      style: {
        fontFamily: settings.labelFont,
        userSelect: "none",
        cursor: labelsGrabbable ? "move" : "default",
        outline: sel ? "1px dashed #ff9f2e" : "none"
      }
    }, name);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "map-stage tool-" + App.ui.tool + (worldOn ? " world-mode" : "") + (worldOn && World.cutPreview ? " cut-previewing" : ""),
    "data-screen-label": "Map canvas",
    style: {
      background: settings.sea
    }
  }, worldOn && /*#__PURE__*/React.createElement("div", {
    className: "world-layer",
    ref: worldLayerRef
  }), bm.status === "loading" && /*#__PURE__*/React.createElement("div", {
    className: "map-loading"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "spinner",
    style: {
      margin: "0 auto"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "map-loading-text"
  }, t("loading.map")))), bm.status === "error" && /*#__PURE__*/React.createElement("div", {
    className: "map-loading"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "map-loading-text"
  }, t("loading.error")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    style: {
      marginTop: 12
    },
    onClick: function onClick() {
      return Geo.load(App.project);
    }
  }, t("retry")))), /*#__PURE__*/React.createElement("svg", {
    id: "map-svg",
    ref: svgRef,
    className: "mapsvg",
    viewBox: "0 0 ".concat(MAP_W, " ").concat(MAP_H),
    preserveAspectRatio: "xMidYMid meet",
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerLeave: onPointerUp,
    onPointerCancel: onPointerUp,
    onContextMenu: function onContextMenu(e) {
      return e.preventDefault();
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
    id: "lblShadow",
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%"
  }, /*#__PURE__*/React.createElement("feDropShadow", {
    dx: "0",
    dy: "0.7",
    stdDeviation: "0.9",
    floodColor: "#000000",
    floodOpacity: "0.55"
  })), patterns.map(function (p) {
    var sw = 5,
      W = p.colors.length * sw;
    // disputed -> clean diagonal colour stripes; occupied -> same bands
    // PLUS perpendicular dark hatch lines (a woven "occupied" texture);
    // assimilation -> opposite diagonal. Distinct textures at a glance.
    var angle = p.kind === "assimilation" ? -45 : 45;
    return /*#__PURE__*/React.createElement("pattern", {
      key: p.id,
      id: p.id,
      width: W,
      height: W,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(".concat(angle, ")")
    }, p.colors.map(function (c, i) {
      return /*#__PURE__*/React.createElement("rect", {
        key: i,
        x: i * sw,
        y: "0",
        width: sw,
        height: W,
        fill: c
      });
    }), p.kind === "occupied" && [0, 1].map(function (i) {
      return /*#__PURE__*/React.createElement("rect", {
        key: "h" + i,
        x: "0",
        y: i * (W / 2) + W / 4 - 0.9,
        width: W,
        height: "1.8",
        fill: "#000000",
        fillOpacity: "0.42"
      });
    }));
  }), flagPatterns.map(function (s) {
    return /*#__PURE__*/React.createElement("pattern", {
      key: "fp" + s.id,
      id: "flag-".concat(s.id),
      patternUnits: "userSpaceOnUse",
      x: s.x,
      y: s.y,
      width: s.w,
      height: s.h
    }, /*#__PURE__*/React.createElement("rect", {
      width: s.w,
      height: s.h,
      fill: s.color
    }), /*#__PURE__*/React.createElement("image", {
      href: s.flag,
      width: s.w,
      height: s.h,
      preserveAspectRatio: "xMidYMid slice",
      opacity: s.op
    }));
  }), ready && bm.clipLand && bm.landPath && /*#__PURE__*/React.createElement("clipPath", {
    id: "land-clip"
  }, /*#__PURE__*/React.createElement("path", {
    d: bm.landPath
  })), window.ObjectSymbols && /*#__PURE__*/React.createElement(ObjectSymbols, null), ready && bm.clips && bm.clips.map(function (sc) {
    return /*#__PURE__*/React.createElement("clipPath", {
      key: sc.id,
      id: sc.id
    }, /*#__PURE__*/React.createElement("path", {
      d: sc.d
    }));
  })), !worldOn && /*#__PURE__*/React.createElement("rect", {
    width: MAP_W,
    height: MAP_H,
    fill: settings.sea
  }), /*#__PURE__*/React.createElement("g", {
    id: "zoom-root",
    ref: zoomRef
  }, ready && bm.graticule && /*#__PURE__*/React.createElement("path", {
    d: bm.graticule,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.14",
    strokeWidth: "0.5",
    vectorEffect: "non-scaling-stroke"
  }), ready && bm.sphere && /*#__PURE__*/React.createElement("path", {
    d: bm.sphere,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.4",
    strokeWidth: "1",
    vectorEffect: "non-scaling-stroke"
  }), ready && !worldOn && bm.landPath && /*#__PURE__*/React.createElement("path", {
    d: bm.landPath,
    fill: settings.land,
    stroke: settings.land,
    strokeWidth: "1.1",
    vectorEffect: "non-scaling-stroke",
    pointerEvents: "none"
  }), /*#__PURE__*/React.createElement("g", {
    id: "regions",
    clipPath: ready && bm.clipLand && bm.landPath ? "url(#land-clip)" : undefined,
    pointerEvents: regionInteractive ? "none" : "auto",
    opacity: worldOn ? settings.worldFillOpacity != null ? settings.worldFillOpacity : 0.62 : undefined
  }, ready && bm.features.map(function (f) {
    var effR = effOf(f.id);
    // painted worlds: unowned land stays see-through so the terrain shows
    var fillV = worldOn && displayMode === "country" && !(effR && (effR.owner || effR.color)) ? "rgba(0,0,0,0)" : provinceFill(displayMode, effR, states, settings, f, project);
    // with topo meshes the borders are drawn separately; stroke each
    // fill with ITS OWN colour (screen-constant ~1px) so anti-aliasing
    // seams and hairline gaps between neighbours never show the sea
    var gapFill = !strokeOnRegions && typeof fillV === "string" && fillV[0] === "#";
    return /*#__PURE__*/React.createElement(Region, {
      key: f.id,
      id: f.id,
      d: f.d,
      fill: fillV,
      stroke: gapFill ? fillV : provinceBordersOn ? settings.borders : "none",
      sw: gapFill ? 1.1 : strokeOnRegions ? bw * 0.7 : 0,
      sel: !regionMode && selSet.has(f.id),
      clip: f.clipId ? "url(#" + f.clipId + ")" : undefined
    });
  })), ready && project && project.backdrop && project.backdrop.visible !== false && project.backdropHref && function () {
    var bd = project.backdrop;
    var moving = App.ui.moveBackdrop;
    var k = view.current.k;
    return /*#__PURE__*/React.createElement("g", {
      "data-export-skip": "1"
    }, /*#__PURE__*/React.createElement("image", {
      "data-backdrop": moving ? "1" : undefined,
      pointerEvents: moving ? "auto" : "none",
      href: project.backdropHref,
      x: bd.x,
      y: bd.y,
      width: bd.w,
      height: bd.h,
      opacity: bd.opacity == null ? 0.55 : bd.opacity,
      preserveAspectRatio: "none",
      style: moving ? {
        cursor: "move"
      } : undefined
    }), moving && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: bd.x,
      y: bd.y,
      width: bd.w,
      height: bd.h,
      fill: "none",
      stroke: "#ff9f2e",
      strokeWidth: 1.2 / k,
      strokeDasharray: "".concat(5 / k, " ").concat(4 / k),
      pointerEvents: "none"
    }), /*#__PURE__*/React.createElement("rect", {
      "data-bdresize": "1",
      x: bd.x + bd.w - 6 / k,
      y: bd.y + bd.h - 6 / k,
      width: 12 / k,
      height: 12 / k,
      fill: "#ff9f2e",
      stroke: "#fff",
      strokeWidth: 1 / k,
      style: {
        cursor: "nwse-resize"
      }
    })));
  }(), ready && bm.staticBorders && /*#__PURE__*/React.createElement("g", {
    className: "borders",
    pointerEvents: "none"
  }, settings.innerBorders !== false && bm.staticBorders.prov && /*#__PURE__*/React.createElement("path", {
    d: bm.staticBorders.prov,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.5",
    strokeWidth: bw * 0.6
  }), bm.staticBorders.stateMesh && settings.innerBorders !== false && /*#__PURE__*/React.createElement("path", {
    d: bm.staticBorders.stateMesh,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.75",
    strokeWidth: bw * 1.1
  }), bm.staticBorders.coast && /*#__PURE__*/React.createElement("path", {
    d: bm.staticBorders.coast,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.9",
    strokeWidth: bw * 0.85
  })), meshes && /*#__PURE__*/React.createElement("g", {
    className: "borders",
    pointerEvents: "none"
  }, regionBordersOn && (outlinePath || meshes.inner) && /*#__PURE__*/React.createElement("path", {
    className: "border-regions",
    d: outlinePath || meshes.inner,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: outlinePath ? 0.4 : 0.45,
    strokeWidth: bw * 0.55
  }), settings.showCoastlines !== false && (bm.raw ? bm.coastPath : meshes.coast) && /*#__PURE__*/React.createElement("path", {
    className: "border-coast",
    d: bm.raw ? bm.coastPath : meshes.coast,
    fill: "none",
    stroke: settings.borders,
    strokeOpacity: "0.85",
    strokeWidth: bw * 0.75
  }), countryBordersOn && meshes.state && /*#__PURE__*/React.createElement("path", {
    className: "border-countries",
    d: meshes.state,
    fill: "none",
    stroke: ColorUtil.darken(settings.borders, 0.4),
    strokeWidth: cbw,
    strokeLinejoin: "round"
  }), settings.showAutonomies !== false && autonomyOverlays.map(function (a) {
    return /*#__PURE__*/React.createElement("path", {
      key: "au" + a.id,
      className: "border-autonomy",
      d: a.d,
      fill: "none",
      stroke: ColorUtil.darken(a.color, 0.35),
      strokeWidth: cbw * 0.9,
      strokeDasharray: "".concat((cbw * 2.2).toFixed(1), " ").concat((cbw * 1.5).toFixed(1)),
      strokeOpacity: "0.95",
      strokeLinejoin: "round"
    });
  })), ready && worldOn && settings.showRivers !== false && function () {
    var list = World.displayRivers();
    if (!list.length) return null;
    var sel = App.ui.card && App.ui.card.kind === "river" ? App.ui.card.index : -1;
    return /*#__PURE__*/React.createElement("g", {
      id: "world-rivers",
      pointerEvents: "none"
    }, list.map(function (rv) {
      return /*#__PURE__*/React.createElement("path", {
        key: "wr" + rv.index,
        d: World.riverPath(rv, bm.proj),
        fill: "#3f74a8",
        stroke: "#3f74a8",
        strokeWidth: 0.7,
        strokeLinejoin: "round",
        vectorEffect: "non-scaling-stroke"
      });
    }), list.filter(function (rv) {
      return rv.index === sel;
    }).map(function (rv) {
      return /*#__PURE__*/React.createElement("path", {
        key: "ws" + rv.index,
        "data-export-skip": "1",
        d: World.riverPath(rv, bm.proj),
        fill: "#1f5fa8",
        stroke: "#ffcf5a",
        strokeWidth: 2,
        strokeLinejoin: "round",
        vectorEffect: "non-scaling-stroke"
      });
    }));
  }(), ready && worldOn && World.cutPreview && function () {
    var d = World.cutPreviewPath(bm.proj);
    return /*#__PURE__*/React.createElement("g", {
      id: "cut-preview",
      "data-export-skip": "1",
      pointerEvents: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#ffffff",
      strokeOpacity: "0.85",
      strokeWidth: "3.2",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#b3261e",
      strokeWidth: "1.4",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }));
  }(), physReady && phys.relief.length > 0 && /*#__PURE__*/React.createElement("g", {
    id: "phys-relief",
    pointerEvents: "none"
  }, phys.relief.map(function (f) {
    var on = f.typ === "desert" ? settings.showDesert !== false : f.typ === "forest" ? settings.showForest !== false : settings.showMountains !== false;
    if (!on) return null;
    var col = f.typ === "desert" ? "#c9a96a" : f.typ === "forest" ? "#3f7d3a" : "#5d4f40";
    return /*#__PURE__*/React.createElement("path", {
      key: "rel" + f.id,
      d: f.d,
      fill: col,
      fillOpacity: f.typ === "desert" ? 0.10 : f.typ === "forest" ? 0.12 : 0.13,
      stroke: f.typ === "mountain_range" ? "#5d4f40" : "none",
      strokeOpacity: "0.18",
      strokeWidth: "0.5",
      vectorEffect: "non-scaling-stroke"
    });
  })), ready && bm.physical && /*#__PURE__*/React.createElement("g", {
    id: "physical",
    pointerEvents: "none"
  }, settings.showMountains !== false && bm.physical.mountains && /*#__PURE__*/React.createElement("path", {
    d: bm.physical.mountains,
    fill: "#8a7a5a",
    fillOpacity: "0.16",
    stroke: "#7a6a4a",
    strokeOpacity: "0.25",
    strokeWidth: "0.4",
    vectorEffect: "non-scaling-stroke"
  }), settings.showLakes !== false && bm.physical.lakes && /*#__PURE__*/React.createElement("path", {
    d: bm.physical.lakes,
    fill: settings.sea,
    stroke: ColorUtil.darken(settings.sea, 0.18),
    strokeWidth: "0.5",
    vectorEffect: "non-scaling-stroke"
  }), settings.showRivers !== false && bm.physical.rivers && /*#__PURE__*/React.createElement("path", {
    d: bm.physical.rivers,
    fill: "none",
    stroke: ColorUtil.darken(settings.sea, 0.22),
    strokeWidth: "0.8",
    strokeOpacity: "0.85",
    vectorEffect: "non-scaling-stroke"
  })), ready && showRegionLayer && /*#__PURE__*/React.createElement("g", {
    id: "map-regions"
  }, layerRegions.map(function (r) {
    return /*#__PURE__*/React.createElement(RegionShape, {
      key: r.id,
      id: r.id,
      d: r.d,
      fill: regionFillOn ? RegionModel.regionColor(r) : "none",
      fillOpacity: regionFillOn ? regionMode ? 0.55 : 0.72 : 0,
      stroke: regBorderColor,
      sw: bw * 1.3,
      sel: regSelSet.has(r.id),
      interactive: regionInteractive
    });
  })), physReady && /*#__PURE__*/React.createElement("g", {
    id: "phys-water",
    pointerEvents: "none"
  }, settings.showLakes !== false && phys.lakes.map(function (f) {
    return /*#__PURE__*/React.createElement("path", {
      key: "lk" + f.id,
      d: f.d,
      fill: waterColor,
      fillOpacity: "0.9",
      stroke: ColorUtil.darken(waterColor, 0.18),
      strokeWidth: "0.4",
      vectorEffect: "non-scaling-stroke"
    });
  }), settings.showRivers !== false && phys.rivers.map(function (f) {
    return (
      /*#__PURE__*/
      // game rivers (rivers.bmp) are water RIBBONS -> fill; NE rivers are
      // centrelines -> stroke. A thin non-scaling stroke keeps ribbons
      // visible when zoomed out.
      React.createElement("path", {
        key: "rv" + f.id,
        d: f.d,
        fill: f.filled ? waterColor : "none",
        fillOpacity: f.filled ? 0.9 : undefined,
        stroke: waterColor,
        strokeOpacity: f.importance === "minor" ? 0.6 : 0.85,
        strokeWidth: f.filled ? 0.5 : RIVER_W[f.importance] || 0.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        vectorEffect: "non-scaling-stroke"
      })
    );
  })), ready && window.RoadsLayer && /*#__PURE__*/React.createElement(RoadsLayer, null), ready && window.ObjectsLayer && /*#__PURE__*/React.createElement(ObjectsLayer, {
    k: view.current.k,
    grabbable: App.ui.tool === "select" || App.ui.tool === "place"
  }), /*#__PURE__*/React.createElement("g", {
    id: "overlay"
  }, ready && settings.showLabels && bm.features.map(function (f) {
    var r = regions[f.id];
    if (r && r.group) {
      var gl = groupLabels[f.id];
      if (!gl) return null;
      return renderFeatLabel(f, f.id, gl.name, Math.min(14, Math.max(5, Math.sqrt(gl.total) * 0.1)), 0.75);
    }
    if (f.area <= 260) return null;
    var nm = r && r.name || (App.ui.lang === "ru" && f.nameRu ? f.nameRu : f.name);
    return renderFeatLabel(f, f.id, nm, Math.min(11, Math.max(4, Math.sqrt(f.area) * 0.12)), 0.65);
  }), physReady && settings.showSeaLabels !== false && phys.seas.map(function (f) {
    return f.importance !== "minor" && f.c ? /*#__PURE__*/React.createElement("text", {
      key: "sea" + f.id,
      x: f.c[0],
      y: f.c[1],
      textAnchor: "middle",
      pointerEvents: "none",
      fontSize: f.importance === "major" ? 11 : 7,
      fontStyle: "italic",
      fill: ColorUtil.darken(settings.sea, 0.38),
      opacity: "0.85",
      style: {
        fontFamily: "Georgia, 'Times New Roman', serif",
        userSelect: "none",
        letterSpacing: "0.5px"
      }
    }, App.ui.lang === "ru" && f.nameRu ? f.nameRu : f.name) : null;
  }), physReady && settings.showMountains !== false && phys.relief.map(function (f) {
    return f.importance === "major" && f.c && f.name ? /*#__PURE__*/React.createElement("text", {
      key: "rln" + f.id,
      x: f.c[0],
      y: f.c[1],
      textAnchor: "middle",
      pointerEvents: "none",
      fontSize: "6.5",
      fill: "#5d4f40",
      opacity: "0.75",
      style: {
        fontFamily: "Georgia, 'Times New Roman', serif",
        userSelect: "none",
        letterSpacing: "1.5px",
        textTransform: "uppercase"
      }
    }, App.ui.lang === "ru" && f.nameRu ? f.nameRu : f.name) : null;
  }), ready && showRegionLayer && regionFillOn && layerRegions.map(function (r) {
    return r.area > 240 && r.c ? renderFeatLabel(r, "L:" + r.id, RegionModel.displayName(r), Math.min(15, Math.max(5, Math.sqrt(r.area) * 0.11)), 0.9) : null;
  }), ready && settings.showAutonomies !== false && autonomyOverlays.map(function (a) {
    if (!a.best) return null;
    var anc = featAnchor(a.best);
    return /*#__PURE__*/React.createElement("text", {
      key: "aul" + a.id,
      x: anc[0],
      y: anc[1],
      textAnchor: "middle",
      pointerEvents: "none",
      fontSize: "7.5",
      fontStyle: "italic",
      fill: ColorUtil.darken(a.color, 0.5),
      stroke: settings.sea,
      strokeWidth: "0.5",
      paintOrder: "stroke",
      style: {
        fontFamily: settings.labelFont,
        userSelect: "none",
        letterSpacing: "0.4px"
      }
    }, a.name);
  }), ready && settings.showCapitals !== false && project.stateOrder.map(function (sid) {
    var s = project.states[sid];
    if (!s || !s.capitalRegion) return null;
    var cf = bm.byId[s.capitalRegion];
    if (!cf) return null;
    var anc = featAnchor(cf);
    var fillV = regionFill(effOf(s.capitalRegion), states, settings, cf);
    var star = contrastBW(typeof fillV === "string" && fillV[0] === "#" ? fillV : s.color);
    var sz = Math.min(15, Math.max(8, Math.sqrt(cf.area || 400) * 0.13));
    return /*#__PURE__*/React.createElement("text", {
      key: "cap" + sid,
      x: anc[0],
      y: anc[1] + sz * 0.35,
      textAnchor: "middle",
      pointerEvents: "none",
      fontSize: sz,
      fill: star,
      stroke: star === "#ffffff" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.65)",
      strokeWidth: sz * 0.05,
      paintOrder: "stroke",
      style: {
        userSelect: "none"
      }
    }, "\u2605");
  }), ready && settings.showStateLabels && stateLabels.map(function (l) {
    var flagW = l.size * 1.4;
    return /*#__PURE__*/React.createElement("g", {
      key: "sl" + l.sid,
      transform: "rotate(".concat(l.angle || 0, " ").concat(l.x, " ").concat(l.y, ")")
    }, settings.showFlags && l.flag && /*#__PURE__*/React.createElement("image", {
      "data-slabel": l.sid,
      href: l.flag,
      x: l.x - flagW / 2,
      y: l.y - l.size * 1.9,
      width: flagW,
      height: flagW * 0.62,
      preserveAspectRatio: "xMidYMid slice",
      style: {
        cursor: "move"
      }
    }), /*#__PURE__*/React.createElement("text", {
      "data-slabel": l.sid,
      className: l.atlas ? "country-label" : "country-label plain",
      x: l.x,
      y: l.y,
      textAnchor: "middle",
      fontSize: l.size,
      strokeWidth: Math.max(0.5, l.size * 0.13),
      style: {
        fill: settings.labelColor,
        stroke: contrastBW(settings.labelColor),
        letterSpacing: (l.spacing || 0) + "px",
        cursor: "move"
      }
    }, l.name));
  }), ready && project.labels.map(function (l) {
    return /*#__PURE__*/React.createElement("text", {
      key: l.id,
      "data-label": l.id,
      x: l.x,
      y: l.y,
      textAnchor: "middle",
      fontSize: l.size,
      fill: l.color || settings.labelColor,
      fontWeight: l.bold ? 700 : 400,
      stroke: settings.sea,
      strokeWidth: l.size * 0.05,
      paintOrder: "stroke",
      style: {
        cursor: "move",
        fontFamily: settings.labelFont,
        userSelect: "none",
        outline: App.ui.selLabel === l.id ? "1px dashed #ff9f2e" : "none"
      }
    }, l.text);
  })), App.ui.geomDraw && App.ui.geomDraw.pts.length > 0 && function () {
    var k = view.current.k;
    var pts = App.ui.geomDraw.pts;
    var dstr = "M" + pts.map(function (p) {
      return p[0].toFixed(2) + "," + p[1].toFixed(2);
    }).join("L") + (App.ui.geomDraw.tool === "draw" && pts.length > 2 ? "Z" : "");
    return /*#__PURE__*/React.createElement("g", {
      "data-export-skip": "1",
      pointerEvents: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: dstr,
      fill: App.ui.geomDraw.tool === "draw" ? "rgba(255,159,46,0.14)" : "none",
      stroke: "#ff9f2e",
      strokeWidth: 1.6 / k,
      strokeDasharray: "".concat(4 / k, " ").concat(3 / k)
    }), pts.map(function (p, i) {
      return p.hand && i !== pts.length - 1 ? null : /*#__PURE__*/React.createElement("circle", {
        key: i,
        cx: p[0],
        cy: p[1],
        r: 3 / k,
        fill: "#ff9f2e",
        stroke: "#fff",
        strokeWidth: 0.8 / k
      });
    }));
  }(), App.ui.geomEdit && function () {
    var k = view.current.k;
    return /*#__PURE__*/React.createElement("g", {
      "data-export-skip": "1"
    }, (App.ui.geomEdit.neighbors || []).map(function (nb) {
      return nb.rings.map(function (r, ri) {
        return /*#__PURE__*/React.createElement("path", {
          key: nb.id + ":" + ri,
          d: "M" + r.pts.map(function (p) {
            return p[0].toFixed(2) + "," + p[1].toFixed(2);
          }).join("L") + "Z",
          fill: "none",
          stroke: "#3d7bc4",
          strokeOpacity: "0.55",
          strokeWidth: 1 / k,
          strokeDasharray: "".concat(3 / k, " ").concat(2 / k),
          pointerEvents: "none"
        });
      });
    }), App.ui.geomEdit.rings.map(function (r, ri) {
      var dstr = "M" + r.pts.map(function (p) {
        return p[0].toFixed(2) + "," + p[1].toFixed(2);
      }).join("L") + "Z";
      return /*#__PURE__*/React.createElement("g", {
        key: ri
      }, /*#__PURE__*/React.createElement("path", {
        d: dstr,
        fill: "none",
        stroke: "#ff9f2e",
        strokeWidth: 1.4 / k,
        pointerEvents: "none"
      }), r.pts.map(function (p, vi) {
        var q = r.pts[(vi + 1) % r.pts.length];
        return /*#__PURE__*/React.createElement(React.Fragment, {
          key: vi
        }, /*#__PURE__*/React.createElement("rect", {
          "data-midpoint": ri + ":" + vi,
          x: (p[0] + q[0]) / 2 - 2.2 / k,
          y: (p[1] + q[1]) / 2 - 2.2 / k,
          width: 4.4 / k,
          height: 4.4 / k,
          fill: "#ffffff",
          stroke: "#ff9f2e",
          strokeWidth: 0.9 / k,
          style: {
            cursor: "copy"
          }
        }), /*#__PURE__*/React.createElement("circle", {
          "data-vertex": ri + ":" + vi,
          cx: p[0],
          cy: p[1],
          r: 4 / k,
          fill: "#ff9f2e",
          stroke: GeomEdit.isShared(App.ui.geomEdit, p) ? "#3d7bc4" : "#ffffff",
          strokeWidth: GeomEdit.isShared(App.ui.geomEdit, p) ? 1.6 / k : 1 / k,
          style: {
            cursor: "grab"
          }
        }));
      }));
    }));
  }(), worldOn && /*#__PURE__*/React.createElement("g", {
    "data-export-skip": "1",
    pointerEvents: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    ref: brushRef,
    style: {
      display: "none"
    },
    fill: "none",
    stroke: "#ffffff",
    strokeOpacity: "0.9",
    strokeWidth: "1.2",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("path", {
    ref: riverPrevRef,
    style: {
      display: "none"
    },
    fill: "none",
    stroke: "#2f6fb0",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("path", {
    ref: riverEditRef,
    style: {
      display: "none"
    },
    fill: "none",
    stroke: "#ff9f2e",
    strokeWidth: "3",
    strokeDasharray: "7 4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  })), ready && worldOn && App.ui.card && App.ui.card.kind === "river" && !World.preview && function () {
    var rv = (project.world.rivers || [])[App.ui.card.index];
    if (!rv || !rv.pts || rv.pts.length < 2) return null;
    var ctm = svgRef.current && svgRef.current.getScreenCTM();
    var per = view.current.k * (ctm && ctm.a || 1);
    var handle = function handle(end, q, color) {
      var m = bm.proj(q);
      return /*#__PURE__*/React.createElement("g", {
        key: end,
        className: "river-end",
        "data-river-end": end
      }, /*#__PURE__*/React.createElement("circle", {
        "data-rpx": "24",
        cx: m[0],
        cy: m[1],
        r: 24 / per,
        fill: "#000000",
        fillOpacity: "0.001"
      }), /*#__PURE__*/React.createElement("circle", {
        "data-rpx": "9",
        cx: m[0],
        cy: m[1],
        r: 9 / per,
        fill: color,
        stroke: "#ffffff",
        strokeWidth: "2.5",
        vectorEffect: "non-scaling-stroke"
      }));
    };
    return /*#__PURE__*/React.createElement("g", {
      id: "river-ends",
      "data-export-skip": "1"
    }, handle("source", rv.pts[0], "#3a9a5b"), handle("mouth", rv.pts[rv.pts.length - 1], "#1f5fa8"));
  }(), /*#__PURE__*/React.createElement("rect", {
    ref: marqueeRef,
    "data-export-skip": "1",
    style: {
      display: "none"
    },
    fill: "rgba(61,123,196,0.15)",
    stroke: "#3d7bc4",
    strokeWidth: "1",
    vectorEffect: "non-scaling-stroke"
  }), /*#__PURE__*/React.createElement("path", {
    ref: rubberRef,
    "data-export-skip": "1",
    style: {
      display: "none"
    },
    fill: "none",
    stroke: "#ff9f2e",
    strokeOpacity: "0.7",
    strokeWidth: "1.2",
    strokeDasharray: "4 3",
    vectorEffect: "non-scaling-stroke",
    pointerEvents: "none"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    ref: hoverRef,
    style: {
      minWidth: 80,
      textAlign: "center"
    }
  }), /*#__PURE__*/React.createElement("span", null, bm.count ? /*#__PURE__*/React.createElement("b", null, bm.count) : "…", " ", function () {
    var ty = (BASEMAPS[project && project.basemapId] || {}).type;
    return t(ty === "state-grid" ? "stat.states" : ty === "region-grid" ? "stat.regions" : "stat.provinces");
  }()), App.regionData.status === "ready" && App.regionData.regions.length > 0 && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, App.regionData.regions.length), " ", t("stat.regionsShort")), RegionModel.supportsRegions() && /*#__PURE__*/React.createElement("span", null, regionMode ? t("mode.region") : t("mode.province")), /*#__PURE__*/React.createElement("span", {
    ref: zoomTextRef
  }, "100%")), !App.ui.rightOpen && ready && (App.ui.selection.length > 0 || App.ui.activeState) && function () {
    var rid = App.ui.selection[0];
    var f = rid && bm.byId[rid];
    var er = rid ? effRegion(project, rid) : null;
    var st = App.ui.activeState && states[App.ui.activeState];
    var label = f ? (er && er.name || (App.ui.lang === "ru" && f.nameRu ? f.nameRu : f.name)) + (App.ui.selection.length > 1 ? " +" + (App.ui.selection.length - 1) : "") : st ? st.name : "";
    return /*#__PURE__*/React.createElement("button", {
      className: "sel-pill",
      "data-export-skip": "1",
      onClick: function onClick() {
        return Actions.setPref({
          rightOpen: true
        });
      }
    }, st && !f && /*#__PURE__*/React.createElement("span", {
      className: "state-swatch",
      style: {
        background: st.color
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "sel-pill-name"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "sel-pill-open"
    }, t("input.properties"), " \u203A"));
  }(), window.QuickMenu && /*#__PURE__*/React.createElement(QuickMenu, null), worldOn && App.ui.tool === "world" && window.WorldSizeRail && /*#__PURE__*/React.createElement(WorldSizeRail, null), /*#__PURE__*/React.createElement("div", {
    className: "zoom-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: "+",
    onClick: function onClick() {
      return MapAPI.zoomBy(1.4);
    }
  }, "+"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: "\u2212",
    onClick: function onClick() {
      return MapAPI.zoomBy(1 / 1.4);
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("zoom.fit"),
    onClick: function onClick() {
      return MapAPI.fit();
    }
  }, "\u2922")), App.ui.geomEdit && /*#__PURE__*/React.createElement("div", {
    className: "geom-bar",
    "data-export-skip": "1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t("edit.editingBorders"), (App.ui.geomEdit.neighbors || []).length ? " · " + t("edit.sharedHint").replace("{n}", App.ui.geomEdit.neighbors.length) : ""), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return GeomEdit.smoothEdit();
    }
  }, t("edit.smooth")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return GeomEdit.simplifyEdit();
    }
  }, t("edit.simplify")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return GeomEdit.saveEdit();
    }
  }, t("edit.save")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return GeomEdit.cancelEdit();
    }
  }, t("edit.cancel"))), !App.ui.geomEdit && App.ui.geomDraw && /*#__PURE__*/React.createElement("div", {
    className: "geom-bar",
    "data-export-skip": "1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t(App.ui.geomDraw.tool === "split" ? "edit.splitHint" : "edit.drawHint")), /*#__PURE__*/React.createElement("label", {
    className: "check-row",
    style: {
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: settings.cutSmooth !== false,
    onChange: function onChange(e) {
      return Actions.setSettings({
        cutSmooth: e.target.checked
      }, {
        undo: false
      });
    }
  }), t("edit.smoothLine")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: App.ui.geomDraw.pts.length < (App.ui.geomDraw.tool === "split" ? 2 : 3),
    onClick: finishGeomDraw
  }, t("edit.finish")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      App.ui.geomDraw = null;
      Actions.ui({
        tool: "select"
      });
    }
  }, t("edit.cancel"))), worldOn && App.ui.tool === "world" && window.WorldPalette && /*#__PURE__*/React.createElement(WorldPalette, null), worldOn && (World.preview || World.geoBusy) && window.GeoBar && /*#__PURE__*/React.createElement(GeoBar, null), worldOn && (World.cutPreview || World.generating) && window.CutBar && /*#__PURE__*/React.createElement(CutBar, null), App.ui.tool === "place" && window.ObjectPalette && ready && /*#__PURE__*/React.createElement(ObjectPalette, null), window.RoadModeBar && /*#__PURE__*/React.createElement(RoadModeBar, null), window.WorldCard && /*#__PURE__*/React.createElement(WorldCard, null), /*#__PURE__*/React.createElement("div", {
    className: "minimap",
    onPointerDown: onMinimapClick
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: minimapRef
  }), /*#__PURE__*/React.createElement("div", {
    className: "minimap-vp",
    ref: minimapVpRef
  })));
}
Object.assign(window, {
  MapView: MapView,
  useStore: useStore,
  regionFill: regionFill,
  computeStateLabels: computeStateLabels
});
//# sourceMappingURL=map.js.map
