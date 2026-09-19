"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// AtlasForge — places & roads UI: SVG symbols, map layer, placing palette, place card
var OBJ_ICON = {
  village: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3 9 L8 4.5 L13 9 V14 H3 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 14 V11 H9.5 V14"
  })),
  town: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1.5 10 L5 7 L8.5 10 V14.5 H1.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 8.5 L11 5 L14.5 8.5 V14.5 H7.5 Z"
  })),
  city: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 V7 H4 V5.5 H6 V7 H7 V4 H9 V7 H10 V5.5 H12 V7 H14 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 14.5 V11.5 H9 V14.5"
  })),
  capital: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 V7 H4 V5.5 H6 V7 H7 V4 H9 V7 H10 V5.5 H12 V7 H14 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 0.8 L9 2.8 L11.2 3 L9.5 4.3 L10 6.4 L8 5.3 L6 6.4 L6.5 4.3 L4.8 3 L7 2.8 Z",
    className: "obj-accent"
  })),
  port: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "3.5",
    r: "1.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 5 V14 M4.5 7.5 H11.5 M2.5 10.5 C3 13.5 6 14.5 8 14.5 C10 14.5 13 13.5 13.5 10.5"
  })),
  fortress: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 V5 H4 V7 H6 V5 H10 V7 H12 V5 H14 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 14.5 V10.5 C6.5 9 9.5 9 9.5 10.5 V14.5"
  })),
  castle: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M4 14.5 V4 H5.5 V5.5 H7.2 V4 H8.8 V5.5 H10.5 V4 H12 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 14.5 V11 C7 9.8 9 9.8 9 11 V14.5"
  })),
  tower: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M5.5 14.5 L6 5 H10 L10.5 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 5 V2.5 H6.5 V3.5 H7.5 V2.5 H8.5 V3.5 H9.5 V2.5 H11 V5 Z"
  })),
  ruins: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 14.5 V8 L4 6.5 V14.5 M6.5 14.5 V5 H8 V9 L9 10 V14.5 M11.5 14.5 V9.5 L13 11 V14.5 M1.5 14.5 H14.5"
  })),
  temple: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 6 L8 2 L14 6 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.5 7.5 V13 M6.5 7.5 V13 M9.5 7.5 V13 M12.5 7.5 V13 M2 14.5 H14"
  })),
  monastery: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3 14.5 V8 L8 5 L13 8 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 1 V5 M6.5 2.5 H9.5"
  })),
  mine: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3 13.5 L12 4.5 M4 4.5 L13 13.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 2.5 C12 3 13.5 4.5 14 6.5 M6 2.5 C4 3 2.5 4.5 2 6.5"
  })),
  lighthouse: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M6 14.5 L7 5 H9 L10 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 5 L8 2.5 L9.5 5 M3 4 L1 3 M13 4 L15 3",
    className: "obj-accent"
  })),
  bridge: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1 9 H15 M3 9 V13 M13 9 V13 M3 9 C5 5.5 11 5.5 13 9"
  })),
  pass: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1 13.5 L5 5 L7.5 9.5 L9 7.5 L11 5 L15 13.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 9.5 L9 7.5",
    className: "obj-accent"
  })),
  battle: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3 3 L13 13 M13 3 L3 13 M2 10.5 L5.5 14 M10.5 14 L14 10.5"
  })),
  camp: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1.5 14 L8 3 L14.5 14 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 14 L8 9 L10.5 14"
  })),
  marker: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M8 15 C8 15 3 9.5 3 6 A5 5 0 0 1 13 6 C13 9.5 8 15 8 15 Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "6",
    r: "1.8",
    className: "obj-accent"
  })),
  inn: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 V8 L6.5 4 L11 8 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.5 14.5 V11 H7.5 V14.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 8.5 H15 M14 8.5 V9.5",
    className: "obj-line"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 9.5 H15 V12.5 H12 Z",
    className: "obj-accent"
  })),
  // fantasy: obj-magic (violet), obj-danger (red), obj-hole (a dark opening), obj-line (no fill)
  dragon: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 C3.5 8.5 7.5 3.5 14.5 1.5 C13.5 4.5 13.5 7.5 12 10 C11 9 9.5 9 9 10.8 C8 9.8 6.5 10 6 11.8 C5 11 3.5 11.5 2 14.5 Z",
    className: "obj-danger"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 5.3 L6 11.8 M8 5.3 L9 10.8 M8 5.3 L12 10",
    className: "obj-line"
  })),
  lair: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3.5 2.5 C6 5.5 6.2 10 4 14.5 C4.6 10 4.6 6 3.5 2.5 Z",
    className: "obj-danger"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 2 C10 5 10.2 10 8 14.5 C8.6 10 8.6 5.5 7.5 2 Z",
    className: "obj-danger"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11.5 2.5 C14 5.5 14.2 10 12 14.5 C12.6 10 12.6 6 11.5 2.5 Z",
    className: "obj-danger"
  })),
  cursed: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M8 2 C4.6 2 3 4.5 3 7.2 C3 9.2 4 10.4 5 11 V13 H11 V11 C12 10.4 13 9.2 13 7.2 C13 4.5 11.4 2 8 2 Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "7.5",
    r: "1.3",
    className: "obj-danger"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "10",
    cy: "7.5",
    r: "1.3",
    className: "obj-danger"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.4 10 L8 9 L8.6 10 Z",
    className: "obj-hole"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 13 V14.5 H11 V13 M7 13 V14.5 M9 13 V14.5"
  })),
  cave: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1 14.5 L3.5 7.5 L6.5 4.5 L9.5 3.5 L12.5 6.5 L15 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 14.5 V11.8 C5 8.6 11 8.6 11 11.8 V14.5 Z",
    className: "obj-hole"
  })),
  portal: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M8 1.5 C11.3 1.5 12.5 4.8 12.5 8 C12.5 11.5 10.8 14.5 8 14.5 C5.2 14.5 3.5 11.5 3.5 8 C3.5 4.8 4.7 1.5 8 1.5 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 5 C9.8 5 10.3 7.2 9 8.3 C7.8 9.3 6.2 8.5 6.6 7.1 C6.9 6.2 8 6.3 8.1 7.1",
    className: "obj-line"
  })),
  magetower: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M6 14.5 L6.6 7 H9.4 L10 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.3 7 L8 1 L10.7 7 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.3 14.5 V12 C7.3 11.2 8.7 11.2 8.7 12 V14.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12.8 1.8 L13.3 3 L14.5 3.2 L13.6 4 L13.9 5.2 L12.8 4.6 L11.7 5.2 L12 4 L11.1 3.2 L12.3 3 Z",
    className: "obj-accent"
  })),
  crystal: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 9 L4.2 8 L5.4 14.5 H3.2 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.5 9.5 L11.8 8.5 L10.6 14.5 H12.8 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 1.5 L11 5.5 L10 14.5 H6 L5 5.5 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 5.5 H11 M8 1.5 V14.5",
    className: "obj-line"
  })),
  spring: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M8 1.8 C8 1.8 4.6 6.6 4.6 9.2 A3.4 3.4 0 0 0 11.4 9.2 C11.4 6.6 8 1.8 8 1.8 Z",
    className: "obj-magic"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 14.5 C4.5 13.3 11.5 13.3 14 14.5",
    className: "obj-line"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12.8 1.2 L13.4 2.9 L15.1 3.5 L13.4 4.1 L12.8 5.8 L12.2 4.1 L10.5 3.5 L12.2 2.9 Z",
    className: "obj-accent"
  })),
  grove: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M4.5 9.5 V14.5 M11.5 9.5 V14.5 M8 8 V14.5 M2.5 14.5 H13.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "4.5",
    cy: "8",
    r: "2.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11.5",
    cy: "8",
    r: "2.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "5",
    r: "3.2",
    className: "obj-accent"
  })),
  stones: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M3.5 14.5 V6.2 H6.2 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.8 14.5 V6.2 H12.5 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2.6 4 H13.4 V6.2 H2.6 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 14.5 H15"
  })),
  barrow: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1 14.5 C2.5 8.5 5 6 8 6 C11 6 13.5 8.5 15 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 14.5 V11.5 H9.5 V14.5 Z",
    className: "obj-hole"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.8 11.4 H10.2"
  })),
  shrine: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M4 14.5 V10 H12 V14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 10 V8.5 H13 V10 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 1.8 C9.9 3.9 10.6 5.4 9.6 7.2 C9.1 8 6.9 8 6.4 7.2 C5.4 5.4 6.1 3.8 8 1.8 Z",
    className: "obj-accent"
  })),
  dwarfhold: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M1 14.5 L5.5 4.5 L8 7.5 L10.5 3.5 L15 14.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.8 14.5 V10.8 H10.2 V14.5 Z",
    className: "obj-hole"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 10.8 L8 8.6 L11 10.8 Z",
    className: "obj-accent"
  })),
  treasure: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 14 V8.5 H13.5 V14 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2.5 8.5 C2.5 5.2 13.5 5.2 13.5 8.5 Z",
    className: "obj-accent"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2.5 11 H7 M9 11 H13.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 9.2 H9 V11.6 H7 Z",
    className: "obj-accent"
  }))
};
function ObjectIcon(_ref) {
  var type = _ref.type,
    size = _ref.size;
  return /*#__PURE__*/React.createElement("svg", {
    width: size || 22,
    height: size || 22,
    viewBox: "0 0 16 16",
    className: "obj-icon-svg"
  }, OBJ_ICON[type] || OBJ_ICON.marker);
}

// <defs> symbols for the map layer (drawn once, referenced by <use>)
function ObjectSymbols() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, Objects.TYPES.map(function (ty) {
    return /*#__PURE__*/React.createElement("symbol", {
      key: ty.id,
      id: "obj-" + ty.id,
      viewBox: "0 0 16 16",
      overflow: "visible"
    }, /*#__PURE__*/React.createElement("g", {
      className: "obj-sym"
    }, OBJ_ICON[ty.id]));
  }));
}

// objects scale partly with the zoom so they stay readable when zoomed out and don't
// swallow the map when zoomed in
function objectScale(o, k) {
  var ty = Objects.TYPE[o.type] || {
    size: 0.8
  };
  var imp = [0.75, 1, 1.3][Math.max(0, Math.min(2, (o.importance || 2) - 1))];
  // ~22 screen px for a normal city, growing a little as you zoom in
  var pxPerUnit = (window.MapAPI && MapAPI.pxPerUnit ? MapAPI.pxPerUnit() : 1) * k;
  return 22 * ty.size * imp * Math.pow(k, 0.22) / Math.max(0.01, pxPerUnit) / 16;
}
function objectTransform(o, k) {
  var s = objectScale(o, k);
  return "translate(".concat(o.x, ",").concat(o.y, ") scale(").concat(s.toFixed(4), ") translate(-8,-15)");
}

// sea routes under trails under roads: a trail running along a road shows as the road
var ROAD_ORDER = {
  sea: 0,
  trail: 1,
  road: 2
};
function RoadsLayer() {
  var p = App.project;
  var roads = Object.values(p && p.roads || {}).sort(function (a, b) {
    return (ROAD_ORDER[a.kind] || 0) - (ROAD_ORDER[b.kind] || 0);
  });
  if (!roads.length || p.settings.showRoads === false) return null;
  return /*#__PURE__*/React.createElement("g", {
    id: "roads",
    pointerEvents: "none"
  }, roads.map(function (r) {
    if (!r.pts || r.pts.length < 2) return null;
    var a = p.objects[r.from],
      b = p.objects[r.to];
    if (!a || !b || !Objects.visible(a, p) || !Objects.visible(b, p)) return null;
    var d = "M" + r.pts.map(function (q) {
      return q[0].toFixed(2) + "," + q[1].toFixed(2);
    }).join("L");
    var style = r.kind === "sea" ? {
      stroke: "#2f5f8f",
      dash: "2 3",
      w: 1.1
    } : r.kind === "trail" ? {
      stroke: "#6b4f32",
      dash: "3 2.5",
      w: 1
    } : {
      stroke: "#5a3b22",
      dash: null,
      w: 1.6
    };
    return /*#__PURE__*/React.createElement("g", {
      key: r.id
    }, r.kind === "road" && /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: "#f3e7cf",
      strokeOpacity: "0.7",
      strokeWidth: style.w + 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: style.stroke,
      strokeWidth: style.w,
      strokeDasharray: style.dash || undefined,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      vectorEffect: "non-scaling-stroke"
    }));
  }));
}
function ObjectsLayer(_ref2) {
  var k = _ref2.k,
    grabbable = _ref2.grabbable;
  var p = App.project;
  if (!p || !p.objects || p.settings.showObjects === false) return null;
  var list = Object.values(p.objects).filter(function (o) {
    return Objects.visible(o, p);
  });
  if (!list.length) return null;
  var sel = App.ui.card && App.ui.card.kind === "object" ? App.ui.card.id : null;
  var from = App.ui.roadFrom && App.ui.roadFrom.id;
  var showNames = p.settings.showObjectLabels !== false;
  return /*#__PURE__*/React.createElement("g", {
    id: "objects"
  }, list.map(function (o) {
    var ty = Objects.TYPE[o.type] || Objects.TYPE.marker;
    var big = ty.city && (o.type === "capital" || o.type === "city" || (o.importance || 2) >= 3);
    return /*#__PURE__*/React.createElement("g", {
      key: o.id,
      "data-object": o.id,
      "data-ox": o.x,
      "data-oy": o.y,
      transform: objectTransform(o, k),
      className: "map-object" + (sel === o.id || from === o.id ? " sel" : ""),
      style: {
        cursor: grabbable ? "pointer" : undefined
      }
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-2",
      y: "-2",
      width: "20",
      height: "20",
      fill: "transparent"
    }), /*#__PURE__*/React.createElement("use", {
      href: "#obj-" + (Objects.TYPE[o.type] ? o.type : "marker"),
      width: "16",
      height: "16"
    }), showNames && o.name && /*#__PURE__*/React.createElement("text", {
      x: 8 + (o.labelDx || 0),
      y: 24 + (o.labelDy || 0),
      textAnchor: "middle",
      className: "map-object-label" + (big ? " big" : "")
    }, o.name));
  }));
}

// palette shown while the Places tool is active
function ObjectPalette() {
  useStore();
  var type = App.ui.placeType || "town";
  var p = App.project;
  return /*#__PURE__*/React.createElement("div", {
    className: "world-palette object-palette",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "wp-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wp-title"
  }, t("obj.palette"))), Objects.GROUPS.map(function (gr) {
    var key = "objOpen_" + gr;
    var open = App.ui[key] != null ? App.ui[key] : true;
    return /*#__PURE__*/React.createElement("div", {
      key: gr,
      className: "wp-group"
    }, /*#__PURE__*/React.createElement("button", {
      className: "wp-group-head",
      onClick: function onClick() {
        return Actions.ui(_defineProperty({}, key, !open));
      }
    }, /*#__PURE__*/React.createElement("span", null, open ? "▾" : "▸"), " ", t("obj.group." + gr)), open && /*#__PURE__*/React.createElement("div", {
      className: "obj-grid"
    }, Objects.TYPES.filter(function (ty) {
      return ty.group === gr;
    }).map(function (ty) {
      return /*#__PURE__*/React.createElement("button", {
        key: ty.id,
        className: "obj-type" + (type === ty.id ? " on" : ""),
        onClick: function onClick() {
          return Actions.setPref({
            placeType: ty.id
          });
        }
      }, /*#__PURE__*/React.createElement(ObjectIcon, {
        type: ty.id,
        size: 22
      }), /*#__PURE__*/React.createElement("span", null, t("obj.type." + ty.id)));
    })));
  }), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("obj.placeHint")), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: p.settings.showObjectLabels !== false,
    onChange: function onChange(e) {
      return Actions.setSettings({
        showObjectLabels: e.target.checked
      }, {
        undo: false
      });
    }
  }), t("obj.showNames")), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: p.settings.showRoads !== false,
    onChange: function onChange(e) {
      return Actions.setSettings({
        showRoads: e.target.checked
      }, {
        undo: false
      });
    }
  }), t("obj.showRoads")));
}
function RoadModeBar() {
  useStore();
  var rf = App.ui.roadFrom;
  if (!rf) return null;
  var o = App.project && App.project.objects && App.project.objects[rf.id];
  return /*#__PURE__*/React.createElement("div", {
    className: "geom-bar road-bar",
    "data-export-skip": "1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t("obj.roadPick").replace("{name}", o ? o.name : "")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, Objects.ROAD_KINDS.map(function (kd) {
    return /*#__PURE__*/React.createElement("button", {
      key: kd,
      className: "chip" + (rf.kind === kd ? " on" : ""),
      onClick: function onClick() {
        return Actions.ui({
          roadFrom: Object.assign({}, rf, {
            kind: kd
          })
        });
      }
    }, t("obj.road." + kd));
  })), rf.kind !== "sea" && window.World && World.active() && /*#__PURE__*/React.createElement("button", {
    className: "chip" + (App.ui.roadFollow !== false ? " on" : ""),
    title: t("obj.roadFollowHint"),
    onClick: function onClick() {
      return Actions.setPref({
        roadFollow: App.ui.roadFollow === false
      });
    }
  }, t("obj.roadFollow")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        roadFrom: null
      });
    }
  }, t("edit.cancel")));
}
function ObjectCard(_ref3) {
  var id = _ref3.id;
  useStore();
  var p = App.project;
  var o = p && p.objects && p.objects[id];
  if (!o) return null;
  var set = function set(patch) {
    return Actions.setObject(id, patch, {
      undo: false
    });
  };
  var autoOwner = function () {
    var rid = Objects.provinceOf(o);
    var e = rid ? effRegion(p, rid) : null;
    return e && e.owner && p.states[e.owner] ? e.owner : null;
  }();
  var provId = Objects.provinceOf(o);
  var provF = provId && App.basemap.byId[provId];
  var provR = provId && p.regions[provId];
  var provName = provF ? provR && provR.name || (App.ui.lang === "ru" && provF.nameRu ? provF.nameRu : provF.name) : null;
  var roads = Object.values(p.roads || {}).filter(function (r) {
    return r.from === id || r.to === id;
  });
  var world = window.World && World.active();
  var heightHere = world ? World.heightAt(World.mapToGrid([o.x, o.y])) : null;
  var ru = App.ui.lang === "ru";
  // distance to the owner's capital (custom worlds have a real scale)
  var capDist = null;
  var owner = o.owner && p.states[o.owner] ? o.owner : autoOwner;
  if (world && owner) {
    var cap = Object.values(p.objects).find(function (x) {
      return x.type === "capital" && x.id !== id && Objects.ownerOf(x, p) === owner;
    });
    if (cap) capDist = Math.hypot(cap.x - o.x, cap.y - o.y) / World.mapUnitsPerCell() * (+p.world.scaleKm || 5);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "info-card",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-kind"
  }, /*#__PURE__*/React.createElement(ObjectIcon, {
    type: o.type,
    size: 16
  }), " ", t("obj.type." + o.type)), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        card: null
      });
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("input", {
    className: "input card-title",
    value: o.name || "",
    placeholder: t("obj.namePh"),
    onChange: function onChange(e) {
      return set({
        name: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "obj-type-groups"
  }, Objects.GROUPS.map(function (gr) {
    return /*#__PURE__*/React.createElement("div", {
      key: gr,
      className: "obj-grid compact",
      title: t("obj.group." + gr)
    }, Objects.TYPES.filter(function (ty) {
      return ty.group === gr;
    }).map(function (ty) {
      return /*#__PURE__*/React.createElement("button", {
        key: ty.id,
        className: "obj-type" + (o.type === ty.id ? " on" : ""),
        title: t("obj.type." + ty.id),
        onClick: function onClick() {
          return set({
            type: ty.id
          });
        }
      }, /*#__PURE__*/React.createElement(ObjectIcon, {
        type: ty.id,
        size: 18
      }));
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, /*#__PURE__*/React.createElement(CardRow, {
    k: t("obj.province"),
    v: provName
  }), /*#__PURE__*/React.createElement(CardRow, {
    k: t("obj.stateAuto"),
    v: autoOwner ? p.states[autoOwner].name : t("card.noOwner")
  }), heightHere != null && /*#__PURE__*/React.createElement(CardRow, {
    k: t("obj.height"),
    v: heightHere > 0 ? fmtNum(heightHere) + " " + t("world.m") : t("obj.onWater")
  }), capDist != null && /*#__PURE__*/React.createElement(CardRow, {
    k: t("obj.toCapital"),
    v: "≈ " + fmtNum(capDist) + " " + t("world.km")
  })), /*#__PURE__*/React.createElement("div", {
    className: "card-fields"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, t("obj.population")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: o.population || "",
    onChange: function onChange(e) {
      return set({
        population: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, t("obj.owner")), /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: o.owner || "",
    onChange: function onChange(e) {
      return set({
        owner: e.target.value || null
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("obj.ownerAuto")), p.stateOrder.map(function (sid) {
    return p.states[sid] ? /*#__PURE__*/React.createElement("option", {
      key: sid,
      value: sid
    }, p.states[sid].name) : null;
  }))), /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, t("obj.founded")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    inputMode: "numeric",
    value: o.founded == null ? "" : o.founded,
    onChange: function onChange(e) {
      return set({
        founded: e.target.value === "" ? null : +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, t("obj.destroyed")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    inputMode: "numeric",
    value: o.destroyed == null ? "" : o.destroyed,
    onChange: function onChange(e) {
      return set({
        destroyed: e.target.value === "" ? null : +e.target.value
      });
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, t("obj.importance")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, [1, 2, 3].map(function (n) {
    return /*#__PURE__*/React.createElement("button", {
      key: n,
      className: "chip" + ((o.importance || 2) === n ? " on" : ""),
      onClick: function onClick() {
        return set({
          importance: n
        });
      }
    }, t("obj.importance" + n));
  }))), roads.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, roads.map(function (r) {
    var other = p.objects[r.from === id ? r.to : r.from];
    var km = Objects.roadKm(r, p);
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      className: "card-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-k"
    }, t("obj.road." + r.kind)), /*#__PURE__*/React.createElement("span", {
      className: "card-v"
    }, "\u2192 ", other ? other.name : "?", km ? " \xB7 \u2248 ".concat(fmtNum(km), " ").concat(t("world.km"), " \xB7 \u2248 ").concat(Math.max(1, Math.round(km / (Objects.dayKm[r.kind] || 30))), " ").concat(t("obj.days")) : "", /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      style: {
        height: 22,
        width: 22
      },
      title: t("obj.deleteRoad"),
      onClick: function onClick() {
        return Actions.deleteRoad(r.id);
      }
    }, "\u2715")));
  })), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea card-notes",
    placeholder: t("card.notes"),
    value: o.notes || "",
    onChange: function onChange(e) {
      return set({
        notes: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        roadFrom: {
          id: id,
          kind: o.type === "port" ? "sea" : "road"
        },
        card: null
      });
    }
  }, t("obj.addRoad")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      if (confirm(t("obj.deleteAsk").replace("{name}", o.name || ""))) {
        Actions.deleteObject(id);
        Actions.ui({
          card: null
        });
      }
    }
  }, t("obj.delete"))));
}
Object.assign(window, {
  ObjectSymbols: ObjectSymbols,
  ObjectsLayer: ObjectsLayer,
  RoadsLayer: RoadsLayer,
  ObjectPalette: ObjectPalette,
  ObjectCard: ObjectCard,
  RoadModeBar: RoadModeBar,
  ObjectIcon: ObjectIcon,
  objectTransform: objectTransform
});
//# sourceMappingURL=objects.js.map
