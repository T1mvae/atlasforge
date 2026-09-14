"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// AtlasForge — custom world UI: brush palette, world settings, AI atlas modal,
// brush-size rail and the river card
var fmtNum = function fmtNum(v) {
  return Math.round(v).toLocaleString(App.ui.lang === "ru" ? "ru-RU" : "en-US");
};
function WorldSection(_ref) {
  var id = _ref.id,
    title = _ref.title,
    children = _ref.children,
    defaultOpen = _ref.defaultOpen;
  var key = "wpOpen_" + id;
  var open = App.ui[key] != null ? App.ui[key] : !!defaultOpen;
  return /*#__PURE__*/React.createElement("div", {
    className: "wp-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "wp-group-head",
    onClick: function onClick() {
      return Actions.ui(_defineProperty({}, key, !open));
    }
  }, /*#__PURE__*/React.createElement("span", null, open ? "▾" : "▸"), " ", title), open && /*#__PURE__*/React.createElement("div", {
    className: "wp-group-body"
  }, children));
}
function BrushGrid(_ref2) {
  var list = _ref2.list,
    brush = _ref2.brush;
  return /*#__PURE__*/React.createElement("div", {
    className: "wp-brushes"
  }, list.map(function (b) {
    return /*#__PURE__*/React.createElement("button", {
      key: b,
      className: "wp-brush" + (brush === b ? " on" : ""),
      onClick: function onClick() {
        return Actions.setPref({
          worldBrush: b
        });
      },
      title: t("world.brushHint." + b)
    }, /*#__PURE__*/React.createElement("span", {
      className: "wp-swatch",
      style: {
        background: World.BRUSH_SWATCH[b]
      }
    }), /*#__PURE__*/React.createElement("span", null, t("world.brush." + b)));
  }));
}
function WorldPalette() {
  var _clim$latTop, _clim$latTop2, _clim$latBottom, _clim$latBottom2, _clim$tEquator, _clim$tEquator2;
  useStore();
  var p = App.project;
  if (!p || !p.world) return null;
  var w = p.world;
  var brush = App.ui.worldBrush || "land";
  var size = App.ui.worldSize || 12;
  var collapsed = !!App.ui.worldPaletteCollapsed;
  var km = +w.scaleKm || 5;
  var stale = w.genRev != null && w.genRev !== w.rev;
  var hasProvinces = App.basemap.count > 0;
  var clim = w.climate || {};
  var po = w.provinceOpts || {};
  var setClimate = function setClimate(patch) {
    return World.setWorld({
      climate: Object.assign({}, clim, patch)
    });
  };
  var setPO = function setPO(patch) {
    return World.setWorld({
      provinceOpts: Object.assign({}, po, patch)
    });
  };
  var strengthBrush = brush === "raise" || brush === "lower" || brush === "smooth";
  var generate = function generate() {
    if (hasProvinces && !confirm(t("world.regenAsk"))) return;
    Actions.toast(t("world.generating"));
    World.generate();
  };
  if (collapsed) {
    return /*#__PURE__*/React.createElement("div", {
      className: "world-palette collapsed",
      "data-export-skip": "1"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn",
      onClick: function onClick() {
        return Actions.ui({
          worldPaletteCollapsed: false
        });
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "wp-swatch",
      style: {
        background: World.BRUSH_SWATCH[brush]
      }
    }), " ", t("world.brush." + brush), " \u25B8"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "world-palette",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "wp-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wp-title"
  }, t("world.palette")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("world.collapse"),
    onClick: function onClick() {
      return Actions.ui({
        worldPaletteCollapsed: true
      });
    }
  }, "\u25C2")), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.groupRelief")), /*#__PURE__*/React.createElement(BrushGrid, {
    list: World.RELIEF_BRUSHES,
    brush: brush
  }), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.groupCover")), /*#__PURE__*/React.createElement(BrushGrid, {
    list: World.COVER_BRUSHES,
    brush: brush
  }), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.groupWater")), /*#__PURE__*/React.createElement(BrushGrid, {
    list: World.WATER_BRUSHES,
    brush: brush
  }), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.size"), " \u2014 ", size), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "1",
    max: "60",
    step: "1",
    value: size,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldSize: +e.target.value
      });
    }
  })), strengthBrush && /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.strength"), " \u2014 ", Math.round((+App.ui.worldStrength || 0.6) * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0.05",
    max: "1",
    step: "0.05",
    value: +App.ui.worldStrength || 0.6,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldStrength: +e.target.value
      });
    }
  })), (brush === "ridge" || brush === "valley" || brush === "river") && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.lineHint")), /*#__PURE__*/React.createElement(WorldSection, {
    id: "brush",
    title: t("world.brushSettings")
  }, /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: App.ui.worldPressure !== false,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldPressure: e.target.checked
      });
    }
  }), t("world.pressure"), World.pressureSupport() === "no" ? " — " + t("input.noPressureShort") : ""), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: App.ui.worldRough !== false,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldRough: e.target.checked
      });
    }
  }), t("world.rough")), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("input.stabilizer"), " \u2014 ", Math.round((+App.ui.worldStabilizer || 0) * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0",
    max: "0.85",
    step: "0.05",
    value: +App.ui.worldStabilizer || 0,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldStabilizer: +e.target.value
      });
    }
  }))), /*#__PURE__*/React.createElement(WorldSection, {
    id: "provinces",
    title: t("world.provinces"),
    defaultOpen: true
  }, /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.cellSize"), " \u2014 \u2248", Math.round((w.cellSize || 18) * km), " ", t("world.km")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "6",
    max: "50",
    step: "1",
    value: w.cellSize || 18,
    onChange: function onChange(e) {
      return World.setWorld({
        cellSize: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.mountainsMode")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip" + (po.mountains !== "separate" ? " on" : ""),
    onClick: function onClick() {
      return setPO({
        mountains: "sides"
      });
    }
  }, t("world.mountainsSides")), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (po.mountains === "separate" ? " on" : ""),
    onClick: function onClick() {
      return setPO({
        mountains: "separate"
      });
    }
  }, t("world.mountainsSeparate")))), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!po.riversAsBorders,
    onChange: function onChange(e) {
      return setPO({
        riversAsBorders: e.target.checked
      });
    }
  }), t("world.riversAsBorders")), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: po.citySeeds !== false,
    onChange: function onChange(e) {
      return setPO({
        citySeeds: e.target.checked
      });
    }
  }), t("world.citySeeds")), /*#__PURE__*/React.createElement("button", {
    className: "btn " + (stale || !hasProvinces ? "primary" : "outline"),
    disabled: World.generating,
    onClick: generate
  }, World.generating ? t("world.generating") : hasProvinces ? t("world.regenerate") : t("world.generate")), stale && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.stale")), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.smartHint"))), /*#__PURE__*/React.createElement(WorldSection, {
    id: "nature",
    title: t("world.nature")
  }, /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.seaLevel"), " \u2014 ", fmtNum(w.seaLevel || 0), " ", t("world.m")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "-1500",
    max: "1500",
    step: "10",
    value: w.seaLevel || 0,
    onChange: function onChange(e) {
      return World.setWorld({
        seaLevel: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.latTop"), " \u2014 ", (_clim$latTop = clim.latTop) !== null && _clim$latTop !== void 0 ? _clim$latTop : 70, "\xB0"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "-90",
    max: "90",
    step: "1",
    value: (_clim$latTop2 = clim.latTop) !== null && _clim$latTop2 !== void 0 ? _clim$latTop2 : 70,
    onChange: function onChange(e) {
      return setClimate({
        latTop: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.latBottom"), " \u2014 ", (_clim$latBottom = clim.latBottom) !== null && _clim$latBottom !== void 0 ? _clim$latBottom : -10, "\xB0"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "-90",
    max: "90",
    step: "1",
    value: (_clim$latBottom2 = clim.latBottom) !== null && _clim$latBottom2 !== void 0 ? _clim$latBottom2 : -10,
    onChange: function onChange(e) {
      return setClimate({
        latBottom: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.tEquator"), " \u2014 ", (_clim$tEquator = clim.tEquator) !== null && _clim$tEquator !== void 0 ? _clim$tEquator : 27, " \xB0C"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "10",
    max: "40",
    step: "1",
    value: (_clim$tEquator2 = clim.tEquator) !== null && _clim$tEquator2 !== void 0 ? _clim$tEquator2 : 27,
    onChange: function onChange(e) {
      return setClimate({
        tEquator: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: w.autoRivers !== false,
    onChange: function onChange(e) {
      return World.setWorld({
        autoRivers: e.target.checked
      });
    }
  }), t("world.autoRivers")), w.autoRivers !== false && /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.riverThreshold")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "15",
    max: "400",
    step: "5",
    value: w.riverThreshold || 60,
    onChange: function onChange(e) {
      return World.setWorld({
        riverThreshold: +e.target.value
      });
    }
  }))), /*#__PURE__*/React.createElement(WorldSection, {
    id: "map",
    title: t("world.mapSettings")
  }, /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.scale")), /*#__PURE__*/React.createElement("span", {
    className: "wp-inline"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "input",
    min: "0.1",
    step: "0.5",
    value: km,
    style: {
      width: 70
    },
    onChange: function onChange(e) {
      return World.setWorld({
        scaleKm: Math.max(0.1, +e.target.value || 5)
      });
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t("world.km"), " \xB7 ", t("world.mapSize").replace("{w}", fmtNum(World.GW * km)).replace("{h}", fmtNum(World.GH * km))))), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.fillOpacity"), " \u2014 ", Math.round((p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62) * 100), "%"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0.15",
    max: "1",
    step: "0.01",
    value: p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62,
    onChange: function onChange(e) {
      return Actions.setSettings({
        worldFillOpacity: +e.target.value
      }, {
        undo: false
      });
    }
  })), w.autoRivers === false && (w.rivers || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "wp-rivers"
  }, (w.rivers || []).map(function (rv) {
    return /*#__PURE__*/React.createElement("div", {
      key: rv.id,
      className: "wp-river"
    }, /*#__PURE__*/React.createElement("input", {
      className: "input",
      value: rv.name,
      onChange: function onChange(e) {
        return World.renameRiver(rv.id, e.target.value);
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      title: t("world.deleteRiver"),
      onClick: function onClick() {
        return World.deleteRiver(rv.id);
      }
    }, "\u2715"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "wp-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      if (confirm(t("world.randomAsk"))) World.randomContinent();
    }
  }, t("world.random")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      if (confirm(t("world.clearAsk"))) World.clearTerrain();
    }
  }, t("world.clear")))), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !hasProvinces,
    onClick: function onClick() {
      return Actions.ui({
        modal: "atlas"
      });
    }
  }, t("world.atlas")), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.labelsHint")));
}

// Procreate-style vertical brush-size rail on the left edge of the map: drag with a
// thumb while the other hand draws (no keyboard shortcuts on an iPad)
function WorldSizeRail() {
  useStore();
  var size = App.ui.worldSize || 12;
  var MIN = 1,
    MAX = 60;
  var trackRef = React.useRef(null);
  var setFrom = function setFrom(clientY) {
    var r = trackRef.current.getBoundingClientRect();
    var k = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    Actions.ui({
      worldSize: Math.max(MIN, Math.round(MIN + (MAX - MIN) * k * k))
    });
  };
  var onDown = function onDown(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {}
    setFrom(e.clientY);
    var move = function move(ev) {
      return setFrom(ev.clientY);
    };
    var _up = function up() {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", _up);
      el.removeEventListener("pointercancel", _up);
      Actions.setPref({
        worldSize: App.ui.worldSize
      });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", _up);
    el.addEventListener("pointercancel", _up);
  };
  var k = Math.sqrt((size - MIN) / (MAX - MIN));
  return /*#__PURE__*/React.createElement("div", {
    className: "size-rail" + (App.ui.worldPaletteCollapsed ? "" : " shifted"),
    "data-export-skip": "1",
    onPointerDown: onDown,
    title: t("world.size")
  }, /*#__PURE__*/React.createElement("div", {
    className: "size-rail-track",
    ref: trackRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "size-rail-fill",
    style: {
      height: k * 100 + "%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "size-rail-thumb",
    style: {
      bottom: "calc(" + k * 100 + "% - 14px)"
    }
  }, size)));
}

// ---------- cards (tap a river…) ----------
// analysis of the current provinces + rivers, cached per basemap / hydrology / project version
var worldAnalysisCache = null;
function worldAnalysis() {
  var key = App.basemap.count + ":" + (World.hydro ? World.hydro.rev : 0) + ":" + World.rasterRev + ":" + App.terrVersion + ":" + App.ui.lang;
  if (!worldAnalysisCache || worldAnalysisCache.key !== key || worldAnalysisCache.bm !== App.basemap) {
    var feats = App.basemap.raw && App.basemap.raw.features || [];
    var rivers = World.displayRivers();
    var an = Atlas.analyze(feats, rivers);
    worldAnalysisCache = {
      key: key,
      bm: App.basemap,
      an: an,
      feats: feats,
      rivers: rivers,
      names: Atlas.names(an, App.ui.lang === "ru" ? "ru" : "en")
    };
  }
  return worldAnalysisCache;
}
function CardRow(_ref3) {
  var k = _ref3.k,
    v = _ref3.v;
  if (v == null || v === "") return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "card-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-k"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "card-v"
  }, v));
}
function RiverCard(_ref4) {
  var index = _ref4.index;
  useStore();
  var p = App.project;
  var w = p.world;
  var _worldAnalysis = worldAnalysis(),
    an = _worldAnalysis.an,
    feats = _worldAnalysis.feats,
    rivers = _worldAnalysis.rivers,
    names = _worldAnalysis.names;
  var rv = rivers.find(function (r) {
    return r.index === index;
  });
  if (!rv) return null;
  var ri = an.rivers.find(function (x) {
    return x.rv === rv;
  });
  var km = +w.scaleKm || 5;
  var provName = function provName(i) {
    var f = feats[i];
    var r = p.regions[String(f.id)];
    return r && r.name || f.properties && f.properties.name || f.id;
  };
  var ownerOf = function ownerOf(i) {
    var e = effRegion(p, String(feats[i].id));
    return e && e.owner && p.states[e.owner] ? e.owner : null;
  };
  var autoName = ri ? names.riverLabel[ri.k] : "";
  var cells = World.riverCellsOf(rv);
  var srcH = cells.length ? an.dg.h[cells[0]] : 0;
  var len = ri ? ri.len * km : 0;
  var thr = +w.riverThreshold || 60;
  var size = rv.flux ? rv.flux < thr * 3 ? 0 : rv.flux < thr * 12 ? 1 : rv.flux < thr * 40 ? 2 : 3 : null;
  var navigable = (rv.order || 0) >= 4 || rv.flux && rv.flux >= thr * 12;
  var states = [];
  (ri ? ri.cells : []).forEach(function (i) {
    var o = ownerOf(i);
    var nm = o ? p.states[o].name : t("card.noOwner");
    if (states[states.length - 1] !== nm) states.push(nm);
  });
  var into = rv.into >= 0 ? rivers.find(function (r) {
    return r.index === rv.into;
  }) : null;
  var intoRi = into ? an.rivers.find(function (x) {
    return x.rv === into;
  }) : null;
  var mouthWater = ri && ri.mouthWater >= 0 ? names.waterLabel[ri.mouthWater] : null;
  var mouthText = into ? into.name || (intoRi ? names.riverLabel[intoRi.k] : t("card.unnamed")) : mouthWater || (rv.mouthType === "land" ? t("card.sink") : t("card.sea"));
  var tributaries = rivers.filter(function (r) {
    return r.into === rv.index;
  });
  var basinArea = null;
  var hy = World.hydro;
  if (hy && rv.cells && rv.cells.length) {
    var b = hy.basin[rv.cells[rv.cells.length - 1]];
    var n = 0;
    for (var i = 0; i < hy.basin.length; i++) if (hy.basin[i] === b) n++;
    basinArea = n * km * km;
  }
  var firstProv = ri && ri.cells.length ? ri.cells[0] : -1,
    lastProv = ri && ri.cells.length ? ri.cells[ri.cells.length - 1] : -1;
  var handRec = rv.hand ? (w.rivers || []).find(function (r) {
    return r.id === rv.id;
  }) : null;
  var notes = rv.hand ? handRec && handRec.notes || "" : rv.notes || "";
  var rename = function rename(name) {
    return rv.hand ? World.renameRiver(rv.id, name) : World.nameRiver(rv, name, null);
  };
  var setNotes = function setNotes(text) {
    if (rv.hand) Actions.mut(function (pp) {
      var r = pp.world.rivers.find(function (x) {
        return x.id === rv.id;
      });
      if (r) r.notes = text;
    }, {
      undo: false
    });else World.nameRiver(rv, rv.name != null ? rv.name : autoName, text);
  };
  var zoom = function zoom() {
    var proj = App.basemap.proj;
    var xs = rv.pts.map(function (q) {
        return q[0];
      }),
      ys = rv.pts.map(function (q) {
        return q[1];
      });
    MapAPI.zoomTo([proj([Math.min.apply(Math, _toConsumableArray(xs)) - 6, Math.min.apply(Math, _toConsumableArray(ys)) - 6]), proj([Math.max.apply(Math, _toConsumableArray(xs)) + 6, Math.max.apply(Math, _toConsumableArray(ys)) + 6])]);
  };
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
  }, "\u3030 ", t("card.river")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        card: null
      });
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("input", {
    className: "input card-title",
    value: rv.name != null ? rv.name : "",
    placeholder: autoName || t("card.unnamedRiver"),
    onChange: function onChange(e) {
      return rename(e.target.value);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.length"),
    v: len ? "≈ " + fmtNum(len) + " " + t("world.km") : null
  }), rv.order ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.order"),
    v: rv.order
  }) : null, size != null ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.size"),
    v: t("card.size" + size)
  }) : null, rv.flux ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.navigable"),
    v: navigable ? t("card.yes") : t("card.no")
  }) : null, /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.source"),
    v: [srcH > 0 ? fmtNum(srcH) + " " + t("world.m") : "", firstProv >= 0 ? provName(firstProv) : "", rv.sourceType === "lake" ? t("card.fromLake") : ""].filter(Boolean).join(" · ")
  }), /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.mouth"),
    v: [mouthText, lastProv >= 0 ? provName(lastProv) : ""].filter(Boolean).join(" · ")
  }), basinArea ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.basin"),
    v: "≈ " + fmtNum(basinArea) + " " + t("world.km2")
  }) : null, states.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.states"),
    v: states.join(" → ")
  }) : null, tributaries.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.tributaries"),
    v: tributaries.map(function (r) {
      return r.name || t("card.unnamed");
    }).join(", ")
  }) : null), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea card-notes",
    placeholder: t("card.notes"),
    value: notes,
    onChange: function onChange(e) {
      return setNotes(e.target.value);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: zoom
  }, t("card.showOnMap"))));
}
function WorldCard() {
  useStore();
  var card = App.ui.card;
  if (!card) return null;
  if (card.kind === "river" && World.active()) return /*#__PURE__*/React.createElement(RiverCard, {
    index: card.index
  });
  if (card.kind === "object" && window.ObjectCard) return /*#__PURE__*/React.createElement(ObjectCard, {
    id: card.id
  });
  return null;
}
function AtlasModal() {
  useStore();
  var _React$useState = React.useState(true),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    withProvinces = _React$useState2[0],
    setWithProvinces = _React$useState2[1];
  var text = React.useMemo(function () {
    try {
      return Atlas.build({
        provinces: withProvinces
      });
    } catch (e) {
      console.error(e);
      return String(e);
    }
  }, [withProvinces, App.ui.lang]);
  var areaRef = React.useRef(null);
  var copy = /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
      var _t;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            _context.p = 0;
            _context.n = 1;
            return navigator.clipboard.writeText(text);
          case 1:
            Actions.toast(t("world.copied"));
            _context.n = 3;
            break;
          case 2:
            _context.p = 2;
            _t = _context.v;
            if (areaRef.current) {
              areaRef.current.select();
              document.execCommand("copy");
              Actions.toast(t("world.copied"));
            }
          case 3:
            return _context.a(2);
        }
      }, _callee, null, [[0, 2]]);
    }));
    return function copy() {
      return _ref5.apply(this, arguments);
    };
  }();
  var save = function save() {
    var name = (App.project && App.project.name || "world").replace(/[^\wЀ-ӿ -]+/g, "").trim() || "world";
    window.downloadBlob(new Blob([text], {
      type: "text/markdown;charset=utf-8"
    }), name + ".atlas.md");
  };
  var tokens = Math.round(text.length / 3.5);
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: function onClick() {
      return Actions.ui({
        modal: null
      });
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal atlas-modal",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("world.atlasTitle")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        modal: null
      });
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("world.atlasDesc")), /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: withProvinces,
    onChange: function onChange(e) {
      return setWithProvinces(e.target.checked);
    }
  }), t("world.atlasProvinces")), /*#__PURE__*/React.createElement("textarea", {
    ref: areaRef,
    className: "atlas-text",
    readOnly: true,
    value: text
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("world.atlasSize").replace("{c}", text.length.toLocaleString()).replace("{t}", tokens.toLocaleString()))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: save
  }, t("world.atlasSave")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: copy
  }, t("world.atlasCopy")))));
}
Object.assign(window, {
  WorldPalette: WorldPalette,
  AtlasModal: AtlasModal,
  WorldSizeRail: WorldSizeRail,
  WorldCard: WorldCard,
  worldAnalysis: worldAnalysis,
  CardRow: CardRow,
  fmtNum: fmtNum
});
//# sourceMappingURL=world.js.map
