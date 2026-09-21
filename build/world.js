"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// AtlasForge — custom world UI: brush palette, world settings, the geography pass (options
// sheet + preview bar), AI atlas modal, brush-size rail and the river card
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
  var _clim$latTop, _clim$latTop2, _clim$latBottom, _clim$latBottom2, _clim$tEquator, _clim$tEquator2, _clim$tPole, _clim$tPole2;
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
  var cutting = !!(World.cutPreview || World.generating);
  var busy = !!(World.preview || World.geoBusy || cutting);
  var rivers = w.rivers || [];
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
  }, "\u25C2")), w.legacyAuto && !busy && /*#__PURE__*/React.createElement("div", {
    className: "wp-banner"
  }, /*#__PURE__*/React.createElement("div", null, t("world.legacy.text")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return World.setWorld({
        legacyAuto: false
      });
    }
  }, t("world.legacy.ok"))), /*#__PURE__*/React.createElement("button", {
    className: "btn primary wp-geo",
    disabled: busy,
    onClick: function onClick() {
      return Actions.ui({
        modal: "geo",
        card: null
      });
    }
  }, t("world.geo.button")), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, cutting ? t("world.cut.previewing") : busy ? t("world.geo.previewing") : t("world.geo.hint")), !busy && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  }), t("world.citySeeds")), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!po.joinIslets,
    onChange: function onChange(e) {
      return setPO({
        joinIslets: e.target.checked
      });
    }
  }), t("world.joinIslets")), /*#__PURE__*/React.createElement("button", {
    className: "btn " + (stale || !hasProvinces ? "primary" : "outline"),
    disabled: World.generating,
    onClick: function onClick() {
      return World.generate();
    }
  }, World.generating ? t("world.generating") : hasProvinces ? t("world.regenerate") : t("world.generate")), stale && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.stale")), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.smartHint"))), /*#__PURE__*/React.createElement(WorldSection, {
    id: "rivers",
    title: t("world.rivers") + (rivers.length ? " (" + rivers.length + ")" : "")
  }, !rivers.length && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.noRivers")), rivers.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "wp-rivers"
  }, rivers.map(function (rv) {
    return /*#__PURE__*/React.createElement("div", {
      key: rv.id,
      className: "wp-river"
    }, /*#__PURE__*/React.createElement("input", {
      className: "input",
      value: rv.name || "",
      placeholder: t("card.unnamedRiver"),
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
  }))), /*#__PURE__*/React.createElement(WorldSection, {
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
  }, /*#__PURE__*/React.createElement("span", null, t("world.snowline"), " \u2014 ", fmtNum(w.snowline || 4200), " ", t("world.m")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "1000",
    max: "7000",
    step: "100",
    value: w.snowline || 4200,
    onChange: function onChange(e) {
      return World.setWorld({
        snowline: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.climateHint")), /*#__PURE__*/React.createElement("label", {
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
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.tPole"), " \u2014 ", (_clim$tPole = clim.tPole) !== null && _clim$tPole !== void 0 ? _clim$tPole : -28, " \xB0C"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "-50",
    max: "10",
    step: "1",
    value: (_clim$tPole2 = clim.tPole) !== null && _clim$tPole2 !== void 0 ? _clim$tPole2 : -28,
    onChange: function onChange(e) {
      return setClimate({
        tPole: +e.target.value
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
  }, t("world.labelsHint"))));
}

// ---------- "Поправить географию" ----------
// the options sheet: what the pass may change, then a preview on the map
function GeoSheet() {
  useStore();
  var p = App.project;
  var _React$useState = React.useState(function () {
      return Object.assign({}, World.GEO_DEFAULTS, p && p.world && p.world.geoOpts || {});
    }),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    o = _React$useState2[0],
    setO = _React$useState2[1];
  if (!p || !p.world || !World.active()) return null;
  var set = function set(patch) {
    return setO(Object.assign({}, o, patch));
  };
  var hasRivers = (p.world.rivers || []).some(function (r) {
    return !r.auto;
  });
  var any = o.fixRivers || o.addRivers || o.tributaries || o.lakes || o.biomes || o.foothills || o.erosion;
  var legacy = World.handCoverShare(); // % of land whose cover the fix leaves alone
  var close = function close() {
    return Actions.ui({
      modal: null
    });
  };
  var run = function run() {
    World.setWorld({
      geoOpts: Object.assign({}, o, {
        repaintAll: false
      })
    }); // repainting everything is never remembered
    close();
    World.runGeography(o);
  };
  var opt = function opt(k, extra) {
    return /*#__PURE__*/React.createElement("label", {
      className: "geo-opt" + (o[k] ? " on" : "")
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!o[k],
      onChange: function onChange(e) {
        return set(_defineProperty({}, k, e.target.checked));
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "geo-opt-text"
    }, /*#__PURE__*/React.createElement("b", null, t("world.geo.opt." + k)), /*#__PURE__*/React.createElement("span", null, t("world.geo.desc." + k)), extra));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: close
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal geo-sheet",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("world.geo.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: close
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("world.geo.intro")), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.geo.groupWater")), opt("fixRivers", !hasRivers ? /*#__PURE__*/React.createElement("span", {
    className: "geo-opt-warn"
  }, t("world.geo.noDrawnRivers")) : null), opt("tributaries", !hasRivers ? /*#__PURE__*/React.createElement("span", {
    className: "geo-opt-warn"
  }, t("world.geo.noDrawnRivers")) : null), opt("addRivers"), o.addRivers && /*#__PURE__*/React.createElement("label", {
    className: "wp-field geo-slider"
  }, /*#__PURE__*/React.createElement("span", null, t("world.geo.density")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0",
    max: "1",
    step: "0.05",
    value: o.density == null ? 0.5 : o.density,
    onChange: function onChange(e) {
      return set({
        density: +e.target.value
      });
    }
  })), opt("lakes"), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.geo.groupLand")), opt("biomes"), o.biomes && legacy >= 30 && !o.repaintAll && /*#__PURE__*/React.createElement("div", {
    className: "wp-note geo-legacy"
  }, t("world.geo.legacyCover").replace("{n}", legacy)), o.biomes && legacy >= 1 && opt("repaintAll"), opt("foothills"), opt("erosion")), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: close
  }, t("modal.cancel")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !any,
    onClick: run
  }, t("world.geo.run")))));
}

// what the pass changed, in plain words
function geoReportLines(r, opts) {
  var names = function names(list) {
    var named = list.filter(Boolean);
    if (!named.length) return "";
    return " (" + named.slice(0, 3).join(", ") + (named.length > 3 ? "…" : "") + ")";
  };
  var out = [];
  if (opts.fixRivers) {
    if (r.reversed.length) out.push(t("world.geo.r.reversed").replace("{n}", r.reversed.length) + names(r.reversed));
    if (r.extended.length) {
      var km = r.extended.reduce(function (s, e) {
        return s + e.km;
      }, 0);
      out.push(t("world.geo.r.extended").replace("{n}", r.extended.length).replace("{km}", fmtNum(km)) + names(r.extended.map(function (e) {
        return e.name;
      })));
    }
    if (r.gorges.length) out.push(t("world.geo.r.gorges").replace("{n}", r.gorges.length) + names(r.gorges));
    if (!r.reversed.length && !r.extended.length && !r.gorges.length) out.push(t("world.geo.r.riversOk"));
  }
  if (opts.addRivers || opts.tributaries) {
    out.push(t("world.geo.r.added").replace("{n}", r.added).replace("{m}", r.tributaries) + (r.replaced ? " " + t("world.geo.r.replaced").replace("{n}", r.replaced) : ""));
    if (r.named) out.push(t("world.geo.r.named").replace("{n}", r.named));
  }
  if (opts.tributaries && r.systems && r.systems.length) {
    var sys = r.systems.slice().sort(function (a, b) {
      return b.km2 - a.km2;
    });
    var list = sys.slice(0, 3).map(function (sy) {
      return t("world.geo.r.system").replace("{name}", sy.name ? "«" + sy.name + "»" : t("world.geo.r.unnamed")).replace("{km}", fmtNum(Math.round(sy.km2 / 1000) * 1000)).replace("{n}", sy.tribs || 0) + (sy.boosted ? t("world.geo.r.systemWet") : "");
    });
    out.push(t("world.geo.r.systems").replace("{list}", list.join("; ")) + (sys.length > 3 ? t("world.geo.r.more").replace("{n}", sys.length - 3) : ""));
  }
  if (opts.lakes) out.push(r.lakes ? t("world.geo.r.lakes").replace("{n}", r.lakes).replace("{km}", fmtNum(r.lakeKm2)) : t("world.geo.r.noLakes"));
  if (opts.biomes) out.push(t(opts.repaintAll ? "world.geo.r.biomesAll" : "world.geo.r.biomes").replace("{n}", r.biomePct || 0));
  if (opts.biomes && r.valleysKm2) out.push(t("world.geo.r.valleys").replace("{km}", fmtNum(Math.round(r.valleysKm2 / 1000) * 1000)));
  if (opts.foothills) out.push(r.foothillsKm2 ? t("world.geo.r.foothills").replace("{km}", fmtNum(r.foothillsKm2)) : t("world.geo.r.noFoothills"));
  if (opts.erosion) out.push(t("world.geo.r.erosion"));
  return out;
}

// preview bar over the map: what changed, hold to compare, apply or discard
function GeoBar() {
  useStore();
  if (World.geoBusy) {
    return /*#__PURE__*/React.createElement("div", {
      className: "geo-bar",
      "data-export-skip": "1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "geo-bar-busy"
    }, /*#__PURE__*/React.createElement("div", {
      className: "spinner"
    }), /*#__PURE__*/React.createElement("span", null, t("world.geo.running"))));
  }
  var pv = World.preview;
  if (!pv) return null;
  var off = function off() {
    return World.setCompare(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "geo-bar",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "geo-bar-title"
  }, World.compare ? t("world.geo.showingBefore") : t("world.geo.previewTitle")), /*#__PURE__*/React.createElement("ul", {
    className: "geo-report"
  }, geoReportLines(pv.report, pv.opts).map(function (line, i) {
    return /*#__PURE__*/React.createElement("li", {
      key: i
    }, line);
  })), /*#__PURE__*/React.createElement("div", {
    className: "geo-bar-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline geo-hold" + (World.compare ? " on" : ""),
    onPointerDown: function onPointerDown(e) {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
      World.setCompare(true);
    },
    onPointerUp: off,
    onPointerCancel: off,
    onLostPointerCapture: off,
    onContextMenu: function onContextMenu(e) {
      return e.preventDefault();
    }
  }, t("world.geo.holdBefore")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      World.cancelGeography();
      Actions.ui({
        modal: "geo"
      });
    }
  }, t("world.geo.adjust")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return World.cancelGeography();
    }
  }, t("world.geo.discard")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return World.applyGeography();
    }
  }, t("world.geo.apply"))));
}

// preview of a new province cut: what it did, what its borders follow, apply or discard
function CutBar() {
  useStore();
  if (World.generating) {
    return /*#__PURE__*/React.createElement("div", {
      className: "geo-bar",
      "data-export-skip": "1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "geo-bar-busy"
    }, /*#__PURE__*/React.createElement("div", {
      className: "spinner"
    }), /*#__PURE__*/React.createElement("span", null, t("world.generating"))));
  }
  var pv = World.cutPreview;
  if (!pv) return null;
  var r = pv.report || {};
  var lines = [t("world.cut.r.count").replace("{n}", fmtNum(pv.count)) + (pv.before ? " " + t("world.cut.r.before").replace("{n}", fmtNum(pv.before)) : "")];
  if (r.straits) lines.push(t("world.cut.r.straits").replace("{n}", r.straits));
  if (r.isthmuses) lines.push(t("world.cut.r.isthmuses").replace("{n}", r.isthmuses));
  if (r.crests) lines.push(t("world.cut.r.crests").replace("{n}", r.crests));
  if (pv.opts.riversAsBorders) lines.push(t("world.cut.r.rivers"));
  if (r.islets) lines.push(t("world.cut.r.islets").replace("{n}", r.islets));
  var many = pv.expected > 0 && pv.count > pv.expected * 1.3 + 3;
  return /*#__PURE__*/React.createElement("div", {
    className: "geo-bar",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "geo-bar-title"
  }, t("world.cut.title")), /*#__PURE__*/React.createElement("ul", {
    className: "geo-report"
  }, lines.map(function (line, i) {
    return /*#__PURE__*/React.createElement("li", {
      key: i
    }, line);
  })), many && /*#__PURE__*/React.createElement("div", {
    className: "geo-opt-warn"
  }, t("world.cut.many")), /*#__PURE__*/React.createElement("label", {
    className: "check-row cut-why-toggle"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: World.cutWhy,
    onChange: function onChange(e) {
      return World.setCutWhy(e.target.checked);
    }
  }), t("world.cut.why")), World.cutWhy && /*#__PURE__*/React.createElement("div", {
    className: "cut-legend"
  }, ["strait", "isthmus", "river", "crest"].map(function (k, i) {
    return /*#__PURE__*/React.createElement("span", {
      key: k
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        background: World.WHY_COLORS[i + 1]
      }
    }), t("world.cut.why." + k));
  })), /*#__PURE__*/React.createElement("div", {
    className: "geo-bar-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return World.cancelCut();
    }
  }, t("world.geo.discard")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return World.applyCut();
    }
  }, t("world.geo.apply"))));
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
  var riversRef = World.preview && !World.compare ? World.preview.rivers : App.project.world.rivers || [];
  // owners and names do not enter the analysis: political edits keep the cache (a geometry
  // edit reloads the basemap, which does)
  var key = App.basemap.count + ":" + (World.hydro ? World.hydro.rev : 0) + ":" + World.rasterRev + ":" + App.ui.lang + ":" + (World.watersFresh() ? World.waters.key : ""); // the seas and gulfs, once worked out
  var c = worldAnalysisCache;
  if (!c || c.key !== key || c.bm !== App.basemap || c.riversRef !== riversRef) {
    var feats = App.basemap.raw && App.basemap.raw.features || [];
    var rivers = World.displayRivers();
    worldAnalysisCache = {
      key: key,
      bm: App.basemap,
      riversRef: riversRef,
      an: Atlas.analyze(feats, rivers),
      feats: feats,
      rivers: rivers
    };
  }
  // names change while typing: refresh them without redoing the analysis
  var wa = worldAnalysisCache;
  wa.rivers.forEach(function (rv) {
    var rec = riversRef[rv.index];
    if (rec) {
      rv.name = rec.name;
      rv.notes = rec.notes || "";
    }
  });
  wa.names = Atlas.names(wa.an, App.ui.lang === "ru" ? "ru" : "en");
  return wa;
}

// ---------- names by a rule for the selected provinces ----------
var NAME_RULE_DEFAULT = {
  starts: "",
  samples: "",
  endings: "",
  length: "medium",
  geography: true,
  replaceAuto: true,
  replaceManual: false
};
// what naming needs to know about a province: its area (landmass + drainage basin) and the
// kind of place it is
function nameItems(ids) {
  var wa = worldAnalysis();
  var idx = new Map(wa.feats.map(function (f, i) {
    return [String(f.id), i];
  }));
  var items = ids.map(function (id) {
    var i = idx.get(String(id));
    var c = i != null ? wa.an.cells[i] : null;
    var props = i != null && wa.feats[i].properties || {};
    var land = -1,
      bv = 0;
    if (c) c.lands.forEach(function (v, k) {
      if (v > bv) {
        bv = v;
        land = k;
      }
    });
    var island = land >= 0 && wa.an.lands[land] && wa.an.lands[land].area < wa.names.totalLand * 0.08;
    var terr = props.terrain;
    var kind = terr === "mountain" ? "mountain" : island ? "island" : props.coastal ? "coast" : c && c.rivers.size ? "river" : terr === "forest" || terr === "taiga" || terr === "jungle" ? "forest" : terr === "marsh" ? "marsh" : terr === "desert" ? "desert" : terr === "hills" ? "hills" : null;
    return {
      id: id,
      area: land + ":" + (props.basin != null ? props.basin : ""),
      kind: kind,
      x: c && c.land ? c.sx / c.land : 0,
      y: c && c.land ? c.sy / c.land : 0
    };
  });
  // area by area, each from north-west
  var areaY = new Map();
  items.forEach(function (it) {
    if (!areaY.has(it.area) || it.y < areaY.get(it.area)) areaY.set(it.area, it.y);
  });
  return items.sort(function (a, b) {
    return areaY.get(a.area) - areaY.get(b.area) || (a.area < b.area ? -1 : a.area > b.area ? 1 : 0) || a.y - b.y || a.x - b.x;
  });
}
function NameRuleModal() {
  useStore();
  var p = App.project;
  var _React$useState3 = React.useState(function () {
      return Object.assign({}, NAME_RULE_DEFAULT, p && p.world && p.world.nameRule || {});
    }),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    rule = _React$useState4[0],
    setRule = _React$useState4[1];
  var _React$useState5 = React.useState(1),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    seed = _React$useState6[0],
    setSeed = _React$useState6[1];
  var _React$useState7 = React.useState({}),
    _React$useState8 = _slicedToArray(_React$useState7, 2),
    fixed = _React$useState8[0],
    setFixed = _React$useState8[1]; // id -> a name picked again for one province
  var ids = App.ui.nameIds || [];
  var lang = App.ui.lang === "ru" ? "ru" : "en";
  var active = !!(p && World.active() && window.NameGen);
  var recs = active ? ids.filter(function (id) {
    return App.basemap.byId[id];
  }).map(function (id) {
    return {
      id: id,
      r: p.regions[id] || {},
      f: App.basemap.byId[id]
    };
  }) : [];
  var manual = recs.filter(function (x) {
    return x.r.name && !x.r.nameAuto;
  });
  var auto = recs.filter(function (x) {
    return x.r.name && x.r.nameAuto;
  });
  var targets = recs.filter(function (x) {
    return !x.r.name || (x.r.nameAuto ? rule.replaceAuto : rule.replaceManual);
  });
  var targetKey = targets.map(function (x) {
    return x.id;
  }).join(",");
  var items = React.useMemo(function () {
    return active ? nameItems(targets.map(function (x) {
      return x.id;
    })) : [];
  }, [active, targetKey, App.basemap]);
  // names already on the map stay unique
  var taken = React.useMemo(function () {
    if (!active) return [];
    var tset = new Set(targets.map(function (x) {
      return x.id;
    }));
    var out = [];
    Object.keys(p.regions).forEach(function (id) {
      var r = p.regions[id];
      if (r && r.name && !tset.has(id)) out.push(r.name);
    });
    Object.values(p.states).forEach(function (st) {
      if (st.name) out.push(st.name);
    });
    return out;
  }, [active, targetKey, App.version]);
  var ruleKey = JSON.stringify([rule.starts, rule.samples, rule.endings, rule.length, rule.geography]);
  var names = React.useMemo(function () {
    return active ? NameGen.nameAll(rule, items, taken, {
      seed: seed,
      lang: lang
    }) : {};
  }, [active, ruleKey, items, taken, seed, lang]);
  if (!active) return null;
  var close = function close() {
    return Actions.ui({
      modal: null
    });
  };
  var set = function set(patch) {
    setRule(Object.assign({}, rule, patch));
    setFixed({});
  };
  var nameOf = function nameOf(id) {
    return fixed[id] || names[id];
  };
  var reroll = function reroll(id) {
    var it = items.find(function (x) {
      return x.id === id;
    });
    if (!it) return;
    var others = taken.concat(items.map(function (x) {
      return nameOf(x.id);
    }).filter(Boolean));
    var nm = NameGen.nameOne(rule, it, others, {
      seed: NameGen.hash(id + ":" + seed + ":" + Object.keys(fixed).length + ":" + Date.now()),
      lang: lang
    });
    if (nm) setFixed(Object.assign({}, fixed, _defineProperty({}, id, nm)));
  };
  var apply = function apply() {
    var out = {};
    targets.forEach(function (x) {
      var nm = nameOf(x.id);
      if (nm) out[x.id] = nm;
    });
    Actions.setRegionNames(out, {
      auto: true,
      rule: Object.assign({}, rule)
    });
    Actions.toast(t("names.done").replace("{n}", Object.keys(out).length));
    close();
  };
  var oldName = function oldName(x) {
    return x.r.name || x.f && x.f.name || x.id;
  };
  var kept = recs.length - targets.length;
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: close
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal names-modal",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("names.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: close
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("names.intro").replace("{n}", recs.length)), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("names.starts")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: rule.starts,
    placeholder: t("names.startsPh"),
    onChange: function onChange(e) {
      return set({
        starts: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("names.samples")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: rule.samples,
    placeholder: t("names.samplesPh"),
    onChange: function onChange(e) {
      return set({
        samples: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "names-hint"
  }, t("names.samplesHint"))), /*#__PURE__*/React.createElement("label", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("names.endings")), /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: rule.endings,
    placeholder: t("names.endingsPh"),
    onChange: function onChange(e) {
      return set({
        endings: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("names.length")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, ["short", "medium", "long"].map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "chip" + (rule.length === k ? " on" : ""),
      onClick: function onClick() {
        return set({
          length: k
        });
      }
    }, t("names.length." + k));
  }))), /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!rule.geography,
    onChange: function onChange(e) {
      return set({
        geography: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement("span", null, t("names.geography"), /*#__PURE__*/React.createElement("span", {
    className: "names-hint"
  }, " \u2014 ", t("names.geographyHint")))), auto.length > 0 && /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!rule.replaceAuto,
    onChange: function onChange(e) {
      return set({
        replaceAuto: e.target.checked
      });
    }
  }), t("names.replaceAuto").replace("{n}", auto.length)), manual.length > 0 && /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!rule.replaceManual,
    onChange: function onChange(e) {
      return set({
        replaceManual: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: rule.replaceManual ? "names-danger" : ""
  }, t("names.replaceManual").replace("{n}", manual.length))), /*#__PURE__*/React.createElement("div", {
    className: "names-summary"
  }, t("names.summary").replace("{n}", targets.length), kept ? " " + t("names.kept").replace("{n}", kept) : ""), targets.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "names-list"
  }, items.map(function (it) {
    var x = targets.find(function (y) {
      return y.id === it.id;
    });
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      className: "names-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "names-old"
    }, oldName(x)), /*#__PURE__*/React.createElement("span", {
      className: "names-arrow"
    }, "\u2192"), /*#__PURE__*/React.createElement("b", {
      className: "names-new"
    }, nameOf(it.id) || "—"), /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      title: t("names.reroll"),
      onClick: function onClick() {
        return reroll(it.id);
      }
    }, "\u21BB"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    disabled: !targets.length,
    onClick: function onClick() {
      setSeed(seed + 1);
      setFixed({});
    }
  }, t("names.another")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: close
  }, t("modal.cancel")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !targets.length,
    onClick: apply
  }, t("names.apply")))));
}

// where a province of a custom world lies, in one line (region panel)
function ProvinceGeo(_ref3) {
  var id = _ref3.id;
  if (!World.active() || !App.basemap.raw) return null;
  var line = "";
  try {
    var wa = worldAnalysis();
    var i = wa.feats.findIndex(function (f) {
      return String(f.id) === String(id);
    });
    if (i >= 0) line = Atlas.provinceLine(wa.an, wa.names, i, App.ui.lang === "ru" ? "ru" : "en", wa.feats[i].properties);
  } catch (e) {
    console.warn(e);
  }
  return line ? /*#__PURE__*/React.createElement("div", {
    className: "muted province-geo"
  }, line) : null;
}
function CardRow(_ref4) {
  var k = _ref4.k,
    v = _ref4.v;
  if (v == null || v === "") return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "card-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-k"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "card-v"
  }, v));
}

// a river parameter: automatic (computed from the drawing) or set by hand
function RiverParam(_ref5) {
  var label = _ref5.label,
    value = _ref5.value,
    autoLabel = _ref5.autoLabel,
    options = _ref5.options,
    _onChange = _ref5.onChange;
  var manual = value != null;
  return /*#__PURE__*/React.createElement("div", {
    className: "card-row card-param"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-k"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "card-v"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select card-select" + (manual ? " manual" : ""),
    value: manual ? String(value) : "auto",
    onChange: function onChange(e) {
      return _onChange(e.target.value === "auto" ? null : e.target.value);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "auto"
  }, t("card.auto").replace("{v}", autoLabel)), options.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: String(o.value),
      value: String(o.value)
    }, o.label);
  }))));
}
function RiverCard(_ref6) {
  var index = _ref6.index;
  useStore();
  var _React$useState9 = React.useState(false),
    _React$useState0 = _slicedToArray(_React$useState9, 2),
    help = _React$useState0[0],
    setHelp = _React$useState0[1];
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
  var mouthH = cells.length ? an.dg.h[cells[cells.length - 1]] : 0;
  var len = ri ? ri.len * km : 0;
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
  var mouthText = into ? into.name || (intoRi ? names.riverLabel[intoRi.k] : t("card.unnamed")) : rv.mouthType === "water" ? mouthWater || t("card.sea") : rv.mouthType === "edge" ? t("card.edge") : t("card.sink");
  var tributaries = rivers.filter(function (r) {
    return r.into === rv.index;
  });
  var firstProv = ri && ri.cells.length ? ri.cells[0] : -1,
    lastProv = ri && ri.cells.length ? ri.cells[ri.cells.length - 1] : -1;
  var uphill = srcH > 0 && mouthH > srcH + 50;
  var rec = (w.rivers || [])[rv.index] || {}; // live record: typing edits it in place
  var man = rec.manual || {};
  // fit the river into the part of the map the card leaves free (left of a docked card,
  // above a bottom sheet), so its source and mouth handles can be reached
  var zoom = function zoom() {
    var proj = App.basemap.proj;
    var xs = rv.pts.map(function (q) {
        return q[0];
      }),
      ys = rv.pts.map(function (q) {
        return q[1];
      });
    var x0 = Math.min.apply(Math, _toConsumableArray(xs)) - 6,
      x1 = Math.max.apply(Math, _toConsumableArray(xs)) + 6,
      y0 = Math.min.apply(Math, _toConsumableArray(ys)) - 6,
      y1 = Math.max.apply(Math, _toConsumableArray(ys)) + 6;
    var docked = window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
    MapAPI.zoomTo(docked ? [proj([x0, y0]), proj([x1 + (x1 - x0) * 0.9, y1])] : [proj([x0, y0]), proj([x1, y1 + (y1 - y0) * 1.2])]);
  };
  var minimized = !!App.ui.cardMin;
  if (minimized) {
    return /*#__PURE__*/React.createElement("div", {
      className: "info-card minimized",
      "data-export-skip": "1",
      onPointerDown: function onPointerDown(e) {
        return e.stopPropagation();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-kind"
    }, "\u3030 ", rec.name || autoName || t("card.unnamedRiver")), /*#__PURE__*/React.createElement("span", {
      className: "card-head-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn icon card-min-btn",
      title: t("card.expand"),
      onClick: function onClick() {
        return Actions.ui({
          cardMin: false
        });
      }
    }, "\u2303"), /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      onClick: function onClick() {
        return Actions.ui({
          card: null
        });
      }
    }, "\u2715"))));
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
  }, "\u3030 ", t("card.river")), /*#__PURE__*/React.createElement("span", {
    className: "card-head-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon card-min-btn",
    title: t("card.minimize"),
    onClick: function onClick() {
      return Actions.ui({
        cardMin: true
      });
    }
  }, "\u2304"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        card: null
      });
    }
  }, "\u2715"))), /*#__PURE__*/React.createElement("input", {
    className: "input card-title",
    value: rec.name || "",
    placeholder: autoName || t("card.unnamedRiver"),
    onChange: function onChange(e) {
      return World.renameRiver(rv.id, e.target.value);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.length"),
    v: len ? "≈ " + fmtNum(len) + " " + t("world.km") : null
  }), tributaries.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.withTributaries"),
    v: "≈ " + fmtNum(rv.upLen * km) + " " + t("world.km")
  }) : null, /*#__PURE__*/React.createElement(RiverParam, {
    label: t("card.size"),
    value: man.size,
    autoLabel: t("card.size" + rv.sizeAuto),
    options: [0, 1, 2, 3].map(function (v) {
      return {
        value: v,
        label: t("card.size" + v)
      };
    }),
    onChange: function onChange(v) {
      return World.setRiverManual(rv.id, {
        size: v == null ? null : +v
      });
    }
  }), /*#__PURE__*/React.createElement(RiverParam, {
    label: t("card.order"),
    value: man.order,
    autoLabel: String(rv.orderAuto),
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (v) {
      return {
        value: v,
        label: String(v)
      };
    }),
    onChange: function onChange(v) {
      return World.setRiverManual(rv.id, {
        order: v == null ? null : +v
      });
    }
  }), /*#__PURE__*/React.createElement(RiverParam, {
    label: t("card.navigable"),
    value: man.navigable,
    autoLabel: rv.navigableAuto ? t("card.yes") : t("card.no"),
    options: [{
      value: true,
      label: t("card.yes")
    }, {
      value: false,
      label: t("card.no")
    }],
    onChange: function onChange(v) {
      return World.setRiverManual(rv.id, {
        navigable: v == null ? null : v === "true"
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "card-help-toggle",
    onClick: function onClick() {
      return setHelp(!help);
    }
  }, help ? "▾ " : "ⓘ ", t("card.paramsHelp")), help && /*#__PURE__*/React.createElement("div", {
    className: "card-help"
  }, /*#__PURE__*/React.createElement("p", null, t("card.sizeHelp").replace("{a}", fmtNum(World.SIZE_KM[0])).replace("{b}", fmtNum(World.SIZE_KM[1])).replace("{c}", fmtNum(World.SIZE_KM[2]))), /*#__PURE__*/React.createElement("p", null, t("card.orderHelp")), /*#__PURE__*/React.createElement("p", null, t("card.navHelp"))), /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.source"),
    v: [srcH > 0 ? fmtNum(srcH) + " " + t("world.m") : "", firstProv >= 0 ? provName(firstProv) : "", rv.sourceType === "lake" ? t("card.fromLake") : ""].filter(Boolean).join(" · ")
  }), /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.mouth"),
    v: [mouthText, lastProv >= 0 ? provName(lastProv) : ""].filter(Boolean).join(" · ")
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-ends"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-ends-text"
  }, t("card.endsHint")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return World.reverseRiver(rv.id);
    }
  }, t("card.reverse"))), states.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.states"),
    v: states.join(" → ")
  }) : null, tributaries.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("card.tributaries"),
    v: tributaries.map(function (r) {
      var x = an.rivers.find(function (q) {
        return q.rv === r;
      });
      return r.name || (x ? names.riverLabel[x.k] : t("card.unnamed"));
    }).join(", ")
  }) : null), uphill && /*#__PURE__*/React.createElement("div", {
    className: "card-warn"
  }, t("card.uphill")), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea card-notes",
    placeholder: t("card.notes"),
    value: rec.notes || "",
    onChange: function onChange(e) {
      return World.setRiverNotes(rv.id, e.target.value);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: zoom
  }, t("card.showOnMap")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      return World.deleteRiver(rv.id);
    }
  }, t("world.deleteRiver"))));
}

// ---------- seas, gulfs and straits: the card of a water zone ----------
// the provinces along a zone's shore (the analysis grid under the province raster), kept
// per zone while the zones and the provinces stay the same
var waterCoastCache = null;
function waterCoast(zid) {
  var ws = World.waters,
    wa = worldAnalysis();
  var key = ws.key + ":" + wa.key;
  if (!waterCoastCache || waterCoastCache.key !== key) waterCoastCache = {
    key: key,
    map: new Map()
  };
  var hit = waterCoastCache.map.get(zid);
  if (hit) return hit;
  var W = World.GW,
    H = World.GH,
    zone = ws.zone,
    cellOf = wa.an.cellOf,
    z = ws.zones[zid];
  var prov = new Map(),
    lands = new Map();
  var lid = World.dataGrid().landId;
  var _z$box = _slicedToArray(z.box, 4),
    x0 = _z$box[0],
    y0 = _z$box[1],
    x1 = _z$box[2],
    y1 = _z$box[3];
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = y * W + x;
      if (zone[i] !== zid) continue;
      var nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (var _i = 0, _nbs = nbs; _i < _nbs.length; _i++) {
        var j = _nbs[_i];
        if (j < 0 || zone[j] >= 0) continue;
        var c = cellOf[j];
        if (c >= 0) prov.set(c, (prov.get(c) || 0) + 1);
        if (lid && lid[j] >= 0) lands.set(lid[j], (lands.get(lid[j]) || 0) + 1);
      }
    }
  }
  var out = {
    prov: prov,
    lands: lands
  };
  waterCoastCache.map.set(zid, out);
  return out;
}
function WaterCard(_ref7) {
  var pt = _ref7.pt;
  useStore();
  var _React$useState1 = React.useState(false),
    _React$useState10 = _slicedToArray(_React$useState1, 2),
    help = _React$useState10[0],
    setHelp = _React$useState10[1];
  React.useEffect(function () {
    World.ensureWaters()["catch"](function (e) {
      return console.warn("water zones", e);
    });
  });
  var p = App.project;
  var close = function close() {
    return Actions.ui({
      card: null,
      waterMerge: null,
      waterCut: false
    });
  };
  var ws = World.waters && World.waters.project === p ? World.waters : null;
  var zid = ws ? World.waterZoneAt(pt, true) : -1;
  if (!ws || zid < 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "info-card minimized",
      "data-export-skip": "1",
      onPointerDown: function onPointerDown(e) {
        return e.stopPropagation();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-kind"
    }, "\uD83C\uDF0A ", ws ? t("water.gone") : t("water.counting")), /*#__PURE__*/React.createElement("span", {
      className: "card-head-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      onClick: close
    }, "\u2715"))));
  }
  var z = ws.zones[zid],
    names = World.waterNames(),
    rec = names[zid];
  var km = +p.world.scaleKm || 5;
  var title = rec.name || rec.auto;
  if (App.ui.cardMin) {
    return /*#__PURE__*/React.createElement("div", {
      className: "info-card minimized",
      "data-export-skip": "1",
      onPointerDown: function onPointerDown(e) {
        return e.stopPropagation();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-kind"
    }, "\uD83C\uDF0A ", title), /*#__PURE__*/React.createElement("span", {
      className: "card-head-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn icon card-min-btn",
      title: t("card.expand"),
      onClick: function onClick() {
        return Actions.ui({
          cardMin: false
        });
      }
    }, "\u2303"), /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      onClick: close
    }, "\u2715"))));
  }
  var nameOf = function nameOf(v) {
    return names[v] ? names[v].name || names[v].auto : "";
  };
  // shores: the states whose provinces lie along it (most shore first), and the lands
  var shores = [],
    lands = 0;
  try {
    var wa = worldAnalysis(),
      co = waterCoast(zid),
      own = new Map();
    co.prov.forEach(function (n, c) {
      var f = wa.feats[c];
      var e = f ? effRegion(p, String(f.id)) : null;
      var sid = e && e.owner && p.states[e.owner] ? e.owner : "";
      own.set(sid, (own.get(sid) || 0) + n);
    });
    shores = _toConsumableArray(own.entries()).sort(function (a, b) {
      return b[1] - a[1];
    }).map(function (_ref8) {
      var _ref9 = _slicedToArray(_ref8, 1),
        sid = _ref9[0];
      return sid ? p.states[sid].name : t("card.noOwner");
    });
    lands = co.lands.size;
  } catch (e) {
    console.warn(e);
  }
  // what it joins: a strait's two waters; otherwise its straits and the waters beside it
  var nb = Object.keys(z.nb).map(Number).sort(function (a, b) {
    return z.nb[b] - z.nb[a];
  });
  var straits = nb.filter(function (v) {
    return names[v] && names[v].kind === "strait";
  });
  var others = nb.filter(function (v) {
    return straits.indexOf(v) < 0 && !(rec.kind === "strait" && z.links && z.links.indexOf(v) >= 0);
  });
  var into = World.displayRivers().filter(function (rv) {
    return rv.pts.length && World.waterZoneAt(rv.pts[rv.pts.length - 1], true) === zid;
  }).sort(function (a, b) {
    return (b.upLen || 0) - (a.upLen || 0);
  });
  var intoNamed = into.filter(function (rv) {
    return rv.name;
  }).map(function (rv) {
    return rv.name;
  });
  var edited = World.waterEdited(zid);
  var zoom = function zoom() {
    var proj = App.basemap.proj,
      b = z.box;
    MapAPI.zoomTo([proj([b[0] - 4, b[1] - 4]), proj([b[2] + 4, b[3] + 4])]);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "info-card water-card",
    "data-export-skip": "1",
    onPointerDown: function onPointerDown(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-kind"
  }, "\uD83C\uDF0A ", t("water.kind." + rec.kind)), /*#__PURE__*/React.createElement("span", {
    className: "card-head-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon card-min-btn",
    title: t("card.minimize"),
    onClick: function onClick() {
      return Actions.ui({
        cardMin: true
      });
    }
  }, "\u2304"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: close
  }, "\u2715"))), rec.label ? /*#__PURE__*/React.createElement("div", {
    className: "card-title-static"
  }, rec.name, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("water.fromLabel"))) : /*#__PURE__*/React.createElement("input", {
    className: "input card-title",
    value: rec.name,
    placeholder: rec.auto,
    onChange: function onChange(e) {
      return World.setWaterZone(zid, {
        name: e.target.value
      }, {
        undo: false
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, /*#__PURE__*/React.createElement(RiverParam, {
    label: t("water.kindLabel"),
    value: rec.kindSet ? rec.kind : null,
    autoLabel: t("water.kind." + rec.kindAuto),
    options: World.WATER_KINDS.map(function (k) {
      return {
        value: k,
        label: t("water.kind." + k)
      };
    }),
    onChange: function onChange(v) {
      return World.setWaterZone(zid, {
        kind: v
      });
    }
  }), /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.area"),
    v: "≈ " + fmtNum(Math.round(z.area * km * km / 100) * 100) + " " + t("world.km") + "²"
  }), rec.kind === "strait" && z.links && z.links.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.joins"),
    v: z.links.map(nameOf).join(" — ")
  }) : null, rec.kind !== "strait" && straits.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.straits"),
    v: straits.map(nameOf).join(", ")
  }) : null, others.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.neighbours"),
    v: others.map(nameOf).join(", ")
  }) : null, /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.shores"),
    v: shores.length ? shores.slice(0, 6).join(", ") + (shores.length > 6 ? " " + t("water.more").replace("{n}", shores.length - 6) : "") : t("water.noShore")
  }), lands > 1 ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.lands"),
    v: String(lands)
  }) : null, into.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.rivers"),
    v: intoNamed.length ? intoNamed.slice(0, 4).join(", ") + (into.length > Math.min(4, intoNamed.length) ? " " + t("water.more").replace("{n}", into.length - Math.min(4, intoNamed.length)) : "") : String(into.length)
  }) : null, /*#__PURE__*/React.createElement("button", {
    className: "card-help-toggle",
    onClick: function onClick() {
      return setHelp(!help);
    }
  }, help ? "▾ " : "ⓘ ", t("water.howTitle")), help && /*#__PURE__*/React.createElement("div", {
    className: "card-help"
  }, /*#__PURE__*/React.createElement("p", null, t("water.how")))), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea card-notes",
    placeholder: t("card.notes"),
    value: rec.notes,
    onChange: function onChange(e) {
      return World.setWaterZone(zid, {
        notes: e.target.value
      }, {
        undo: false
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline" + (App.ui.waterMerge ? " on" : ""),
    onClick: function onClick() {
      return Actions.ui({
        waterMerge: App.ui.waterMerge ? null : pt,
        waterCut: false
      });
    }
  }, t("water.merge")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline" + (App.ui.waterCut ? " on" : ""),
    onClick: function onClick() {
      return Actions.ui({
        waterCut: !App.ui.waterCut,
        waterMerge: null
      });
    }
  }, t("water.cut")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: zoom
  }, t("card.showOnMap")), edited && /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      return World.resetWaterZone(zid);
    }
  }, t("water.reset"))));
}

// ---------- regions: provinces grouped by the painter ----------
// feature id → index into the analysis (kept with the analysis)
function analysisIndex(wa) {
  if (!wa.idxOf) wa.idxOf = new Map(wa.feats.map(function (f, i) {
    return [String(f.id), i];
  }));
  return wa.idxOf;
}
// regions made from the atlas's own areas (neighbouring provinces of one owner with shared
// geography) for every province in no region yet — one undo step, to rename and adjust
function suggestMacroRegions() {
  var p = App.project;
  var wa = worldAnalysis();
  var lang = App.ui.lang === "ru" ? "ru" : "en";
  var ownerOf = function ownerOf(i) {
    var e = effRegion(p, String(wa.feats[i].id));
    return e && e.owner && p.states[e.owner] ? e.owner : null;
  };
  var provName = function provName(i) {
    var f = wa.feats[i],
      r = p.regions[String(f.id)];
    return r && r.name || f.properties && f.properties.name || String(f.id);
  };
  var areas = Atlas.areas(wa.an, wa.names, wa.feats, ownerOf, lang, provName, function (i) {
    return !!window.macroRegionOf(p, wa.feats[i].id);
  });
  if (!areas.length) {
    Actions.toast(t("mregion.suggestNone"));
    return 0;
  }
  var rank = function rank(o) {
    var k = p.stateOrder.indexOf(o);
    return k < 0 ? 1e9 : k;
  };
  areas.sort(function (a, b) {
    return rank(a.owner) - rank(b.owner) || b.area - a.area;
  });
  // a name used twice gets what the area is named after (the sea, the river), then whose
  // it is, then a number
  var taken = new Set(Object.values(p.macroRegions || {}).map(function (r) {
    return r.name;
  }));
  var tally = function tally(names) {
    var c = {};
    names.forEach(function (n) {
      c[n] = (c[n] || 0) + 1;
    });
    return c;
  };
  var names = areas.map(function (a) {
    return a.name;
  });
  var c = tally(names);
  names = names.map(function (n, k) {
    return c[n] > 1 && areas[k].feature ? n + " (" + areas[k].feature + ")" : n;
  });
  c = tally(names);
  names = names.map(function (n, k) {
    return c[n] > 1 || taken.has(n) ? n + " — " + (areas[k].owner && p.states[areas[k].owner] ? p.states[areas[k].owner].name : t("legend.unowned")) : n;
  });
  var list = areas.map(function (a, k) {
    var name = names[k];
    var base = name;
    for (var n = 2; taken.has(name); n++) name = base + " " + n;
    taken.add(name);
    return {
      name: name,
      pids: a.provinces.map(function (i) {
        return String(wa.feats[i].id);
      })
    };
  });
  Actions.addMacroRegions(list);
  Actions.toast(t("mregion.suggested").replace("{n}", list.length));
  return list.length;
}
function MacroRegionCard(_ref0) {
  var id = _ref0.id;
  useStore();
  var p = App.project;
  var mr = p && p.macroRegions && p.macroRegions[id];
  if (!mr) return null;
  var close = function close() {
    return Actions.ui({
      card: null
    });
  };
  var pids = Object.keys(p.macroRegionOf || {}).filter(function (pid) {
    return p.macroRegionOf[pid] === id && App.basemap.byId[pid];
  });
  if (App.ui.cardMin) {
    return /*#__PURE__*/React.createElement("div", {
      className: "info-card minimized",
      "data-export-skip": "1",
      onPointerDown: function onPointerDown(e) {
        return e.stopPropagation();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-kind"
    }, /*#__PURE__*/React.createElement("span", {
      className: "state-swatch",
      style: {
        background: mr.color
      }
    }), " ", mr.name), /*#__PURE__*/React.createElement("span", {
      className: "card-head-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn icon card-min-btn",
      title: t("card.expand"),
      onClick: function onClick() {
        return Actions.ui({
          cardMin: false
        });
      }
    }, "\u2303"), /*#__PURE__*/React.createElement("button", {
      className: "btn icon",
      onClick: close
    }, "\u2715"))));
  }
  // what the analysis says about its provinces
  var km = +(p.world && p.world.scaleKm) || 5;
  var area = 0,
    states = [],
    lands = 0,
    terrain = "";
  try {
    var wa = worldAnalysis(),
      idxOf = analysisIndex(wa);
    var own = new Map(),
      landSet = new Set(),
      idx = [];
    pids.forEach(function (pid) {
      var i = idxOf.get(pid);
      if (i == null) return;
      idx.push(i);
      var c = wa.an.cells[i];
      area += c.land;
      c.lands.forEach(function (v, k) {
        return landSet.add(k);
      });
      var e = effRegion(p, pid);
      var sid = e && e.owner && p.states[e.owner] ? e.owner : "";
      own.set(sid, (own.get(sid) || 0) + 1);
    });
    states = _toConsumableArray(own.entries()).sort(function (a, b) {
      return b[1] - a[1];
    }).map(function (_ref1) {
      var _ref10 = _slicedToArray(_ref1, 2),
        sid = _ref10[0],
        n = _ref10[1];
      return (sid ? p.states[sid].name : t("card.noOwner")) + (own.size > 1 ? " (" + n + ")" : "");
    });
    lands = landSet.size;
    terrain = Atlas.terrainPct(wa.an, idx, App.ui.lang === "ru" ? "ru" : "en");
  } catch (e) {
    console.warn(e);
  }
  var set = function set(patch) {
    return Actions.setMacroRegion(id, patch, {
      undo: false
    });
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
  }, "\u25A6 ", t("mregion.card")), /*#__PURE__*/React.createElement("span", {
    className: "card-head-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon card-min-btn",
    title: t("card.minimize"),
    onClick: function onClick() {
      return Actions.ui({
        cardMin: true
      });
    }
  }, "\u2304"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: close
  }, "\u2715"))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: mr.color,
    onChange: function onChange(e) {
      return Actions.setMacroRegion(id, {
        color: e.target.value
      }, {
        undo: false
      });
    }
  }), /*#__PURE__*/React.createElement("input", {
    className: "input card-title",
    value: mr.name,
    placeholder: t("mregion.namePh"),
    onChange: function onChange(e) {
      return set({
        name: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "card-grid"
  }, /*#__PURE__*/React.createElement(CardRow, {
    k: t("mregion.provinces"),
    v: String(pids.length)
  }), area ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("water.area"),
    v: "≈ " + fmtNum(Math.round(area * km * km / 100) * 100) + " " + t("world.km") + "²"
  }) : null, states.length ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("mregion.states"),
    v: states.join(", ")
  }) : null, lands > 1 ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("mregion.lands"),
    v: String(lands)
  }) : null, terrain ? /*#__PURE__*/React.createElement(CardRow, {
    k: t("mregion.terrain"),
    v: terrain
  }) : null, !pids.length && /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("mregion.emptyHint"))), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea card-notes",
    placeholder: t("card.notes"),
    value: mr.notes || "",
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
      Actions.setPref({
        leftView: "regions"
      });
      Actions.ui({
        activeMacroRegion: id,
        tool: "paint"
      });
    }
  }, t("mregion.paint")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    disabled: !pids.length,
    onClick: function onClick() {
      Actions.select(pids, false);
      Actions.ui({
        card: {
          kind: "macroRegion",
          id: id
        }
      });
    }
  }, t("mregion.select")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      if (confirm(t("mregion.deleteAsk").replace("{r}", mr.name))) Actions.deleteMacroRegion(id);
    }
  }, t("mregion.delete"))));
}

// what a tap or a stroke on the map does now: join the zone to another, or divide it
function WaterModeBar() {
  useStore();
  var cut = !!App.ui.waterCut;
  return /*#__PURE__*/React.createElement("div", {
    className: "geom-bar road-bar",
    "data-export-skip": "1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t(cut ? "water.cutHint" : "water.mergeHint")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        waterCut: false,
        waterMerge: null
      });
    }
  }, t("edit.cancel")));
}
function WorldCard() {
  useStore();
  var card = App.ui.card;
  if (!card) return null;
  if (card.kind === "river" && World.active()) return /*#__PURE__*/React.createElement(RiverCard, {
    index: card.index
  });
  if (card.kind === "water" && World.active()) return /*#__PURE__*/React.createElement(WaterCard, {
    pt: card.pt
  });
  if (card.kind === "macroRegion" && World.active()) return /*#__PURE__*/React.createElement(MacroRegionCard, {
    id: card.id
  });
  if (card.kind === "object" && window.ObjectCard) return /*#__PURE__*/React.createElement(ObjectCard, {
    id: card.id
  });
  if ((card.kind === "label" || card.kind === "stateLabel") && window.LabelCard) return /*#__PURE__*/React.createElement(LabelCard, {
    card: card
  });
  return null;
}
function AtlasModal() {
  useStore();
  var detail = ["overview", "areas", "provinces"].indexOf(App.ui.atlasDetail) >= 0 ? App.ui.atlasDetail : "areas";
  // the atlas describes the climate too: make sure the analysis matches the map
  React.useEffect(function () {
    World.ensureAnalysis()["catch"](function (e) {
      return console.warn(e);
    });
    World.ensureWaters()["catch"](function (e) {
      return console.warn(e);
    }); // seas, gulfs and straits
  }, []);
  var hyRev = World.hydroFresh() ? World.hydro.rev : 0;
  var wKey = World.watersFresh() ? World.waters.key + JSON.stringify((App.project.world.waters || {}).names || []) : "";
  var text = React.useMemo(function () {
    try {
      return Atlas.build({
        detail: detail
      });
    } catch (e) {
      console.error(e);
      return String(e);
    }
  }, [detail, App.ui.lang, hyRev, wKey]);
  var areaRef = React.useRef(null);
  var copy = /*#__PURE__*/function () {
    var _ref11 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
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
      return _ref11.apply(this, arguments);
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
  }, t("world.atlasDesc")), /*#__PURE__*/React.createElement("div", {
    className: "wp-field"
  }, /*#__PURE__*/React.createElement("span", null, t("world.atlasDetail")), /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, ["overview", "areas", "provinces"].map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "chip" + (detail === k ? " on" : ""),
      onClick: function onClick() {
        return Actions.setPref({
          atlasDetail: k
        });
      }
    }, t("world.atlasDetail." + k));
  })), /*#__PURE__*/React.createElement("span", {
    className: "names-hint"
  }, t("world.atlasDetailHint." + detail))), /*#__PURE__*/React.createElement("textarea", {
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
  fmtNum: fmtNum,
  GeoSheet: GeoSheet,
  GeoBar: GeoBar,
  CutBar: CutBar,
  ProvinceGeo: ProvinceGeo,
  NameRuleModal: NameRuleModal,
  WaterModeBar: WaterModeBar,
  suggestMacroRegions: suggestMacroRegions
});
//# sourceMappingURL=world.js.map
