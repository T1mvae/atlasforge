"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
// AtlasForge — custom world UI: brush palette (floating over the map) and the AI atlas modal
function WorldPalette() {
  useStore();
  var p = App.project;
  if (!p || !p.world) return null;
  var w = p.world;
  var brush = App.ui.worldBrush || "land";
  var size = App.ui.worldSize || 12;
  var collapsed = !!App.ui.worldPaletteCollapsed;
  var _React$useState = React.useState(false),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    riversOpen = _React$useState2[0],
    setRiversOpen = _React$useState2[1];
  var km = +w.scaleKm || 5;
  var stale = w.genRev != null && w.genRev !== w.rev;
  var hasProvinces = App.basemap.count > 0;
  var generate = function generate() {
    if (hasProvinces && !confirm(t("world.regenAsk"))) return;
    Actions.toast(t("world.generating"));
    setTimeout(function () {
      return World.generate();
    }, 40); // let the toast paint first
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
    className: "wp-brushes"
  }, World.BRUSHES.map(function (b) {
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
  })), /*#__PURE__*/React.createElement("label", {
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
  })), /*#__PURE__*/React.createElement("label", {
    className: "check-row wp-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: App.ui.worldPressure !== false,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldPressure: e.target.checked
      });
    }
  }), t("world.pressure"), window.World && World.pressureSupport() === "no" ? " — " + t("input.noPressureShort") : ""), /*#__PURE__*/React.createElement("label", {
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
  })), /*#__PURE__*/React.createElement("div", {
    className: "wp-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "wp-section"
  }, t("world.provinces")), /*#__PURE__*/React.createElement("label", {
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
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn " + (stale || !hasProvinces ? "primary" : "outline"),
    onClick: generate
  }, hasProvinces ? t("world.regenerate") : t("world.generate")), stale && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.stale")), /*#__PURE__*/React.createElement("div", {
    className: "wp-sep"
  }), /*#__PURE__*/React.createElement("label", {
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
  }, t("world.km"), " \xB7 ", t("world.mapSize").replace("{w}", Math.round(World.GW * km).toLocaleString()).replace("{h}", Math.round(World.GH * km).toLocaleString())))), /*#__PURE__*/React.createElement("label", {
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
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn outline wp-toggle",
    onClick: function onClick() {
      return setRiversOpen(function (v) {
        return !v;
      });
    }
  }, riversOpen ? "▾ " : "▸ ", t("world.rivers"), " (", (w.rivers || []).length, ")"), riversOpen && /*#__PURE__*/React.createElement("div", {
    className: "wp-rivers"
  }, (w.rivers || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "wp-note"
  }, t("world.noRivers")), (w.rivers || []).map(function (rv) {
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
    className: "wp-sep"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !hasProvinces,
    onClick: function onClick() {
      return Actions.ui({
        modal: "atlas"
      });
    }
  }, t("world.atlas")), /*#__PURE__*/React.createElement("div", {
    className: "wp-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      if (App.basemap.count === 0 && !w.elev || confirm(t("world.randomAsk"))) World.randomContinent();
    }
  }, t("world.random")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      if (confirm(t("world.clearAsk"))) World.clearTerrain();
    }
  }, t("world.clear"))), /*#__PURE__*/React.createElement("div", {
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
    // quadratic: fine control over small brushes
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
function AtlasModal() {
  useStore();
  var _React$useState3 = React.useState(true),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    withProvinces = _React$useState4[0],
    setWithProvinces = _React$useState4[1];
  var text = React.useMemo(function () {
    try {
      return World.buildAtlas({
        provinces: withProvinces
      });
    } catch (e) {
      console.error(e);
      return String(e);
    }
  }, [withProvinces, App.ui.lang]);
  var areaRef = React.useRef(null);
  var copy = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
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
      return _ref.apply(this, arguments);
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
  WorldSizeRail: WorldSizeRail
});
//# sourceMappingURL=world.js.map
