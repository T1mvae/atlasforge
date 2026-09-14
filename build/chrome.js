"use strict";

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
    children = _ref.children;
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
    className: "menu",
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
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand-glyph"
  }, "AF"), /*#__PURE__*/React.createElement("span", null, t("app.title"))), p && /*#__PURE__*/React.createElement("input", {
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
  }, /*#__PURE__*/React.createElement(MenuItem, {
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
    label: t("menu.exportPng"),
    onClick: function onClick() {
      return Exports.png(2, true);
    }
  }), /*#__PURE__*/React.createElement(MenuItem, {
    label: t("menu.exportPngHi"),
    onClick: function onClick() {
      return Exports.png(4, true);
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
  }), /*#__PURE__*/React.createElement("button", {
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
function TemplatesModal() {
  useStore();
  var _React$useState3 = React.useState("admin1"),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    choice = _React$useState4[0],
    setChoice = _React$useState4[1];
  var _React$useState5 = React.useState(false),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    showClassic = _React$useState6[0],
    setShowClassic = _React$useState6[1];
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
    }, c.count, " ", t("stat.regions")));
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
  }, t("modal.templates.title")), !firstRun && /*#__PURE__*/React.createElement("button", {
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

// installable app: "new version ready" + "add to Home Screen" (Safari on iPad)
function PwaBanner() {
  useStore();
  var P = window.PWA;
  if (!P) return null;
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
  Toast: Toast,
  PwaBanner: PwaBanner
});
//# sourceMappingURL=chrome.js.map
