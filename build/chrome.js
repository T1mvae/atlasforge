"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
// AtlasForge — top bar, menus, search, legend, timeline, modals, toast
function MenuButton(_ref) {
  var id = _ref.id,
    label = _ref.label,
    children = _ref.children,
    right = _ref.right;
  useStore();
  var open = App.ui.menu === id;
  return /*#__PURE__*/React.createElement("div", {
    className: "menu-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: function onClick(e) {
      e.stopPropagation();
      Actions.ui({
        menu: open ? null : id
      });
    }
  }, label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      opacity: 0.6
    }
  }, "\u25BC")), open && /*#__PURE__*/React.createElement("div", {
    className: "menu" + (right ? " right" : ""),
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, children));
}
function MenuItem(_ref2) {
  var label = _ref2.label,
    kbd = _ref2.kbd,
    danger = _ref2.danger,
    _onClick = _ref2.onClick,
    disabled = _ref2.disabled;
  return /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    disabled: disabled,
    style: danger ? {
      color: "var(--danger)"
    } : null,
    onClick: function onClick() {
      Actions.ui({
        menu: null
      });
      _onClick && _onClick();
    }
  }, /*#__PURE__*/React.createElement("span", null, label), kbd && /*#__PURE__*/React.createElement("span", {
    className: "kbd"
  }, kbd));
}
function SearchBox() {
  useStore();
  var _React$useState = React.useState(""),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    q = _React$useState2[0],
    setQ = _React$useState2[1];
  var results = React.useMemo(function () {
    if (q.trim().length < 2 || App.basemap.status !== "ready") return [];
    var needle = q.trim().toLowerCase();
    var out = [];
    var p = App.project;
    var _iterator = _createForOfIteratorHelper(p.stateOrder),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var sid = _step.value;
        var s = p.states[sid];
        if (s && s.name.toLowerCase().includes(needle)) out.push({
          kind: "state",
          id: sid,
          name: s.name,
          color: s.color
        });
        if (out.length >= 4) break;
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    var _iterator2 = _createForOfIteratorHelper(App.basemap.features),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var f = _step2.value;
        var r = p.regions[f.id];
        var nm = r && r.name || f.name;
        if (nm.toLowerCase().includes(needle)) out.push({
          kind: "region",
          id: f.id,
          name: nm,
          sub: f.country
        });
        if (out.length >= 12) break;
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
    return out;
  }, [q, App.version]);
  var pick = function pick(res) {
    setQ("");
    if (res.kind === "region") {
      var f = App.basemap.byId[res.id];
      Actions.select([res.id], false);
      if (f) MapAPI.zoomTo(f.b);
    } else {
      Actions.ui({
        activeState: res.id,
        panel: "state"
      });
      var p = App.project;
      var b = null;
      for (var rid in p.regions) {
        if (p.regions[rid].owner !== res.id) continue;
        var _f = App.basemap.byId[rid];
        if (!_f) continue;
        b = b ? [[Math.min(b[0][0], _f.b[0][0]), Math.min(b[0][1], _f.b[0][1])], [Math.max(b[1][0], _f.b[1][0]), Math.max(b[1][1], _f.b[1][1])]] : _f.b;
      }
      if (b) MapAPI.zoomTo(b);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "search-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "search-icon"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "4.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.4 9.4 L13 13"
  }))), /*#__PURE__*/React.createElement("input", {
    className: "search-input",
    value: q,
    placeholder: t("search.placeholder"),
    onChange: function onChange(e) {
      return setQ(e.target.value);
    }
  }), results.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "search-results"
  }, results.map(function (r, i) {
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: "search-res-item",
      onClick: function onClick() {
        return pick(r);
      }
    }, r.kind === "state" && /*#__PURE__*/React.createElement("span", {
      className: "state-swatch",
      style: {
        background: r.color
      }
    }), /*#__PURE__*/React.createElement("span", null, r.name, r.sub ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-faint)"
      }
    }, " \xB7 ", r.sub) : null), /*#__PURE__*/React.createElement("span", {
      className: "search-res-kind"
    }, t("search." + r.kind)));
  })));
}
function TopBar() {
  useStore();
  var p = App.project;
  return /*#__PURE__*/React.createElement("div", {
    className: "topbar",
    "data-screen-label": "Top bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon panel-toggle" + (App.ui.leftOpen ? " on" : ""),
    title: t("input.toggleLeft"),
    onClick: function onClick() {
      return Actions.setPref({
        leftOpen: !App.ui.leftOpen
      });
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "12",
    height: "10",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 3 V13"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand-glyph"
  }, "AF"), /*#__PURE__*/React.createElement("span", {
    className: "brand-name"
  }, t("app.title"))), p && /*#__PURE__*/React.createElement("input", {
    className: "proj-name",
    value: p.name,
    onChange: function onChange(e) {
      return Actions.mut(function (pr) {
        pr.name = e.target.value;
      }, {
        undo: false
      });
    }
  }), /*#__PURE__*/React.createElement(MenuButton, {
    id: "file",
    label: t("menu.file")
  }, window.ProjectStore && ProjectStore.available && /*#__PURE__*/React.createElement(MenuItem, {
    label: t("lib.menu"),
    onClick: function onClick() {
      return Actions.ui({
        modal: "library"
      });
    }
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.newProject"),
    onClick: function onClick() {
      return Actions.ui({
        modal: "templates"
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "menu-sep"
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.importProject"),
    onClick: function onClick() {
      return Exports.importProject();
    }
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.importGeo"),
    onClick: function onClick() {
      return Exports.importGeoJSON();
    }
  })), /*#__PURE__*/React.createElement(MenuButton, {
    id: "export",
    label: t("menu.export")
  }, /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportImage"),
    onClick: function onClick() {
      return Actions.ui({
        modal: "export"
      });
    }
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportSvg"),
    onClick: function onClick() {
      return Exports.svg();
    }
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportJson"),
    onClick: function onClick() {
      return Exports.json();
    }
  }), window.World && World.active() && /*#__PURE__*/React.createElement(MenuItem, {
    label: t("world.atlas"),
    disabled: !App.basemap.count,
    onClick: function onClick() {
      return Actions.ui({
        modal: "atlas"
      });
    }
  }), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement("div", {
    className: "menu-sep"
  }), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportRegions"),
    onClick: function onClick() {
      return Exports.regionsGeoJSON(false);
    }
  }), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportRegionsSimplified"),
    onClick: function onClick() {
      return Exports.regionsGeoJSON(true);
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "tb-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("edit.undo") + " (Ctrl+Z)",
    disabled: !App.undoStack.length,
    onClick: function onClick() {
      return Actions.undo();
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 3 L3 6 L6 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 6 H10 a3.5 3.5 0 0 1 0 7 H6"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("edit.redo") + " (Ctrl+Y)",
    disabled: !App.redoStack.length,
    onClick: function onClick() {
      return Actions.redo();
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 3 L13 6 L10 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13 6 H6 a3.5 3.5 0 0 0 0 7 H10"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tb-spacer"
  }), /*#__PURE__*/React.createElement(SearchBox, null), /*#__PURE__*/React.createElement("div", {
    className: "tb-sep"
  }), /*#__PURE__*/React.createElement(MenuButton, {
    id: "input",
    label: /*#__PURE__*/React.createElement("span", {
      className: "input-menu-label"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.4"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M11 2.5 L13.5 5 L6 12.5 L3 13 L3.5 10 Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9.5 4 L12 6.5"
    }))),
    right: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-title"
  }, t("input.title")), /*#__PURE__*/React.createElement("label", {
    className: "menu-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: App.ui.pencilOnly !== false,
    onChange: function onChange(e) {
      return Actions.setPref({
        pencilOnly: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement("span", null, t("input.pencilOnly"), /*#__PURE__*/React.createElement("small", null, t("input.pencilOnlyHint")))), /*#__PURE__*/React.createElement("label", {
    className: "menu-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: App.ui.worldPressure !== false,
    onChange: function onChange(e) {
      return Actions.setPref({
        worldPressure: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement("span", null, t("world.pressure"), /*#__PURE__*/React.createElement("small", null, window.World && World.pressureSupport() === "no" ? t("input.noPressure") : t("input.pressureHint")))), /*#__PURE__*/React.createElement("label", {
    className: "menu-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!App.ui.tiltSize,
    onChange: function onChange(e) {
      return Actions.setPref({
        tiltSize: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement("span", null, t("input.tilt"), /*#__PURE__*/React.createElement("small", null, t("input.tiltHint")))), /*#__PURE__*/React.createElement("div", {
    className: "menu-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "menu-note"
  }, t("input.gestures"))), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    title: "Language",
    onClick: function onClick() {
      return Actions.setLang(App.ui.lang === "ru" ? "en" : "ru");
    }
  }, App.ui.lang === "ru" ? "RU" : "EN"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("theme.toggle"),
    onClick: function onClick() {
      return Actions.setTheme(App.ui.theme === "dark" ? "light" : "dark");
    }
  }, App.ui.theme === "dark" ? "☾" : "☀"), /*#__PURE__*/React.createElement("button", {
    className: "btn icon panel-toggle" + (App.ui.rightOpen ? " on" : ""),
    title: t("input.toggleRight"),
    onClick: function onClick() {
      return Actions.setPref({
        rightOpen: !App.ui.rightOpen
      });
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "12",
    height: "10",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 3 V13"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: "Presentation (P)",
    onClick: function onClick() {
      return Actions.ui({
        present: true,
        menu: null
      });
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "3",
    width: "12",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11 V13.5 M5.5 13.5 H10.5"
  }))));
}
function Legend() {
  useStore();
  var ref = React.useRef(null);
  var drag = React.useRef(null);
  var p = App.project;
  if (!p || !App.ui.showLegend || App.basemap.status !== "ready") return null;
  var counts = stateStats();
  var pos = App.ui.legendPos || {
    x: 276,
    y: 56
  };
  var rows = p.stateOrder.map(function (id) {
    return p.states[id];
  }).filter(Boolean);
  var metadataField = ["culture", "religion", "language"].includes(p.displayMode) ? p.displayMode : null;
  var metadataRows = metadataField && window.Metadata ? Metadata.legend(p, metadataField) : [];
  if (!metadataField && !rows.length) return null;
  if (metadataField && !metadataRows.length) return null;
  var onDown = function onDown(e) {
    drag.current = {
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.x,
      oy: pos.y
    };
    var onMove = function onMove(ev) {
      if (!drag.current) return;
      Actions.ui({
        legendPos: {
          x: drag.current.ox + ev.clientX - drag.current.sx,
          y: drag.current.oy + ev.clientY - drag.current.sy
        }
      });
    };
    var _onUp = function onUp() {
      drag.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", _onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", _onUp);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "legend",
    ref: ref,
    style: {
      left: pos.x,
      top: pos.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "legend-head",
    onPointerDown: onDown
  }, /*#__PURE__*/React.createElement("span", null, metadataField ? t("legend." + metadataField) : t("legend.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    style: {
      height: 18,
      width: 18,
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.ui({
        showLegend: false
      });
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "legend-body"
  }, metadataField ? metadataRows.map(function (row) {
    return /*#__PURE__*/React.createElement("div", {
      key: row.name,
      className: "legend-row",
      style: {
        cursor: "pointer"
      },
      onClick: function onClick() {
        return Actions.selectByMetadata(metadataField, row.name);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "state-swatch",
      style: {
        background: row.color
      }
    }), /*#__PURE__*/React.createElement("span", null, row.name), /*#__PURE__*/React.createElement("span", {
      className: "legend-count"
    }, row.count));
  }) : rows.map(function (s) {
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: "legend-row",
      style: {
        cursor: "pointer"
      },
      onClick: function onClick() {
        return Actions.ui({
          activeState: s.id,
          panel: "state"
        });
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "state-swatch",
      style: {
        background: s.color
      }
    }), s.flag && /*#__PURE__*/React.createElement("img", {
      className: "state-flag-mini",
      src: s.flag,
      alt: ""
    }), /*#__PURE__*/React.createElement("span", null, s.name), /*#__PURE__*/React.createElement("span", {
      className: "legend-count"
    }, counts[s.id] || 0));
  })));
}
function Timeline() {
  useStore();
  var p = App.project;
  var playRef = React.useRef(null);
  if (!p) return null;
  var addYear = function addYear() {
    var v = prompt(t("timeline.prompt"), p.currentYear != null ? String(p.currentYear + 10) : "1900");
    if (v == null) return;
    var y = parseInt(v, 10);
    if (Number.isFinite(y)) Actions.addYear(y);
  };
  var play = function play() {
    if (App.ui.playing) {
      clearInterval(playRef.current);
      Actions.ui({
        playing: false
      });
      return;
    }
    if (p.years.length < 2) return;
    var i = 0;
    Actions.gotoYear(p.years[0]);
    Actions.ui({
      playing: true
    });
    playRef.current = setInterval(function () {
      i++;
      if (i >= App.project.years.length) {
        clearInterval(playRef.current);
        Actions.ui({
          playing: false
        });
        return;
      }
      Actions.gotoYear(App.project.years[i]);
    }, 1400);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "timeline",
    "data-screen-label": "Timeline"
  }, /*#__PURE__*/React.createElement("span", {
    className: "timeline-label"
  }, t("timeline.title")), /*#__PURE__*/React.createElement("div", {
    className: "year-chips"
  }, p.years.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, t("timeline.hint")), p.years.map(function (y) {
    return /*#__PURE__*/React.createElement("button", {
      key: y,
      className: "year-chip" + (p.currentYear === y ? " current" : ""),
      onClick: function onClick() {
        return Actions.gotoYear(y);
      },
      onContextMenu: function onContextMenu(e) {
        e.preventDefault();
        if (confirm(t("timeline.deleteYear"))) Actions.deleteYear(y);
      }
    }, y < 0 ? Math.abs(y) + " BC" : y);
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: addYear
  }, t("timeline.addYear")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    disabled: p.years.length < 2,
    onClick: play
  }, App.ui.playing ? t("timeline.stop") : t("timeline.play")));
}

// template id -> i18n key prefix of its name (library cards show which map a project uses)
var TEMPLATE_KEYS = {
  admin1: "tmpl.admin1",
  world_hoi4: "tmpl.worldhoi4",
  owb: "tmpl.owb",
  agot: "tmpl.agot",
  blank: "tmpl.blank",
  world: "tmpl.world",
  agot_duchies: "tmpl.agotd",
  agot_kingdoms: "tmpl.agotk",
  agot_baronies: "tmpl.agotb",
  best_regions_world: "tmpl.best",
  atlas_world: "tmpl.atlas",
  world_states: "tmpl.worldstates",
  detailed_province_world: "tmpl.dpw",
  provinces: "tmpl.provinces",
  strategic: "tmpl.strategic",
  "world-50": "tmpl.world50",
  custom: "tmpl.custom"
};
var templateName = function templateName(id) {
  return TEMPLATE_KEYS[id] ? t(TEMPLATE_KEYS[id] + ".name") : id;
};

// ---------- project library ("My maps") ----------
function LibraryModal() {
  useStore();
  var _React$useState3 = React.useState(null),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    items = _React$useState4[0],
    setItems = _React$useState4[1];
  var _React$useState5 = React.useState("maps"),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    tab = _React$useState6[0],
    setTab = _React$useState6[1];
  var _React$useState7 = React.useState({}),
    _React$useState8 = _slicedToArray(_React$useState7, 2),
    thumbs = _React$useState8[0],
    setThumbs = _React$useState8[1];
  var _React$useState9 = React.useState(false),
    _React$useState0 = _slicedToArray(_React$useState9, 2),
    busy = _React$useState0[0],
    setBusy = _React$useState0[1];
  var store = window.ProjectStore;
  var canClose = !!App.project;
  var reload = React.useCallback(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
    var list, urls, _iterator3, _step3, it, b, _t, _t2;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          if (!(!store || !store.available)) {
            _context.n = 1;
            break;
          }
          setItems([]);
          return _context.a(2);
        case 1:
          _context.n = 2;
          return store.list();
        case 2:
          list = _context.v;
          setItems(list);
          urls = {};
          _iterator3 = _createForOfIteratorHelper(list);
          _context.p = 3;
          _iterator3.s();
        case 4:
          if ((_step3 = _iterator3.n()).done) {
            _context.n = 9;
            break;
          }
          it = _step3.value;
          _context.p = 5;
          _context.n = 6;
          return store.thumb(it.id);
        case 6:
          b = _context.v;
          if (b) urls[it.id] = URL.createObjectURL(b);
          _context.n = 8;
          break;
        case 7:
          _context.p = 7;
          _t = _context.v;
        case 8:
          _context.n = 4;
          break;
        case 9:
          _context.n = 11;
          break;
        case 10:
          _context.p = 10;
          _t2 = _context.v;
          _iterator3.e(_t2);
        case 11:
          _context.p = 11;
          _iterator3.f();
          return _context.f(11);
        case 12:
          setThumbs(function (prev) {
            Object.values(prev).forEach(function (u) {
              return URL.revokeObjectURL(u);
            });
            return urls;
          });
        case 13:
          return _context.a(2);
      }
    }, _callee, null, [[5, 7], [3, 10, 11, 12]]);
  })), []);
  React.useEffect(function () {
    _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            if (!App.project) {
              _context2.n = 2;
              break;
            }
            _context2.n = 1;
            return Exports.saveThumbnail();
          case 1:
            _context2.n = 2;
            return Actions.saveNow();
          case 2:
            reload();
          case 3:
            return _context2.a(2);
        }
      }, _callee2);
    }))();
    return function () {
      return setThumbs(function (prev) {
        Object.values(prev).forEach(function (u) {
          return URL.revokeObjectURL(u);
        });
        return {};
      });
    };
  }, []);
  var act = /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(fn) {
      return _regenerator().w(function (_context3) {
        while (1) switch (_context3.p = _context3.n) {
          case 0:
            setBusy(true);
            _context3.p = 1;
            _context3.n = 2;
            return fn();
          case 2:
            _context3.p = 2;
            setBusy(false);
            reload();
            return _context3.f(2);
          case 3:
            return _context3.a(2);
        }
      }, _callee3, null, [[1,, 2, 3]]);
    }));
    return function act(_x) {
      return _ref5.apply(this, arguments);
    };
  }();
  var open = function open(it) {
    return act(function () {
      return Actions.openProject(it.id);
    });
  };
  var rename = function rename(it) {
    var name = prompt(t("lib.renameAsk"), it.name);
    if (name == null) return;
    act(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.n) {
          case 0:
            _context4.n = 1;
            return store.rename(it.id, name);
          case 1:
            if (App.projectId === it.id && App.project) Actions.mut(function (p) {
              p.name = name;
            }, {
              undo: false
            });
          case 2:
            return _context4.a(2);
        }
      }, _callee4);
    })));
  };
  var duplicate = function duplicate(it) {
    return act(function () {
      return store.duplicate(it.id, uid(), " " + t("lib.copySuffix"));
    });
  };
  var exportFile = function exportFile(it) {
    return act(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5() {
      var p, name, data, _t3;
      return _regenerator().w(function (_context5) {
        while (1) switch (_context5.n) {
          case 0:
            if (!(App.projectId === it.id && App.project)) {
              _context5.n = 1;
              break;
            }
            _t3 = App.project;
            _context5.n = 3;
            break;
          case 1:
            _context5.n = 2;
            return store.load(it.id);
          case 2:
            _t3 = _context5.v;
          case 3:
            p = _t3;
            if (p) {
              _context5.n = 4;
              break;
            }
            return _context5.a(2);
          case 4:
            name = (p.name || "map").replace(/[^\w\u0400-\u04FF -]+/g, "").trim() || "map";
            data = window.World ? World.exportable(p) : p;
            window.downloadBlob(new Blob([JSON.stringify(data, null, 1)], {
              type: "application/json"
            }), name + ".atlasforge.json");
          case 5:
            return _context5.a(2);
        }
      }, _callee5);
    })));
  };
  var trash = function trash(it) {
    if (!confirm(t("lib.trashAsk").replace("{name}", it.name || t("lib.untitled")))) return;
    act(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6() {
      return _regenerator().w(function (_context6) {
        while (1) switch (_context6.n) {
          case 0:
            _context6.n = 1;
            return store.trash(it.id);
          case 1:
            if (App.projectId === it.id) Actions.closeProject();
          case 2:
            return _context6.a(2);
        }
      }, _callee6);
    })));
  };
  var restore = function restore(it) {
    return act(function () {
      return store.restore(it.id);
    });
  };
  var purge = function purge(it) {
    if (!confirm(t("lib.purgeAsk").replace("{name}", it.name || t("lib.untitled")))) return;
    act(function () {
      return store.purge(it.id);
    });
  };
  var emptyTrash = function emptyTrash() {
    var tr = (items || []).filter(function (x) {
      return x.trashed;
    });
    if (!tr.length || !confirm(t("lib.emptyTrashAsk").replace("{n}", tr.length))) return;
    act(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7() {
      var _iterator4, _step4, it, _t4;
      return _regenerator().w(function (_context7) {
        while (1) switch (_context7.p = _context7.n) {
          case 0:
            _iterator4 = _createForOfIteratorHelper(tr);
            _context7.p = 1;
            _iterator4.s();
          case 2:
            if ((_step4 = _iterator4.n()).done) {
              _context7.n = 4;
              break;
            }
            it = _step4.value;
            _context7.n = 3;
            return store.purge(it.id);
          case 3:
            _context7.n = 2;
            break;
          case 4:
            _context7.n = 6;
            break;
          case 5:
            _context7.p = 5;
            _t4 = _context7.v;
            _iterator4.e(_t4);
          case 6:
            _context7.p = 6;
            _iterator4.f();
            return _context7.f(6);
          case 7:
            return _context7.a(2);
        }
      }, _callee7, null, [[1, 5, 6, 7]]);
    })));
  };
  var fmtDate = function fmtDate(ms) {
    try {
      return new Date(ms).toLocaleString(App.ui.lang === "ru" ? "ru-RU" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  };
  var visible = (items || []).filter(function (x) {
    return tab === "trash" ? !!x.trashed : !x.trashed;
  });
  var trashCount = (items || []).filter(function (x) {
    return x.trashed;
  }).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: function onClick() {
      if (canClose) Actions.ui({
        modal: null
      });
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal library-modal",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("lib.title")), /*#__PURE__*/React.createElement("div", {
    className: "library-head-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Exports.importProject();
    }
  }, t("lib.import")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return Actions.ui({
        modal: "templates"
      });
    }
  }, "\uFF0B ", t("lib.new")), canClose && /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        modal: null
      });
    }
  }, "\u2715"))), /*#__PURE__*/React.createElement("div", {
    className: "library-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip" + (tab === "maps" ? " on" : ""),
    onClick: function onClick() {
      return setTab("maps");
    }
  }, t("lib.maps")), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (tab === "trash" ? " on" : ""),
    onClick: function onClick() {
      return setTab("trash");
    }
  }, t("lib.trash"), trashCount ? " (" + trashCount + ")" : ""), tab === "trash" && trashCount > 0 && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      marginLeft: "auto"
    },
    onClick: emptyTrash
  }, t("lib.emptyTrash"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, !store || !store.available ? /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("lib.unavailable")) : null, items && visible.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted library-empty"
  }, tab === "trash" ? t("lib.trashEmpty") : t("lib.empty")), /*#__PURE__*/React.createElement("div", {
    className: "library-grid" + (busy ? " busy" : "")
  }, visible.map(function (it) {
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      className: "library-card" + (App.projectId === it.id ? " current" : "")
    }, /*#__PURE__*/React.createElement("button", {
      className: "library-thumb",
      onClick: function onClick() {
        return tab === "trash" ? restore(it) : open(it);
      }
    }, thumbs[it.id] ? /*#__PURE__*/React.createElement("img", {
      src: thumbs[it.id],
      alt: ""
    }) : /*#__PURE__*/React.createElement("span", {
      className: "library-thumb-empty"
    }, templateName(it.basemapId)), App.projectId === it.id && /*#__PURE__*/React.createElement("span", {
      className: "library-badge"
    }, t("lib.open"))), /*#__PURE__*/React.createElement("div", {
      className: "library-meta"
    }, /*#__PURE__*/React.createElement("div", {
      className: "library-name"
    }, it.name || t("lib.untitled")), /*#__PURE__*/React.createElement("div", {
      className: "library-sub"
    }, templateName(it.basemapId), " \xB7 ", fmtDate(it.updated)), /*#__PURE__*/React.createElement("div", {
      className: "library-sub"
    }, t("lib.stats").replace("{s}", it.states || 0).replace("{r}", it.owned || 0))), /*#__PURE__*/React.createElement("div", {
      className: "library-actions"
    }, tab === "trash" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return restore(it);
      }
    }, t("lib.restore")), /*#__PURE__*/React.createElement("button", {
      className: "btn outline danger",
      onClick: function onClick() {
        return purge(it);
      }
    }, t("lib.purge"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return rename(it);
      },
      title: t("lib.rename")
    }, "\u270E"), /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return duplicate(it);
      },
      title: t("lib.duplicate")
    }, "\u29C9"), /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return exportFile(it);
      },
      title: t("lib.export")
    }, "\u21EA"), /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return trash(it);
      },
      title: t("lib.toTrash")
    }, "\uD83D\uDDD1"))));
  })))));
}

// "download for offline" chip on a template card
function OfflineChip(_ref0) {
  var id = _ref0.id;
  var _React$useState1 = React.useState("checking"),
    _React$useState10 = _slicedToArray(_React$useState1, 2),
    state = _React$useState10[0],
    setState = _React$useState10[1];
  React.useEffect(function () {
    var alive = true;
    if (!window.PWA || !PWA.templateUrls(id).length) {
      setState("none");
      return;
    }
    PWA.isTemplateOffline(id).then(function (ok) {
      if (alive) setState(ok ? "ready" : "idle");
    });
    return function () {
      alive = false;
    };
  }, [id]);
  if (state === "none" || state === "checking") return null;
  if (state === "ready") return /*#__PURE__*/React.createElement("span", {
    className: "chip offline-chip ready",
    title: t("offline.readyHint")
  }, "\u2713 ", t("offline.ready"));
  return /*#__PURE__*/React.createElement("span", {
    className: "chip offline-chip" + (state === "loading" ? " loading" : ""),
    role: "button",
    onClick: function onClick(e) {
      e.stopPropagation();
      if (state === "loading") return;
      setState("loading");
      PWA.downloadTemplate(id).then(function () {
        return setState("ready");
      }, function () {
        setState("idle");
        Actions.toast(t("offline.failed"));
      });
    }
  }, state === "loading" ? "…" : "⬇", " ", t(state === "loading" ? "offline.loading" : "offline.download"));
}
function TemplatesModal() {
  useStore();
  var _React$useState11 = React.useState("admin1"),
    _React$useState12 = _slicedToArray(_React$useState11, 2),
    choice = _React$useState12[0],
    setChoice = _React$useState12[1];
  var _React$useState13 = React.useState(false),
    _React$useState14 = _slicedToArray(_React$useState13, 2),
    showClassic = _React$useState14[0],
    setShowClassic = _React$useState14[1];
  var firstRun = !App.project;
  // The primary map plus the themed / blank starting points (all fully editable).
  var cards = [{
    id: "admin1",
    name: t("tmpl.admin1.name"),
    desc: t("tmpl.admin1.desc"),
    count: "~4600",
    feats: ["region-grid", "physical", "countries"]
  }, {
    id: "world_hoi4",
    name: t("tmpl.worldhoi4.name"),
    desc: t("tmpl.worldhoi4.desc"),
    count: "~1770",
    feats: ["region-grid", "physical", "countries"]
  }, {
    id: "owb",
    name: t("tmpl.owb.name"),
    desc: t("tmpl.owb.desc"),
    count: "~1984",
    feats: ["region-grid", "physical", "countries"]
  }, {
    id: "agot",
    name: t("tmpl.agot.name"),
    desc: t("tmpl.agot.desc"),
    count: "~4130",
    feats: ["region-grid", "physical", "countries"]
  }, {
    id: "world",
    name: t("tmpl.world.name"),
    desc: t("tmpl.world.desc"),
    count: "0",
    feats: ["paintTerrain", "aiAtlas"]
  }, {
    id: "blank",
    name: t("tmpl.blank.name"),
    desc: t("tmpl.blank.desc"),
    count: "0",
    feats: ["draw", "physical"]
  }];
  // Other base maps kept available but out of the main gallery.
  var classic = [{
    id: "agot_duchies",
    name: t("tmpl.agotd.name"),
    desc: t("tmpl.agotd.desc"),
    count: "~720"
  }, {
    id: "agot_kingdoms",
    name: t("tmpl.agotk.name"),
    desc: t("tmpl.agotk.desc"),
    count: "~68"
  }, {
    id: "agot_baronies",
    name: t("tmpl.agotb.name"),
    desc: t("tmpl.agotb.desc"),
    count: "~23110"
  }, {
    id: "best_regions_world",
    name: t("tmpl.best.name"),
    desc: t("tmpl.best.desc"),
    count: "~2550"
  }, {
    id: "atlas_world",
    name: t("tmpl.atlas.name"),
    desc: t("tmpl.atlas.desc"),
    count: "~1250"
  }, {
    id: "world_states",
    name: t("tmpl.worldstates.name"),
    desc: t("tmpl.worldstates.desc"),
    count: "~1050"
  }, {
    id: "detailed_province_world",
    name: t("tmpl.dpw.name"),
    desc: t("tmpl.dpw.desc"),
    count: "~10000"
  }, {
    id: "provinces",
    name: t("tmpl.provinces.name"),
    desc: t("tmpl.provinces.desc"),
    count: "~6500"
  }, {
    id: "strategic",
    name: t("tmpl.strategic.name"),
    desc: t("tmpl.strategic.desc"),
    count: "~2200"
  }, {
    id: "world-50",
    name: t("tmpl.world50.name"),
    desc: t("tmpl.world50.desc"),
    count: "~241"
  }, {
    id: "custom",
    name: t("tmpl.custom.name"),
    desc: t("tmpl.custom.desc"),
    count: "GeoJSON"
  }];
  var grouped = false;
  var create = function create() {
    if (choice === "custom") {
      Exports.importGeoJSON();
      return;
    }
    Actions.newProject(choice, {
      groupByCountry: false
    });
    if (choice === "world") Actions.ui({
      tool: "world",
      worldBrush: "land"
    });
  };
  var Card = function Card(c, big) {
    return /*#__PURE__*/React.createElement("button", {
      key: c.id,
      className: "tmpl-card" + (choice === c.id ? " selected" : ""),
      style: big ? {
        gridColumn: "1 / -1"
      } : null,
      onClick: function onClick() {
        return setChoice(c.id);
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tmpl-name"
    }, c.name), /*#__PURE__*/React.createElement("span", {
      className: "tmpl-desc"
    }, c.desc), c.feats && /*#__PURE__*/React.createElement("span", {
      className: "chip-row",
      style: {
        marginTop: 2
      }
    }, c.feats.map(function (f) {
      return /*#__PURE__*/React.createElement("span", {
        key: f,
        className: "chip",
        style: {
          cursor: "default"
        }
      }, t("feat." + f));
    })), /*#__PURE__*/React.createElement("span", {
      className: "tmpl-count"
    }, c.count, " ", t("stat.regions"), " ", /*#__PURE__*/React.createElement(OfflineChip, {
      id: c.id
    })));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: function onClick() {
      if (!firstRun) Actions.ui({
        modal: null
      });
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("modal.templates.title")), /*#__PURE__*/React.createElement("span", {
    className: "library-head-actions"
  }, window.ProjectStore && ProjectStore.available && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        modal: "library"
      });
    }
  }, t("lib.title")), !firstRun && /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: function onClick() {
      return Actions.ui({
        modal: null
      });
    }
  }, "\u2715"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("modal.templates.desc")), /*#__PURE__*/React.createElement("div", {
    className: "tmpl-grid"
  }, cards.map(function (c, i) {
    return Card(c, i === 0);
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      alignSelf: "flex-start",
      fontSize: 12
    },
    onClick: function onClick() {
      return setShowClassic(function (v) {
        return !v;
      });
    }
  }, showClassic ? "▾ " : "▸ ", t("tmpl.classic")), showClassic && /*#__PURE__*/React.createElement("div", {
    className: "tmpl-grid"
  }, classic.map(function (c) {
    return Card(c, false);
  })), grouped && /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("span", null, t("tmpl.groupByCountry"), " \u2713"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, !firstRun && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        modal: null
      });
    }
  }, t("modal.cancel")), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: create
  }, t("modal.create")))));
}

// picture export: size, legend, progress, and at the end a "Save / Share" button — on the
// iPad the share sheet opens only from a tap, not after a long asynchronous job
function ExportModal() {
  useStore();
  var job = Exports.job;
  var size = App.ui.exportSize || "normal";
  var legend = App.ui.exportLegend !== false;
  var hasStates = !!(App.project && App.project.stateOrder.length);
  var running = !!(job && job.running);
  var close = function close() {
    Exports.clearJob();
    Actions.ui({
      modal: null
    });
  };
  var num = function num(v) {
    return Math.round(v).toLocaleString(App.ui.lang === "ru" ? "ru-RU" : "en-US");
  };
  var dims = function dims(k) {
    return num(MAP_W * Exports.SIZES[k].ppu) + " × " + num(MAP_H * Exports.SIZES[k].ppu);
  };
  var mb = function mb(b) {
    return (b / 1048576).toFixed(b >= 10485760 ? 0 : 1);
  };
  var pick = function pick(k) {
    if (job && !running) Exports.clearJob();
    Actions.setPref({
      exportSize: k
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onClick: function onClick() {
      if (!running) close();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal export-modal",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "modal-title"
  }, t("export.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    onClick: close
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "export-sizes"
  }, ["normal", "large", "huge"].map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "export-size" + (size === k ? " on" : ""),
      disabled: running,
      onClick: function onClick() {
        return pick(k);
      }
    }, /*#__PURE__*/React.createElement("b", null, t("export.size." + k)), /*#__PURE__*/React.createElement("span", null, dims(k)), /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, t("export.sizeHint." + k)));
  })), hasStates && /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: legend,
    disabled: running,
    onChange: function onChange(e) {
      return Actions.setPref({
        exportLegend: e.target.checked
      });
    }
  }), t("export.legend")), running && /*#__PURE__*/React.createElement("div", {
    className: "export-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "export-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: Math.round(job.progress * 100) + "%"
    }
  })), /*#__PURE__*/React.createElement("span", null, t("export.working").replace("{p}", Math.round(job.progress * 100)))), job && job.blob && !running && /*#__PURE__*/React.createElement("div", {
    className: "export-done"
  }, t("export.done").replace("{w}", num(job.w)).replace("{h}", num(job.h)).replace("{mb}", mb(job.blob.size))), job && job.error && /*#__PURE__*/React.createElement("div", {
    className: "card-warn"
  }, t(job.error === "compression" ? "export.errCompression" : "export.errFailed"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-foot"
  }, running ? /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Exports.clearJob();
    }
  }, t("modal.cancel")) : /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: close
  }, t("export.close")), job && job.blob && !running ? /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return Exports.saveResult();
    }
  }, t(window.PWA && PWA.iOS ? "export.share" : "export.saveAgain")) : /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: running,
    onClick: function onClick() {
      return Exports.startPng(size, legend);
    }
  }, t("export.make")))));
}

// installable app: "new version ready" + "add to Home Screen" (Safari on iPad)
function PwaBanner() {
  useStore();
  var P = window.PWA;
  if (!P) return null;
  // a card, a dialog or a bar at the bottom (preview, road, geometry editing) needs the spot
  if (App.ui.card || App.ui.modal || App.ui.roadFrom || App.ui.geomDraw || App.ui.geomEdit || window.World && (World.preview || World.geoBusy || World.cutPreview || World.generating)) return null;
  if (P.updateReady) {
    return /*#__PURE__*/React.createElement("div", {
      className: "pwa-banner"
    }, /*#__PURE__*/React.createElement("span", null, t("pwa.updateReady")), /*#__PURE__*/React.createElement("button", {
      className: "btn primary",
      onClick: function onClick() {
        return P.applyUpdate();
      }
    }, t("pwa.reload")));
  }
  if (P.showInstallHint() && !App.ui.modal) {
    return /*#__PURE__*/React.createElement("div", {
      className: "pwa-banner"
    }, /*#__PURE__*/React.createElement("span", null, t("pwa.installHint")), /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return P.hideInstallHint();
      }
    }, t("pwa.dismiss")));
  }
  return null;
}

// round quick menu for thumbs (bottom-right of the map): the actions one reaches for
// mid-drawing without travelling to the toolbars
function QuickMenu() {
  useStore();
  var open = !!App.ui.quickOpen;
  if (!App.project || App.ui.present) return null;
  var world = window.World && World.active();
  var close = function close() {
    return Actions.ui({
      quickOpen: false
    });
  };
  var items = [{
    key: "undo",
    icon: "↶",
    label: t("edit.undo"),
    disabled: !App.undoStack.length,
    run: function run() {
      return Actions.undo();
    }
  }, {
    key: "redo",
    icon: "↷",
    label: t("edit.redo"),
    disabled: !App.redoStack.length,
    run: function run() {
      return Actions.redo();
    }
  }, {
    key: "panels",
    icon: "▭",
    label: t("input.panels"),
    run: function run() {
      var any = App.ui.leftOpen || App.ui.rightOpen;
      Actions.setPref({
        leftOpen: !any && window.innerWidth >= 1300,
        rightOpen: !any
      });
    }
  }, {
    key: "fit",
    icon: "⤢",
    label: t("zoom.fit"),
    run: function run() {
      return MapAPI.fit();
    }
  }, {
    key: "select",
    icon: "➚",
    label: t("tools.select"),
    on: App.ui.tool === "select",
    run: function run() {
      return Actions.ui({
        tool: "select"
      });
    }
  }, {
    key: "paint",
    icon: "✎",
    label: t("tools.paint"),
    on: App.ui.tool === "paint",
    run: function run() {
      return Actions.ui({
        tool: "paint"
      });
    }
  }, world ? {
    key: "world",
    icon: "⛰",
    label: t("tools.world"),
    on: App.ui.tool === "world",
    run: function run() {
      return Actions.ui({
        tool: "world"
      });
    }
  } : {
    key: "label",
    icon: "T",
    label: t("tools.label"),
    on: App.ui.tool === "label",
    run: function run() {
      return Actions.ui({
        tool: "label"
      });
    }
  }, {
    key: "present",
    icon: "◱",
    label: t("input.fullscreen"),
    run: function run() {
      return Actions.ui({
        present: true
      });
    }
  }];
  var _short = function _short(label) {
    return String(label).replace(/\s*\([^)]*\)\s*$/, "");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "quick-menu" + (open ? " open" : ""),
    "data-export-skip": "1"
  }, open && /*#__PURE__*/React.createElement("div", {
    className: "quick-scrim",
    onPointerDown: close
  }), open && /*#__PURE__*/React.createElement("div", {
    className: "quick-grid"
  }, items.map(function (it) {
    return /*#__PURE__*/React.createElement("button", {
      key: it.key,
      className: "quick-item" + (it.on ? " on" : ""),
      disabled: it.disabled,
      onClick: function onClick() {
        it.run();
        if (it.key !== "undo" && it.key !== "redo") close();
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "quick-icon"
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      className: "quick-label"
    }, _short(it.label)));
  })), /*#__PURE__*/React.createElement("button", {
    className: "quick-toggle",
    title: t("input.quick"),
    onClick: function onClick() {
      return Actions.ui({
        quickOpen: !open
      });
    }
  }, open ? "✕" : "◎"));
}
function Toast() {
  useStore();
  if (!App.ui.toast) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "toast"
  }, App.ui.toast);
}
Object.assign(window, {
  TopBar: TopBar,
  Legend: Legend,
  Timeline: Timeline,
  TemplatesModal: TemplatesModal,
  LibraryModal: LibraryModal,
  Toast: Toast,
  PwaBanner: PwaBanner,
  QuickMenu: QuickMenu,
  ExportModal: ExportModal
});
//# sourceMappingURL=chrome.js.map
