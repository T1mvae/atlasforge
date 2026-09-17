"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
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
// AtlasForge — left toolbar, states list, right properties panel
var Icons = {
  select: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 2 L12 9 L8.5 9.5 L10.5 13.5 L8.8 14.3 L6.8 10.3 L4 12.5 Z",
    fill: "currentColor",
    stroke: "none"
  })),
  paint: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2.5 L13.5 6 L7 12.5 L3.5 13 L4 9.5 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 9.5 L7 12.5"
  })),
  fill: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7.5 2 L13 7.5 L7.5 13 L2.5 8 L8 2.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "13.2",
    cy: "11.5",
    r: "1.6",
    fill: "currentColor",
    stroke: "none"
  })),
  erase: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "6.5",
    width: "7",
    height: "6",
    rx: "1",
    transform: "rotate(-35 6.5 9.5)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 14 H13"
  })),
  place: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 14 V8 H4.5 V6.5 H6.5 V8 H7.5 V5 H9.5 V8 H10.5 V6.5 H12.5 V8 H13.5 V14 Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.2 14 V11.5 H9.8 V14"
  })),
  label: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3.5 4.5 V3 H12.5 V4.5 M8 3 V13 M6 13 H10"
  })),
  pan: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 2 V14 M2 8 H14 M8 2 L6 4 M8 2 L10 4 M8 14 L6 12 M8 14 L10 12 M2 8 L4 6 M2 8 L4 10 M14 8 L12 6 M14 8 L12 10"
  })),
  split: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 13 L13 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "13",
    r: "1.4",
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "13",
    cy: "3",
    r: "1.4",
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 5 L7.5 7.5 M11 11 L8.5 8.5",
    strokeDasharray: "1.5 1.5"
  })),
  world: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 12.5 L5.5 6 L8 9.5 L10 7 L14 12.5 Z",
    fill: "currentColor",
    fillOpacity: "0.25"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11.5 2 L14 4.5 L9.5 9 L7.5 9.5 L8 7.5 Z"
  })),
  draw: /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 2.5 L13.5 6.5 L11.5 13 L4.5 13 L2.5 6.5 Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "2.5",
    r: "1.3",
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "13.5",
    cy: "6.5",
    r: "1.3",
    fill: "currentColor",
    stroke: "none"
  }))
};
var TOOLS = ["select", "paint", "fill", "erase", "label", "place", "pan"];
var GEOM_TOOLS = ["split", "draw"];
function Toolbar() {
  useStore();
  var geomOk = window.GeomEdit && GeomEdit.enabled();
  var pick = function pick(tl) {
    if (App.ui.tool !== tl) App.ui.geomDraw = null;
    Actions.ui({
      tool: tl
    });
  };
  var worldOk = window.World && World.active();
  return /*#__PURE__*/React.createElement("div", {
    className: "toolbar",
    "data-screen-label": "Toolbar"
  }, worldOk && /*#__PURE__*/React.createElement("button", {
    className: "tool-btn" + (App.ui.tool === "world" ? " active" : ""),
    title: t("tools.world"),
    onClick: function onClick() {
      return pick("world");
    }
  }, Icons.world), worldOk && /*#__PURE__*/React.createElement("div", {
    className: "toolbar-sep"
  }), TOOLS.map(function (tl) {
    return /*#__PURE__*/React.createElement("button", {
      key: tl,
      className: "tool-btn" + (App.ui.tool === tl ? " active" : ""),
      title: t("tools." + tl),
      onClick: function onClick() {
        return pick(tl);
      }
    }, Icons[tl]);
  }), geomOk && /*#__PURE__*/React.createElement("div", {
    className: "toolbar-sep"
  }), geomOk && GEOM_TOOLS.map(function (tl) {
    return /*#__PURE__*/React.createElement("button", {
      key: tl,
      className: "tool-btn" + (App.ui.tool === tl ? " active" : ""),
      title: t("tools." + tl),
      onClick: function onClick() {
        return pick(tl);
      }
    }, Icons[tl]);
  }));
}

// ---------- selection mode toggle (Province / Region) ----------
function ModeBar() {
  useStore();
  var supports = RegionModel.supportsRegions();
  if (!supports) return null;
  var mode = App.ui.selectMode;
  return /*#__PURE__*/React.createElement("div", {
    className: "modebar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "modebtn" + (mode === "province" ? " on" : ""),
    onClick: function onClick() {
      return Actions.setSelectMode("province");
    }
  }, t("mode.province")), /*#__PURE__*/React.createElement("button", {
    className: "modebtn" + (mode === "region" ? " on" : ""),
    disabled: !supports,
    title: supports ? "" : t("mode.regionUnavailable"),
    onClick: function onClick() {
      return Actions.setSelectMode("region");
    }
  }, t("mode.region")));
}

// ---------- region layers (active layer selector + visibility / lock / tools) ----------
function RegionLayersPanel() {
  useStore();
  var p = App.project;
  var supports = RegionModel.supportsRegions();
  if (!supports) return null;
  var status = App.regionData.status;
  var layers = RegionModel.layers();
  var activeId = p.activeRegionLayerId;
  return /*#__PURE__*/React.createElement("div", {
    className: "region-layers",
    "data-screen-label": "Region layers"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", null, t("rlayer.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("rlayer.add"),
    style: {
      height: 22,
      width: 22,
      fontSize: 15
    },
    onClick: function onClick() {
      var nm = prompt(t("rlayer.addPrompt"), t("rtype.historical"));
      if (nm) Actions.addRegionLayer(nm, "historical");
    }
  }, "+")), status === "loading" && /*#__PURE__*/React.createElement("div", {
    className: "empty-hint"
  }, t("rlayer.loading")), status === "error" && /*#__PURE__*/React.createElement("div", {
    className: "empty-hint"
  }, t("rlayer.error")), /*#__PURE__*/React.createElement("div", {
    className: "layer-list"
  }, layers.map(function (l) {
    var n = l.builtin ? (App.regionData.regions || []).length : (l.regionIds || []).length;
    return /*#__PURE__*/React.createElement("div", {
      key: l.id,
      className: "layer-row" + (activeId === l.id ? " active" : ""),
      onClick: function onClick() {
        return Actions.setActiveRegionLayer(l.id);
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "layer-eye",
      title: t("rlayer.visible"),
      onClick: function onClick(e) {
        e.stopPropagation();
        Actions.toggleLayerVisible(l.id);
      }
    }, l.visible === false ? "🚫" : "👁"), /*#__PURE__*/React.createElement("span", {
      className: "layer-name"
    }, l.name), /*#__PURE__*/React.createElement("span", {
      className: "layer-type"
    }, t("rtype." + l.type)), /*#__PURE__*/React.createElement("span", {
      className: "layer-count"
    }, n), l.builtin ? /*#__PURE__*/React.createElement("span", {
      className: "layer-lock",
      title: t("rlayer.lockedBuiltin")
    }, "\uD83D\uDD12") : /*#__PURE__*/React.createElement("button", {
      className: "layer-lock",
      title: t("rlayer.lock"),
      onClick: function onClick(e) {
        e.stopPropagation();
        Actions.toggleLayerLock(l.id);
      }
    }, l.locked ? "🔒" : "🔓"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "layer-tools"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      var src = RegionModel.layerById(activeId);
      var nm = prompt(t("rlayer.dupPrompt"), (src ? src.name : "Regions") + " " + t("rlayer.copy"));
      if (nm) Actions.duplicateLayer(activeId, nm);
    }
  }, t("rlayer.duplicate")), function () {
    var l = RegionModel.layerById(activeId);
    return l && !l.builtin ? /*#__PURE__*/React.createElement("button", {
      className: "btn outline danger",
      style: {
        fontSize: 11
      },
      onClick: function onClick() {
        if (confirm(t("rlayer.deleteConfirm"))) Actions.deleteRegionLayer(activeId);
      }
    }, t("rlayer.delete")) : null;
  }()));
}
function StatesPanel() {
  useStore();
  var p = App.project;
  if (!p) return /*#__PURE__*/React.createElement("div", {
    className: "states-panel"
  });
  var counts = stateStats();
  return /*#__PURE__*/React.createElement("div", {
    className: "states-panel",
    "data-screen-label": "States panel"
  }, /*#__PURE__*/React.createElement(ModeBar, null), App.ui.selectMode === "region" && /*#__PURE__*/React.createElement(RegionLayersPanel, null), /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", null, t("states.title")), /*#__PURE__*/React.createElement("button", {
    className: "btn icon",
    title: t("states.add"),
    onClick: function onClick() {
      return Actions.addState();
    },
    style: {
      height: 22,
      width: 22,
      fontSize: 15
    }
  }, "+")), /*#__PURE__*/React.createElement("div", {
    className: "states-list"
  }, p.stateOrder.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty-hint"
  }, t("states.none")), p.stateOrder.map(function (sid) {
    var s = p.states[sid];
    if (!s) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: sid,
      className: "state-row" + (App.ui.activeState === sid ? " active" : ""),
      onClick: function onClick() {
        Actions.ui({
          activeState: sid,
          panel: "state",
          selection: []
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
    }), /*#__PURE__*/React.createElement("span", {
      className: "state-row-name"
    }, s.name || t("misc.unnamed")), /*#__PURE__*/React.createElement("span", {
      className: "state-row-count"
    }, counts[sid] || 0));
  })));
}

// ---------- form primitives ----------
function Field(_ref) {
  var label = _ref.label,
    children = _ref.children;
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, label), children);
}
function TextField(_ref2) {
  var label = _ref2.label,
    value = _ref2.value,
    _onChange = _ref2.onChange,
    placeholder = _ref2.placeholder;
  return /*#__PURE__*/React.createElement(Field, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: value || "",
    placeholder: placeholder || "",
    onChange: function onChange(e) {
      return _onChange(e.target.value);
    }
  }));
}
function AreaField(_ref3) {
  var label = _ref3.label,
    value = _ref3.value,
    _onChange2 = _ref3.onChange;
  return /*#__PURE__*/React.createElement(Field, {
    label: label
  }, /*#__PURE__*/React.createElement("textarea", {
    className: "textarea",
    value: value || "",
    onChange: function onChange(e) {
      return _onChange2(e.target.value);
    }
  }));
}
function Check(_ref4) {
  var label = _ref4.label,
    checked = _ref4.checked,
    _onChange3 = _ref4.onChange;
  return /*#__PURE__*/React.createElement("label", {
    className: "check-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    onChange: function onChange(e) {
      return _onChange3(e.target.checked);
    }
  }), /*#__PURE__*/React.createElement("span", null, label));
}
function SelectField(_ref5) {
  var label = _ref5.label,
    value = _ref5.value,
    _onChange4 = _ref5.onChange,
    options = _ref5.options;
  return /*#__PURE__*/React.createElement(Field, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: value,
    onChange: function onChange(e) {
      return _onChange4(e.target.value);
    }
  }, options.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: o.value,
      value: o.value
    }, o.label);
  })));
}

// Built-in suggestion lists for country fields (localized). Users can always type
// a custom value; new custom values are remembered project-wide (Actions.rememberValue).
var VALUE_DEFAULTS = {
  ideology: {
    en: ["Democracy", "Liberalism", "Conservatism", "Social Democracy", "Socialism", "Communism", "Fascism", "Nationalism", "Monarchism", "Theocracy", "Anarchism", "Libertarianism", "Technocracy", "Centrism", "Populism", "Progressivism"],
    ru: ["Демократия", "Либерализм", "Консерватизм", "Социал-демократия", "Социализм", "Коммунизм", "Фашизм", "Национализм", "Монархизм", "Теократия", "Анархизм", "Либертарианство", "Технократия", "Центризм", "Популизм", "Прогрессизм"]
  },
  government: {
    en: ["Republic", "Presidential Republic", "Parliamentary Republic", "Constitutional Monarchy", "Absolute Monarchy", "Federation", "Confederation", "Empire", "Democracy", "Dictatorship", "Military Junta", "Theocracy", "Oligarchy", "City-state", "Tribal Council", "Anarchy"],
    ru: ["Республика", "Президентская республика", "Парламентская республика", "Конституционная монархия", "Абсолютная монархия", "Федерация", "Конфедерация", "Империя", "Демократия", "Диктатура", "Военная хунта", "Теократия", "Олигархия", "Город-государство", "Племенной совет", "Анархия"]
  },
  economy: {
    en: ["Market", "Planned", "Mixed", "Agrarian", "Industrial", "Post-industrial", "Feudal", "Mercantile", "Subsistence", "Resource-based", "Command"],
    ru: ["Рыночная", "Плановая", "Смешанная", "Аграрная", "Индустриальная", "Постиндустриальная", "Феодальная", "Меркантильная", "Натуральная", "Ресурсная", "Командная"]
  },
  religion: {
    en: ["Christianity", "Catholicism", "Orthodoxy", "Protestantism", "Islam", "Sunni Islam", "Shia Islam", "Judaism", "Hinduism", "Buddhism", "Paganism", "Animism", "Atheism", "Secular"],
    ru: ["Христианство", "Католицизм", "Православие", "Протестантизм", "Ислам", "Суннизм", "Шиизм", "Иудаизм", "Индуизм", "Буддизм", "Язычество", "Анимизм", "Атеизм", "Светское"]
  },
  culture: {
    en: [],
    ru: []
  },
  // very map-dependent -> seeded from the map + custom
  language: {
    en: ["English", "Spanish", "French", "Portuguese", "German", "Russian", "Arabic", "Hindi", "Mandarin Chinese", "Japanese", "Korean", "Latin"],
    ru: ["Английский", "Испанский", "Французский", "Португальский", "Немецкий", "Русский", "Арабский", "Хинди", "Китайский", "Японский", "Корейский", "Латынь"]
  }
};

// Distinct values already present in the loaded map (so dropdowns reflect the map).
function mapVocab(listKey) {
  var set = new Set();
  var add = function add(v) {
    if (v && typeof v === "string" && v.trim()) set.add(v.trim());
  };
  var p = App.project,
    bm = App.basemap;
  if (window.Metadata && Metadata.fields.includes(listKey)) return Metadata.values(p, listKey);
  if (listKey === "culture") (bm && bm.features ? bm.features : []).forEach(function (f) {
    return add(f.cultArea);
  });
  if (listKey === "culture" || listKey === "religion" || listKey === "language") {
    for (var rid in p.regions || {}) add(p.regions[rid][listKey]);
    for (var gid in p.groups || {}) add(p.groups[gid][listKey]);
  }
  return _toConsumableArray(set);
}

// A real dropdown backed by built-ins + project values. "Custom…" keeps the
// free-text workflow without relying on browser-specific <datalist> UI.
function ComboField(_ref6) {
  var label = _ref6.label,
    listKey = _ref6.listKey,
    stateField = _ref6.stateField,
    value = _ref6.value,
    onChange = _ref6.onChange;
  var p = App.project;
  var lang = App.ui.lang === "ru" ? "ru" : "en";
  var _React$useState = React.useState(false),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    customMode = _React$useState2[0],
    setCustomMode = _React$useState2[1];
  var _React$useState3 = React.useState(value || ""),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    customValue = _React$useState4[0],
    setCustomValue = _React$useState4[1];
  var builtins = VALUE_DEFAULTS[listKey] && VALUE_DEFAULTS[listKey][lang] || [];
  var opts = React.useMemo(function () {
    var set = new Set();
    var add = function add(v) {
      if (v && typeof v === "string" && v.trim()) set.add(v.trim());
    };
    builtins.forEach(add);
    ((p.valueLists || {})[listKey] || []).forEach(add);
    mapVocab(listKey).forEach(add);
    Object.keys(p.states || {}).forEach(function (sid) {
      return add(p.states[sid][stateField]);
    });
    return _toConsumableArray(set).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }, [App.version, listKey, lang]);
  var commit = function commit(v) {
    var val = (v || "").trim();
    onChange(val);
    if (val && builtins.indexOf(val) < 0) Actions.rememberValue(listKey, val);
  };
  var displayOpts = value && !opts.includes(value) ? [value].concat(opts) : opts;
  var selectValue = customMode ? "__custom" : value ? value : "";
  return /*#__PURE__*/React.createElement(Field, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: selectValue,
    onChange: function onChange(e) {
      if (e.target.value === "__custom") {
        setCustomMode(true);
        setCustomValue("");
        return;
      }
      setCustomMode(false);
      commit(e.target.value);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("misc.none")), displayOpts.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: o,
      value: o
    }, o);
  }), /*#__PURE__*/React.createElement("option", {
    value: "__custom"
  }, t("misc.customValue"))), customMode && /*#__PURE__*/React.createElement("input", {
    className: "input",
    autoFocus: true,
    placeholder: t("misc.customValueHint"),
    value: customValue,
    onChange: function onChange(e) {
      return setCustomValue(e.target.value);
    },
    onBlur: function onBlur(e) {
      commit(e.target.value);
      setCustomMode(false);
    },
    onKeyDown: function onKeyDown(e) {
      if (e.key === "Enter") {
        commit(e.target.value);
        setCustomMode(false);
      }
    }
  }));
}
var STATUSES = ["core", "autonomy", "colony", "disputed", "occupied", "assimilation"];

// Extra inputs that appear under the status field for statuses that involve a
// SECOND (or several) countries: disputed -> any number of claimants, occupied ->
// the country it was taken from. All reference state ids (map-independent).
function StatusExtras(_ref7) {
  var status = _ref7.status,
    claimants = _ref7.claimants,
    occupiedFrom = _ref7.occupiedFrom,
    owner = _ref7.owner,
    _onChange5 = _ref7.onChange;
  var p = App.project;
  if (!p.stateOrder.length) return null;
  if (status === "disputed") {
    var set = new Set(claimants || []);
    return /*#__PURE__*/React.createElement(Field, {
      label: t("f.claimants")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 168,
        overflowY: "auto"
      }
    }, p.stateOrder.map(function (x) {
      return /*#__PURE__*/React.createElement(Check, {
        key: x,
        label: p.states[x].name + (x === owner ? " ★" : ""),
        checked: set.has(x),
        onChange: function onChange(v) {
          var ns = new Set(set);
          v ? ns.add(x) : ns["delete"](x);
          _onChange5({
            claimants: _toConsumableArray(ns)
          });
        }
      });
    })));
  }
  if (status === "occupied") {
    return /*#__PURE__*/React.createElement(Field, {
      label: t("f.occupiedFrom")
    }, /*#__PURE__*/React.createElement("select", {
      className: "select",
      value: occupiedFrom || "",
      onChange: function onChange(e) {
        return _onChange5({
          occupiedFrom: e.target.value || null
        });
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, t("misc.none")), p.stateOrder.filter(function (x) {
      return x !== owner;
    }).map(function (x) {
      return /*#__PURE__*/React.createElement("option", {
        key: x,
        value: x
      }, p.states[x].name);
    })));
  }
  return null;
}

// Group the selected autonomy regions into a NAMED autonomous entity that draws
// its own border + label. Shown only when the status is "autonomy".
function AutonomyPicker(_ref8) {
  var sel = _ref8.sel,
    owner = _ref8.owner,
    autonomyId = _ref8.autonomyId;
  var p = App.project;
  var autos = p.autonomies || {};
  var list = Object.keys(autos).map(function (k) {
    return autos[k];
  }).filter(function (a) {
    return !owner || owner === "__mixed" || a.owner === owner;
  });
  var cur = autonomyId && autos[autonomyId] ? autos[autonomyId] : null;
  return /*#__PURE__*/React.createElement(Field, {
    label: t("f.autonomy")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: autonomyId || "",
    onChange: function onChange(e) {
      var v = e.target.value;
      if (v === "__new") {
        var nm = prompt(t("autonomy.nameAsk"), t("autonomy.new"));
        if (nm) Actions.createAutonomy(sel, nm);
      } else Actions.setRegionAutonomy(sel, v || null);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("misc.none")), list.map(function (a) {
    return /*#__PURE__*/React.createElement("option", {
      key: a.id,
      value: a.id
    }, a.name);
  }), /*#__PURE__*/React.createElement("option", {
    value: "__new"
  }, "\uFF0B ", t("autonomy.new"))), cur && /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: cur.name,
    onChange: function onChange(e) {
      return Actions.setAutonomy(cur.id, {
        name: e.target.value
      }, {
        undo: false
      });
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: cur.color || "#c8c8c8",
    onChange: function onChange(e) {
      return Actions.setAutonomy(cur.id, {
        color: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn icon danger",
    style: {
      height: 26,
      width: 26
    },
    title: t("autonomy.remove"),
    onClick: function onClick() {
      return Actions.setRegionAutonomy(sel, null);
    }
  }, "\u2715")));
}

// ---------- Map settings tab ----------
function MapTab() {
  var p = App.project;
  var s = p.settings;
  var set = function set(patch) {
    return Actions.setSettings(patch, {
      undo: false
    });
  };
  var mode = s.mapMode || "color";
  var supportsRegions = RegionModel.supportsRegions();
  var displayModes = ["country", "province", "culture", "religion", "language", "terrain"].concat(supportsRegions ? ["stateRegion", "historicalRegion", "culturalRegion", "geographicalRegion", "politicalRegion"] : []);
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement(SelectField, {
    label: t("map.displayMode"),
    value: p.displayMode || "country",
    onChange: function onChange(v) {
      return Actions.setDisplayMode(v);
    },
    options: displayModes.map(function (m) {
      return {
        value: m,
        label: t("dmode." + m)
      };
    })
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("map.mode")
  }, /*#__PURE__*/React.createElement("div", {
    className: "chip-row",
    style: {
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "chip" + (mode === "color" ? " on" : ""),
    style: {
      flex: 1,
      padding: "6px 8px"
    },
    onClick: function onClick() {
      return set({
        mapMode: "color"
      });
    }
  }, "\u25A0 ", t("map.modeColor")), /*#__PURE__*/React.createElement("button", {
    className: "chip" + (mode === "flag" ? " on" : ""),
    style: {
      flex: 1,
      padding: "6px 8px"
    },
    onClick: function onClick() {
      return set({
        mapMode: "flag"
      });
    }
  }, "\u2691 ", t("map.modeFlag")))), mode === "flag" && /*#__PURE__*/React.createElement(Field, {
    label: t("map.flagOpacity") + " — " + Math.round((s.flagOpacity == null ? 0.92 : s.flagOpacity) * 100) + "%"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0.3",
    max: "1",
    step: "0.02",
    value: s.flagOpacity == null ? 0.92 : s.flagOpacity,
    onChange: function onChange(e) {
      return set({
        flagOpacity: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: t("map.style")
  }, /*#__PURE__*/React.createElement("div", {
    className: "chip-row"
  }, Object.keys(MAP_STYLES).map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "chip" + (s.style === k ? " on" : ""),
      onClick: function onClick() {
        return Actions.applyStyle(k);
      }
    }, t("style." + k));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement(Field, {
    label: t("map.sea")
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: s.sea,
    onChange: function onChange(e) {
      return set({
        sea: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: t("map.land")
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: s.land,
    onChange: function onChange(e) {
      return set({
        land: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: t("map.borders")
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: s.borders,
    onChange: function onChange(e) {
      return set({
        borders: e.target.value
      });
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("map.sectionBorders")), App.basemap.topo ? /*#__PURE__*/React.createElement(Check, {
    label: t("map.showRegionBorders"),
    checked: s.showRegionBorders !== undefined ? s.showRegionBorders !== false : s.innerBorders !== false,
    onChange: function onChange(v) {
      return set({
        showRegionBorders: v
      });
    }
  }) : /*#__PURE__*/React.createElement(Check, {
    label: t("map.showProvinceBorders"),
    checked: s.showProvinceBorders !== false,
    onChange: function onChange(v) {
      return set({
        showProvinceBorders: v
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("map.borderW") + " — " + s.borderW.toFixed(1)
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0",
    max: "3",
    step: "0.1",
    value: s.borderW,
    onChange: function onChange(e) {
      return set({
        borderW: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showCountryBorders"),
    checked: s.showCountryBorders !== false,
    onChange: function onChange(v) {
      return set({
        showCountryBorders: v
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("map.countryBorderW") + " — " + (s.countryBorderW != null ? (+s.countryBorderW).toFixed(1) : "1.6")
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0.4",
    max: "4",
    step: "0.1",
    value: s.countryBorderW != null ? s.countryBorderW : 1.6,
    onChange: function onChange(e) {
      return set({
        countryBorderW: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showAutonomies"),
    checked: s.showAutonomies !== false,
    onChange: function onChange(v) {
      return set({
        showAutonomies: v
      });
    }
  }), App.basemap.topo && /*#__PURE__*/React.createElement(Check, {
    label: t("map.showCoastlines"),
    checked: s.showCoastlines !== false,
    onChange: function onChange(v) {
      return set({
        showCoastlines: v
      });
    }
  }), supportsRegions && /*#__PURE__*/React.createElement(Check, {
    label: t("map.showRegionBorders"),
    checked: s.showRegionBorders !== false,
    onChange: function onChange(v) {
      return set({
        showRegionBorders: v
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("props.map")), (App.basemap.physical || App.physical && App.physical.status === "ready") && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
    label: t("map.showRivers"),
    checked: s.showRivers !== false,
    onChange: function onChange(v) {
      return set({
        showRivers: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showLakes"),
    checked: s.showLakes !== false,
    onChange: function onChange(v) {
      return set({
        showLakes: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showMountains"),
    checked: s.showMountains !== false,
    onChange: function onChange(v) {
      return set({
        showMountains: v
      });
    }
  }), App.physical && App.physical.status === "ready" && App.physical.relief.some(function (f) {
    return f.typ === "forest";
  }) && /*#__PURE__*/React.createElement(Check, {
    label: t("map.showForest"),
    checked: s.showForest !== false,
    onChange: function onChange(v) {
      return set({
        showForest: v
      });
    }
  }), App.physical && App.physical.status === "ready" && App.physical.relief.some(function (f) {
    return f.typ === "desert";
  }) && /*#__PURE__*/React.createElement(Check, {
    label: t("map.showDesert"),
    checked: s.showDesert !== false,
    onChange: function onChange(v) {
      return set({
        showDesert: v
      });
    }
  })), /*#__PURE__*/React.createElement(Check, {
    label: t("map.provinceTint"),
    checked: s.provinceTint,
    onChange: function onChange(v) {
      return set({
        provinceTint: v
      });
    }
  }), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("snap.title")), ["borders", "rivers", "lakes", "mountains"].map(function (k) {
    return /*#__PURE__*/React.createElement(Check, {
      key: k,
      label: t("snap." + k),
      checked: k === "mountains" ? (s.snap || {})[k] === true : (s.snap || {})[k] !== false,
      onChange: function onChange(v) {
        return set({
          snap: Object.assign({}, s.snap, _defineProperty({}, k, v))
        });
      }
    });
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("edit.smoothLine"),
    checked: s.cutSmooth !== false,
    onChange: function onChange(v) {
      return set({
        cutSmooth: v
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    title: t("edit.healAllHint"),
    disabled: !Object.keys((App.project.regionGeomEdits || {}).features || {}).length,
    onClick: function onClick() {
      return Actions.healGaps(null);
    }
  }, t("edit.healAll")), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11,
      flex: 1
    },
    title: t("edit.repairHint"),
    disabled: !Object.keys((App.project.regionGeomEdits || {}).features || {}).length,
    onClick: function onClick() {
      return Actions.repairEdited("simplify");
    }
  }, t("edit.repairSimplify")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11,
      flex: 1
    },
    title: t("edit.repairHint"),
    disabled: !Object.keys((App.project.regionGeomEdits || {}).features || {}).length,
    onClick: function onClick() {
      return Actions.repairEdited("smooth");
    }
  }, t("edit.repairSmooth"))), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("edit.repairHint"))), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showStateLabels"),
    checked: s.showStateLabels,
    onChange: function onChange(v) {
      return set({
        showStateLabels: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showCapitals"),
    checked: s.showCapitals !== false,
    onChange: function onChange(v) {
      return set({
        showCapitals: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.atlasLabels"),
    checked: s.labelAtlas !== false,
    onChange: function onChange(v) {
      return set({
        labelAtlas: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showLabels"),
    checked: s.showLabels,
    onChange: function onChange(v) {
      return set({
        showLabels: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showFlags"),
    checked: s.showFlags,
    onChange: function onChange(v) {
      return set({
        showFlags: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("map.showLegend"),
    checked: App.ui.showLegend,
    onChange: function onChange(v) {
      return Actions.ui({
        showLegend: v
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("backdrop.section")), !p.backdrop ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return pickImageFile(function (f) {
        return Actions.loadBackdropImage(f);
      });
    }
  }, t("backdrop.load")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("backdrop.hint"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
    label: t("backdrop.show"),
    checked: p.backdrop.visible !== false,
    onChange: function onChange(v) {
      return Actions.setBackdrop({
        visible: v
      });
    }
  }), /*#__PURE__*/React.createElement(Check, {
    label: t("backdrop.move"),
    checked: !!App.ui.moveBackdrop,
    onChange: function onChange(v) {
      return Actions.ui({
        moveBackdrop: v
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("backdrop.opacity") + " — " + Math.round((p.backdrop.opacity == null ? 0.55 : p.backdrop.opacity) * 100) + "%"
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0.05",
    max: "1",
    step: "0.05",
    value: p.backdrop.opacity == null ? 0.55 : p.backdrop.opacity,
    onChange: function onChange(e) {
      return Actions.setBackdrop({
        opacity: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      flexWrap: "wrap",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.setBackdrop({
        x: 0,
        y: 0,
        w: MAP_W,
        h: MAP_H
      });
    }
  }, t("backdrop.fit")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return pickImageFile(function (f) {
        return Actions.loadBackdropImage(f);
      });
    }
  }, t("backdrop.replace")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.removeBackdrop();
    }
  }, t("backdrop.remove")))));
}

// ---------- reusable metadata dictionaries ----------
var CATALOG_TABS = ["culture", "religion", "language", "government"];
var CATALOG_KINDS = ["", "derived", "mixed"]; // plain / split off (one parent) / mixed (two parents)

function CatalogEntryEditor(_ref9) {
  var field = _ref9.field,
    name = _ref9.name,
    parents = _ref9.parents;
  var p = App.project;
  var source = window.Metadata && Metadata.entry(p, field, name) || {
    name: name,
    color: Metadata.color(p, field, name),
    parent: "",
    parent2: "",
    kind: "",
    description: ""
  };
  var fromSource = function fromSource() {
    return {
      name: source.name || "",
      color: source.color || Metadata.color(App.project, field, name),
      parent: source.parent || "",
      parent2: source.parent2 || "",
      kind: source.kind || (source.parent2 ? "mixed" : ""),
      description: source.description || ""
    };
  };
  var _React$useState5 = React.useState(fromSource),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    draft = _React$useState6[0],
    setDraft = _React$useState6[1];
  React.useEffect(function () {
    setDraft(fromSource());
  }, [field, name, source.name, source.color, source.parent, source.parent2, source.kind, source.description]);
  var set = function set(patch) {
    return setDraft(function (d) {
      return Object.assign({}, d, patch);
    });
  };
  var kinds = field === "culture";
  var showParent2 = kinds && draft.kind === "mixed";
  var usage = Metadata.usage(p, field, name);
  var _React$useState7 = React.useState(""),
    _React$useState8 = _slicedToArray(_React$useState7, 2),
    mergeInto = _React$useState8[0],
    setMergeInto = _React$useState8[1];
  var parentColor = Metadata.parentColor(p, field, draft);
  var lineage = draft.kind === "mixed" && draft.parent && draft.parent2 ? draft.parent + " + " + draft.parent2 : draft.parent ? "← " + draft.parent : "";
  return /*#__PURE__*/React.createElement("div", {
    className: "catalog-entry"
  }, /*#__PURE__*/React.createElement("div", {
    className: "catalog-entry-head"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    value: draft.name,
    onChange: function onChange(e) {
      return set({
        name: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: draft.color || "#888888",
    onChange: function onChange(e) {
      return set({
        color: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn icon danger",
    title: t("catalog.delete"),
    onClick: function onClick() {
      var u = Metadata.usage(p, field, name);
      var msg = t("catalog.deleteConfirm").replace("{name}", name).replace("{states}", u.states).replace("{regions}", u.regions);
      if (u.dataset) msg += "\n\n" + t("catalog.datasetNote");
      if (!confirm(msg)) return;
      Actions.deleteCatalogEntry(field, name);
      Actions.toast(t("catalog.deleted"));
    }
  }, "\u2715")), kinds && /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: draft.kind || "",
    onChange: function onChange(e) {
      return set({
        kind: e.target.value,
        parent2: e.target.value === "mixed" ? draft.parent2 : ""
      });
    }
  }, CATALOG_KINDS.map(function (k) {
    return /*#__PURE__*/React.createElement("option", {
      key: k,
      value: k
    }, t("catalog.kind" + (k || "Plain")));
  })), /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: draft.parent || "",
    onChange: function onChange(e) {
      return set({
        parent: e.target.value
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t(showParent2 ? "catalog.parent" : "catalog.noParent")), parents.filter(function (v) {
    return v !== name && v !== draft.parent2;
  }).map(function (v) {
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, v);
  })), showParent2 && /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: draft.parent2 || "",
    onChange: function onChange(e) {
      return set({
        parent2: e.target.value
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("catalog.parent2")), parents.filter(function (v) {
    return v !== name && v !== draft.parent;
  }).map(function (v) {
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, v);
  })), (lineage || parentColor) && /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, lineage), parentColor && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    title: parentColor,
    onClick: function onClick() {
      return set({
        color: parentColor
      });
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "state-swatch",
    style: {
      background: parentColor,
      marginRight: 4
    }
  }), t("catalog.colorFromParents"))), /*#__PURE__*/React.createElement("textarea", {
    className: "textarea catalog-description",
    rows: "2",
    placeholder: t("catalog.description"),
    value: draft.description || "",
    onChange: function onChange(e) {
      return set({
        description: e.target.value
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("catalog.usage").replace("{states}", usage.states).replace("{regions}", usage.regions), usage.dataset ? " · " + t("catalog.fromDataset") : ""), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.saveCatalogEntry(field, name, draft);
    }
  }, t("catalog.save")), field !== "government" && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.selectByMetadata(field, name);
    }
  }, t("catalog.selectUsed"))), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: mergeInto,
    onChange: function onChange(e) {
      return setMergeInto(e.target.value);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("catalog.mergeInto")), parents.filter(function (v) {
    return v !== name;
  }).map(function (v) {
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, v);
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11,
      flex: "0 0 auto"
    },
    disabled: !mergeInto,
    onClick: function onClick() {
      if (!confirm(t("catalog.mergeConfirm").replace("{from}", name).replace("{into}", mergeInto))) return;
      Actions.mergeCatalogEntry(field, name, mergeInto);
      Actions.toast(t("catalog.merged"));
    }
  }, t("catalog.merge"))));
}
function CatalogTab() {
  useStore();
  var p = App.project;
  var _React$useState9 = React.useState("culture"),
    _React$useState0 = _slicedToArray(_React$useState9, 2),
    field = _React$useState0[0],
    setField = _React$useState0[1];
  var _React$useState1 = React.useState(""),
    _React$useState10 = _slicedToArray(_React$useState1, 2),
    newName = _React$useState10[0],
    setNewName = _React$useState10[1];
  var _React$useState11 = React.useState(""),
    _React$useState12 = _slicedToArray(_React$useState11, 2),
    query = _React$useState12[0],
    setQuery = _React$useState12[1];
  var values = (window.Metadata ? Metadata.values(p, field) : []).filter(Boolean);
  var visibleValues = values.filter(function (name) {
    return !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
  }).slice(0, 100);
  var _React$useState13 = React.useState(""),
    _React$useState14 = _slicedToArray(_React$useState13, 2),
    applyValue = _React$useState14[0],
    setApplyValue = _React$useState14[1];
  React.useEffect(function () {
    if (!values.includes(applyValue)) setApplyValue(values[0] || "");
  }, [field, values.join("\x01")]);
  var add = function add() {
    var name = newName.trim();
    if (!name) return;
    Actions.saveCatalogEntry(field, "", {
      name: name,
      color: Metadata.color(p, field, name),
      parent: "",
      description: ""
    });
    setNewName("");
  };
  var selected = App.ui.selection || [];
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body catalog-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chip-row catalog-tabs"
  }, CATALOG_TABS.map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "chip" + (field === k ? " on" : ""),
      onClick: function onClick() {
        return setField(k);
      }
    }, t("catalog." + k));
  })), /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("catalog.hint")), field !== "government" && /*#__PURE__*/React.createElement("div", {
    className: "catalog-apply"
  }, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("catalog.bulk")), /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: applyValue,
    onChange: function onChange(e) {
      return setApplyValue(e.target.value);
    },
    disabled: !values.length
  }, !values.length && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("catalog.empty")), values.map(function (v) {
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, v);
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !selected.length || !applyValue,
    onClick: function onClick() {
      return Actions.setRegion(selected, _defineProperty({}, field, applyValue));
    }
  }, t("catalog.apply"), " (", selected.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "catalog-add"
  }, /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: t("catalog.new"),
    value: newName,
    onChange: function onChange(e) {
      return setNewName(e.target.value);
    },
    onKeyDown: function onKeyDown(e) {
      if (e.key === "Enter") add();
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: add
  }, t("catalog.add"))), values.length > 12 && /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: t("catalog.search"),
    value: query,
    onChange: function onChange(e) {
      return setQuery(e.target.value);
    }
  }), visibleValues.length < values.length && /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("catalog.showing").replace("{shown}", visibleValues.length).replace("{total}", values.length)), /*#__PURE__*/React.createElement("div", {
    className: "catalog-list"
  }, visibleValues.map(function (name) {
    return /*#__PURE__*/React.createElement(CatalogEntryEditor, {
      key: field + "|" + name,
      field: field,
      name: name,
      parents: values
    });
  })));
}
function pickImageFile(cb) {
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = function () {
    if (inp.files[0]) cb(inp.files[0]);
  };
  inp.click();
}

// ---------- State tab ----------
function StateTab() {
  var p = App.project;
  var sid = App.ui.activeState;
  var s = sid ? p.states[sid] : null;
  if (!s) return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("state.none")));
  var set = function set(patch) {
    return Actions.setState(sid, patch, {
      undo: false
    });
  };
  var counts = stateStats();
  var capOptions = React.useMemo(function () {
    var out = [],
      bm = App.basemap;
    for (var rid in p.regions) {
      var e = effRegion(p, rid);
      if (!e || e.owner !== sid) continue;
      var f = bm && bm.byId ? bm.byId[rid] : null;
      out.push({
        id: rid,
        name: p.regions[rid] && p.regions[rid].name || f && f.name || rid
      });
    }
    out.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });
    return out;
  }, [App.version, sid]);
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: t("f.name"),
    value: s.name,
    onChange: function onChange(v) {
      return set({
        name: v
      });
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement(Field, {
    label: t("f.color")
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: s.color,
    onChange: function onChange(e) {
      return set({
        color: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: t("f.flag")
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, s.flag && /*#__PURE__*/React.createElement("img", {
    src: s.flag,
    alt: "",
    style: {
      width: 34,
      height: 22,
      objectFit: "cover",
      borderRadius: 3,
      border: "1px solid var(--border)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      height: 26,
      fontSize: 11
    },
    onClick: function onClick() {
      return Exports.uploadFlag(sid);
    }
  }, t("f.flagUpload")), s.flag && /*#__PURE__*/React.createElement("button", {
    className: "btn icon danger",
    style: {
      height: 26,
      width: 26
    },
    title: t("f.flagClear"),
    onClick: function onClick() {
      return set({
        flag: null
      });
    }
  }, "\u2715")))), /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, counts[sid] || 0, " ", t("state.regions"), " \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: function onClick(e) {
      e.preventDefault();
      Actions.selectByOwner(sid);
    },
    style: {
      color: "var(--accent)"
    }
  }, t("state.selectRegions"))), s.flag && /*#__PURE__*/React.createElement(Check, {
    label: t("f.flagFill"),
    checked: s.flagFill,
    onChange: function onChange(v) {
      return set({
        flagFill: v
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("state.vassalOf")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: s.vassalOf || "",
    onChange: function onChange(e) {
      return set({
        vassalOf: e.target.value || null
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("state.sovereign")), p.stateOrder.filter(function (x) {
    return x !== sid;
  }).map(function (x) {
    return /*#__PURE__*/React.createElement("option", {
      key: x,
      value: x
    }, p.states[x].name);
  }))), s.vassalOf && p.states[s.vassalOf] && /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("state.vassalHint"), " ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: p.states[s.vassalOf].color
    }
  }, p.states[s.vassalOf].name)), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("label.section")), function () {
    var lsv = s.labelStyle || {};
    var setLS = function setLS(patch) {
      return set({
        labelStyle: Object.assign({}, lsv, patch)
      });
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Check, {
      label: t("label.hidden"),
      checked: !!lsv.hidden,
      onChange: function onChange(v) {
        return setLS({
          hidden: v
        });
      }
    }), /*#__PURE__*/React.createElement(Field, {
      label: t("label.size") + " — " + (lsv.size ? lsv.size : t("label.auto"))
    }, /*#__PURE__*/React.createElement("input", {
      type: "range",
      className: "range",
      min: "0",
      max: "36",
      step: "1",
      value: lsv.size || 0,
      onChange: function onChange(e) {
        return setLS({
          size: +e.target.value || 0
        });
      }
    })), /*#__PURE__*/React.createElement(Field, {
      label: t("label.rotation") + " — " + (lsv.angle != null ? lsv.angle + "°" : t("label.auto"))
    }, /*#__PURE__*/React.createElement("div", {
      className: "field-row"
    }, /*#__PURE__*/React.createElement("input", {
      type: "range",
      className: "range",
      min: "-180",
      max: "180",
      step: "1",
      value: lsv.angle != null ? lsv.angle : 0,
      onChange: function onChange(e) {
        return setLS({
          angle: +e.target.value
        });
      }
    }), lsv.angle != null && /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      style: {
        height: 22,
        fontSize: 10
      },
      onClick: function onClick() {
        return setLS({
          angle: null
        });
      }
    }, t("label.auto")))), /*#__PURE__*/React.createElement(Field, {
      label: t("label.spacing") + " — " + (lsv.spacing != null ? lsv.spacing : t("label.auto"))
    }, /*#__PURE__*/React.createElement("div", {
      className: "field-row"
    }, /*#__PURE__*/React.createElement("input", {
      type: "range",
      className: "range",
      min: "0",
      max: "8",
      step: "0.5",
      value: lsv.spacing != null ? lsv.spacing : 0,
      onChange: function onChange(e) {
        return setLS({
          spacing: +e.target.value
        });
      }
    }), lsv.spacing != null && /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      style: {
        height: 22,
        fontSize: 10
      },
      onClick: function onClick() {
        return setLS({
          spacing: null
        });
      }
    }, t("label.auto")))), s.labelOffset && /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      style: {
        fontSize: 11
      },
      onClick: function onClick() {
        return set({
          labelOffset: null
        });
      }
    }, t("label.resetPos")));
  }(), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("props.state")), /*#__PURE__*/React.createElement(Field, {
    label: t("f.capital")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: s.capitalRegion || "",
    onChange: function onChange(e) {
      return set({
        capitalRegion: e.target.value || null
      });
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("misc.none")), capOptions.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: o.id,
      value: o.id
    }, o.name);
  }))), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.gov"),
    listKey: "government",
    stateField: "gov",
    value: s.gov,
    onChange: function onChange(v) {
      return set({
        gov: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.ideology"),
    listKey: "ideology",
    stateField: "ideology",
    value: s.ideology,
    onChange: function onChange(v) {
      return set({
        ideology: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.officialReligion"),
    listKey: "religion",
    stateField: "religion",
    value: s.religion,
    onChange: function onChange(v) {
      return Actions.setStateMeta(sid, "religion", v);
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.officialCulture"),
    listKey: "culture",
    stateField: "culture",
    value: s.culture,
    onChange: function onChange(v) {
      return Actions.setStateMeta(sid, "culture", v);
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.officialLanguage"),
    listKey: "language",
    stateField: "language",
    value: s.language,
    onChange: function onChange(v) {
      return Actions.setStateMeta(sid, "language", v);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("state.metaHint")), (s.culture || s.religion || s.language) && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      var n = 0;
      ["culture", "religion", "language"].forEach(function (f) {
        if ((s[f] || "").trim()) n += Actions.setStateMeta(sid, f, s[f], {
          force: true
        });
      });
      Actions.toast(t("state.metaApplied").replace("{n}", n));
    }
  }, t("state.metaApplyAll")), /*#__PURE__*/React.createElement(TextField, {
    label: t("f.population"),
    value: s.population,
    onChange: function onChange(v) {
      return set({
        population: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.economy"),
    listKey: "economy",
    stateField: "economy",
    value: s.economy,
    onChange: function onChange(v) {
      return set({
        economy: v
      });
    }
  }), /*#__PURE__*/React.createElement(TextField, {
    label: t("f.army"),
    value: s.army,
    onChange: function onChange(v) {
      return set({
        army: v
      });
    }
  }), /*#__PURE__*/React.createElement(AreaField, {
    label: t("f.notes"),
    value: s.notes,
    onChange: function onChange(v) {
      return set({
        notes: v
      });
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      if (confirm(t("state.deleteConfirm"))) Actions.deleteState(sid);
    }
  }, t("state.delete")));
}

// ---------- Region tab (also label editor) ----------
function LabelEditor(_ref0) {
  var id = _ref0.id;
  var p = App.project;
  var l = p.labels.find(function (x) {
    return x.id === id;
  });
  if (!l) return null;
  var set = function set(patch) {
    return Actions.setLabel(id, patch, {
      undo: false
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: t("f.text"),
    value: l.text,
    onChange: function onChange(v) {
      return set({
        text: v
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("f.size") + " — " + l.size
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "6",
    max: "72",
    step: "1",
    value: l.size,
    onChange: function onChange(e) {
      return set({
        size: +e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement(Field, {
    label: t("f.color")
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: l.color || "#222222",
    onChange: function onChange(e) {
      return set({
        color: e.target.value
      });
    }
  })), /*#__PURE__*/React.createElement(Check, {
    label: "Bold",
    checked: l.bold,
    onChange: function onChange(v) {
      return set({
        bold: v
      });
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      Actions.deleteLabel(id);
      Actions.ui({
        selLabel: null
      });
    }
  }, "\u2715 ", t("misc.none") === "—" ? App.ui.lang === "ru" ? "Удалить подпись" : "Delete label" : "Delete"));
}

// ---------- per-region name label editor (move / rotate / size / hide) ----------
function FeatLabelEditor(_ref1) {
  var id = _ref1.id;
  var p = App.project;
  var ov = (p.featLabels || {})[id] || {};
  var set = function set(patch) {
    return Actions.setFeatLabel(id, patch, {
      undo: false
    });
  };
  var baseId = id.indexOf("L:") === 0 ? id.slice(2) : id;
  var f = App.basemap.byId && App.basemap.byId[baseId];
  var nm = f && f.name || App.regionData && App.regionData.byId && App.regionData.byId[baseId] && RegionModel.displayName(App.regionData.byId[baseId]) || baseId;
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("label.section")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      marginBottom: 8
    }
  }, nm), /*#__PURE__*/React.createElement(Check, {
    label: t("label.hidden"),
    checked: !!ov.hidden,
    onChange: function onChange(v) {
      return set({
        hidden: v || null
      });
    }
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("label.size") + " — " + (ov.size ? ov.size : t("label.auto"))
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "0",
    max: "48",
    step: "1",
    value: ov.size || 0,
    onChange: function onChange(e) {
      return set({
        size: +e.target.value || null
      });
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: t("label.rotation") + " — " + (ov.angle ? ov.angle + "°" : "0°")
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "range",
    min: "-180",
    max: "180",
    step: "1",
    value: ov.angle || 0,
    onChange: function onChange(e) {
      return set({
        angle: +e.target.value || null
      });
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11,
      margin: "6px 0"
    }
  }, t("label.dragHint")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.clearFeatLabel(id);
    }
  }, t("label.reset")));
}

// ---------- region selection editor (Region mode) ----------
var META_FIELDS = ["culture", "language", "religion", "terrain", "climate", "historicalPeriod", "politicalStatus", "population", "development"];
function NewRegionForm(_ref10) {
  var onCreate = _ref10.onCreate,
    defaultType = _ref10.defaultType;
  var _React$useState15 = React.useState(""),
    _React$useState16 = _slicedToArray(_React$useState15, 2),
    name = _React$useState16[0],
    setName = _React$useState16[1];
  var _React$useState17 = React.useState(defaultType || "historical"),
    _React$useState18 = _slicedToArray(_React$useState17, 2),
    type = _React$useState18[0],
    setType = _React$useState18[1];
  return /*#__PURE__*/React.createElement("div", {
    className: "newregion-form"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: t("region.newName"),
    value: name,
    onChange: setName
  }), /*#__PURE__*/React.createElement(SelectField, {
    label: t("f.type"),
    value: type,
    onChange: setType,
    options: RegionModel.types.map(function (tp) {
      return {
        value: tp,
        label: t("rtype." + tp)
      };
    })
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: !name.trim(),
    onClick: function onClick() {
      return onCreate(name.trim(), type);
    }
  }, t("region.create")));
}
function RegionPropsPanel() {
  var p = App.project;
  var sel = App.ui.regionSelection;
  if (!sel.length) return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("region.noneRegion")));
  var ownerOptions = p.stateOrder.map(function (sid) {
    return {
      id: sid,
      name: p.states[sid].name
    };
  });

  // ----- multiple regions -----
  if (sel.length > 1) {
    var _owner = RegionModel.regionOwner(RegionModel.resolve(sel[0]));
    var resolved = sel.map(function (id) {
      return RegionModel.resolve(id);
    }).filter(Boolean);
    var commonMeta = function commonMeta(key) {
      var first = ((resolved[0] || {}).metadata || {})[key] || "";
      return resolved.every(function (r) {
        return ((r.metadata || {})[key] || "") === first;
      }) ? first : "";
    };
    var setAllMeta = function setAllMeta(key, value) {
      return Actions.setRegionsMeta(sel, _defineProperty({}, key, value));
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "props-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "muted"
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text)"
      }
    }, sel.length), " ", t("region.multiRegion")), /*#__PURE__*/React.createElement(Field, {
      label: t("f.owner")
    }, /*#__PURE__*/React.createElement("select", {
      className: "select",
      value: _owner || "",
      onChange: function onChange(e) {
        return Actions.assignRegions(sel, e.target.value || null);
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, t("legend.unowned")), ownerOptions.map(function (o) {
      return /*#__PURE__*/React.createElement("option", {
        key: o.id,
        value: o.id
      }, o.name);
    }))), /*#__PURE__*/React.createElement("button", {
      className: "btn primary",
      onClick: function onClick() {
        var nm = prompt(t("region.countryName"), "");
        if (nm !== null) Actions.createCountryFromRegions(sel, nm || null);
      }
    }, t("region.createCountry")), /*#__PURE__*/React.createElement("div", {
      className: "props-section-title"
    }, t("props.region")), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.culture"),
      listKey: "culture",
      stateField: "culture",
      value: commonMeta("culture"),
      onChange: function onChange(v) {
        return setAllMeta("culture", v);
      }
    }), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.language"),
      listKey: "language",
      stateField: "language",
      value: commonMeta("language"),
      onChange: function onChange(v) {
        return setAllMeta("language", v);
      }
    }), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.religion"),
      listKey: "religion",
      stateField: "religion",
      value: commonMeta("religion"),
      onChange: function onChange(v) {
        return setAllMeta("religion", v);
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "props-section-title"
    }, t("region.createLarger")), /*#__PURE__*/React.createElement("div", {
      className: "muted",
      style: {
        fontSize: 11
      }
    }, t("region.createLargerHint")), /*#__PURE__*/React.createElement(NewRegionForm, {
      defaultType: "historical",
      onCreate: function onCreate(name, type) {
        return Actions.createRegionFromRegions(sel, {
          name: name,
          type: type
        });
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      onClick: function onClick() {
        return Actions.clearRegionSelection();
      }
    }, t("region.clearSel")));
  }

  // ----- single region -----
  var id = sel[0];
  var r = RegionModel.resolve(id);
  if (!r) return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("region.noneRegion")));
  var isCustom = !r.builtin;
  var owner = RegionModel.regionOwner(r);
  var meta = r.metadata || {};
  var setMeta = function setMeta(k, v) {
    return Actions.setRegionMeta(id, _defineProperty({}, k, v));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: t("f.name"),
    value: RegionModel.displayName(r),
    onChange: function onChange(v) {
      return Actions.renameRegion(id, v);
    }
  }), /*#__PURE__*/React.createElement(SelectField, {
    label: t("f.type"),
    value: r.type || "custom",
    onChange: function onChange(v) {
      return Actions.setRegionType(id, v);
    },
    options: RegionModel.types.map(function (tp) {
      return {
        value: tp,
        label: t("rtype." + tp)
      };
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, RegionModel.provinceCount(r), " ", t("region.provinces"), r.builtin ? " · " + t("region.builtinState") : "", r.category ? " · " + r.category : ""), /*#__PURE__*/React.createElement(Field, {
    label: t("f.owner")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: owner || "",
    onChange: function onChange(e) {
      return Actions.assignRegions([id], e.target.value || null);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("legend.unowned")), ownerOptions.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: o.id,
      value: o.id
    }, o.name);
  }))), /*#__PURE__*/React.createElement(Field, {
    label: t("f.color")
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: r.color || "#cccccc",
    onChange: function onChange(e) {
      return Actions.setRegionColor(id, e.target.value);
    }
  }), r.color && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      height: 26,
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.setRegionColor(id, null);
    }
  }, "\u21BA"))), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      var nm = prompt(t("region.countryName"), RegionModel.displayName(r));
      if (nm !== null) Actions.createCountryFromRegions([id], nm || null);
    }
  }, t("region.createCountry")), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("props.region")), /*#__PURE__*/React.createElement(AreaField, {
    label: t("f.notes"),
    value: r.notes,
    onChange: function onChange(v) {
      return Actions.setRegionNotes(id, v);
    }
  }), META_FIELDS.map(function (k) {
    return ["culture", "language", "religion"].includes(k) ? /*#__PURE__*/React.createElement(ComboField, {
      key: k,
      label: t("meta." + k),
      listKey: k,
      stateField: k,
      value: meta[k] == null ? "" : meta[k],
      onChange: function onChange(v) {
        return setMeta(k, v);
      }
    }) : /*#__PURE__*/React.createElement(TextField, {
      key: k,
      label: t("meta." + k),
      value: meta[k] == null ? "" : meta[k],
      onChange: function onChange(v) {
        return setMeta(k, v);
      }
    });
  }), /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      marginTop: 6
    }
  }, r.b && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return MapAPI.zoomTo(r.b);
    }
  }, t("zoom.fit")), isCustom && /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    onClick: function onClick() {
      if (confirm(t("region.deleteConfirm"))) Actions.deleteRegion(id);
    }
  }, t("region.delete"))));
}
function RegionTab() {
  var p = App.project;
  if (App.ui.selectMode === "region") return /*#__PURE__*/React.createElement(RegionPropsPanel, null);
  var sel = App.ui.selection;
  if (App.ui.selFeatLabel) return /*#__PURE__*/React.createElement(FeatLabelEditor, {
    id: App.ui.selFeatLabel
  });
  if (App.ui.selLabel) return /*#__PURE__*/React.createElement(LabelEditor, {
    id: App.ui.selLabel
  });
  if (!sel.length) return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("region.none")));
  var rid = sel[0];
  var r0 = p.regions[rid] || {};
  var gid = r0.group && p.groups && p.groups[r0.group] ? r0.group : null;
  var g = gid ? p.groups[gid] : null;
  var isGroup = !!g && sel.length === (g.members || []).length;
  var ownerOptions = p.stateOrder.map(function (sid) {
    return {
      id: sid,
      name: p.states[sid].name
    };
  });

  // -------- merged custom region --------
  if (isGroup) {
    var setG = function setG(patch) {
      return Actions.setGroup(gid, patch, {
        undo: false
      });
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "props-body"
    }, /*#__PURE__*/React.createElement(TextField, {
      label: t("f.name"),
      value: g.name,
      onChange: function onChange(v) {
        return setG({
          name: v
        });
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "muted"
    }, (g.members || []).length, " ", t("group.members")), /*#__PURE__*/React.createElement(Field, {
      label: t("f.owner")
    }, /*#__PURE__*/React.createElement("select", {
      className: "select",
      value: g.owner || "",
      onChange: function onChange(e) {
        return Actions.assign(sel, e.target.value || null);
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, t("legend.unowned")), ownerOptions.map(function (o) {
      return /*#__PURE__*/React.createElement("option", {
        key: o.id,
        value: o.id
      }, o.name);
    }))), /*#__PURE__*/React.createElement(Field, {
      label: t("f.status")
    }, /*#__PURE__*/React.createElement("select", {
      className: "select",
      value: g.status || "core",
      onChange: function onChange(e) {
        return setG({
          status: e.target.value
        });
      }
    }, STATUSES.map(function (st) {
      return /*#__PURE__*/React.createElement("option", {
        key: st,
        value: st
      }, t("status." + st));
    }))), /*#__PURE__*/React.createElement(StatusExtras, {
      status: g.status,
      claimants: g.claimants,
      occupiedFrom: g.occupiedFrom,
      owner: g.owner,
      onChange: function onChange(patch) {
        return setG(patch);
      }
    }), g.status === "autonomy" && /*#__PURE__*/React.createElement(AutonomyPicker, {
      sel: sel,
      owner: g.owner,
      autonomyId: g.autonomyId
    }), /*#__PURE__*/React.createElement(Field, {
      label: t("f.color")
    }, /*#__PURE__*/React.createElement("div", {
      className: "field-row"
    }, /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "color-input",
      value: g.color || "#cccccc",
      onChange: function onChange(e) {
        return setG({
          color: e.target.value
        });
      }
    }), g.color && /*#__PURE__*/React.createElement("button", {
      className: "btn outline",
      style: {
        height: 26,
        fontSize: 11
      },
      onClick: function onClick() {
        return setG({
          color: null
        });
      }
    }, "\u21BA"))), /*#__PURE__*/React.createElement("div", {
      className: "props-section-title"
    }, t("props.region")), /*#__PURE__*/React.createElement(TextField, {
      label: t("f.population"),
      value: g.population,
      onChange: function onChange(v) {
        return setG({
          population: v
        });
      }
    }), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.culture"),
      listKey: "culture",
      stateField: "culture",
      value: g.culture,
      onChange: function onChange(v) {
        return setG({
          culture: v
        });
      }
    }), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.language"),
      listKey: "language",
      stateField: "language",
      value: g.language,
      onChange: function onChange(v) {
        return setG({
          language: v
        });
      }
    }), /*#__PURE__*/React.createElement(ComboField, {
      label: t("f.religion"),
      listKey: "religion",
      stateField: "religion",
      value: g.religion,
      onChange: function onChange(v) {
        return setG({
          religion: v
        });
      }
    }), /*#__PURE__*/React.createElement(AreaField, {
      label: t("f.notes"),
      value: g.notes,
      onChange: function onChange(v) {
        return setG({
          notes: v
        });
      }
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn outline danger",
      onClick: function onClick() {
        Actions.ungroup(gid);
        Actions.select([], false);
      }
    }, t("group.split")));
  }
  var multi = sel.length > 1;
  var f = App.basemap.byId[rid];
  var r = p.regions[rid] || {};
  var setAll = function setAll(patch) {
    return Actions.setRegion(sel, patch, {
      undo: false
    });
  };
  var effFirst = effRegion(p, rid) || {};
  var commonOwner = multi ? sel.every(function (x) {
    return (effRegion(p, x) || {}).owner === effFirst.owner;
  }) ? effFirst.owner : "__mixed" : effFirst.owner;
  var commonMeta = function commonMeta(key) {
    var first = effFirst[key] || "";
    return sel.every(function (x) {
      return ((effRegion(p, x) || {})[key] || "") === first;
    }) ? first : "";
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "props-body"
  }, multi ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--text)"
    }
  }, sel.length), " ", t("region.multi")), window.GeomEdit && GeomEdit.enabled() ? /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      var nm = prompt(t("edit.mergeNameAsk"), p.regions[sel[0]] && p.regions[sel[0]].name || (App.basemap.byId[sel[0]] || {}).name || "");
      if (nm !== null) Actions.mergeRegionsGeometry(sel, nm || null);
    }
  }, t("edit.merge")) : /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: function onClick() {
      return Actions.groupRegions(sel);
    }
  }, t("group.merge")), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    title: t("edit.healHint"),
    onClick: function onClick() {
      return Actions.healGaps(sel);
    }
  }, t("edit.healBtn"), " (", sel.length, ")"), RegionModel.supportsRegions() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("region.fromProvinces")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("region.fromProvincesHint")), /*#__PURE__*/React.createElement(NewRegionForm, {
    defaultType: "historical",
    onCreate: function onCreate(name, type) {
      return Actions.createRegionFromProvinces(sel, {
        name: name,
        type: type
      });
    }
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    label: t("f.name"),
    value: r.name || "",
    placeholder: f ? f.name : "",
    onChange: function onChange(v) {
      return setAll({
        name: v || null,
        nameAuto: null
      });
    }
  }), f && /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, t("region.baseName"), ": ", f.name, f.country ? " · " + f.country : ""), f && window.ProvinceGeo && window.World && World.active() && /*#__PURE__*/React.createElement(ProvinceGeo, {
    id: rid
  }), f && (f.histArea || f.cultArea) && /*#__PURE__*/React.createElement("div", {
    className: "muted"
  }, f.histArea ? t("region.histArea") + ": " + f.histArea : "", f.histArea && f.cultArea ? " · " : "", f.cultArea ? t("region.cultArea") + ": " + f.cultArea : "")), window.NameRuleModal && window.World && World.active() && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return Actions.ui({
        modal: "names",
        nameIds: sel.slice()
      });
    }
  }, t("names.button")), /*#__PURE__*/React.createElement(Field, {
    label: t("f.owner")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: commonOwner || "",
    onChange: function onChange(e) {
      return Actions.assign(sel, e.target.value || null);
    }
  }, commonOwner === "__mixed" && /*#__PURE__*/React.createElement("option", {
    value: "__mixed"
  }, "\xB7\xB7\xB7"), /*#__PURE__*/React.createElement("option", {
    value: ""
  }, t("legend.unowned")), ownerOptions.map(function (o) {
    return /*#__PURE__*/React.createElement("option", {
      key: o.id,
      value: o.id
    }, o.name);
  }))), /*#__PURE__*/React.createElement(Field, {
    label: t("f.status")
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: r.status || "core",
    onChange: function onChange(e) {
      return setAll({
        status: e.target.value
      });
    }
  }, STATUSES.map(function (st) {
    return /*#__PURE__*/React.createElement("option", {
      key: st,
      value: st
    }, t("status." + st));
  }))), /*#__PURE__*/React.createElement(StatusExtras, {
    status: r.status,
    claimants: r.claimants,
    occupiedFrom: r.occupiedFrom,
    owner: effFirst.owner,
    onChange: function onChange(patch) {
      return setAll(patch);
    }
  }), r.status === "autonomy" && /*#__PURE__*/React.createElement(AutonomyPicker, {
    sel: sel,
    owner: effFirst.owner,
    autonomyId: effFirst.autonomyId
  }), /*#__PURE__*/React.createElement(Field, {
    label: t("f.color")
  }, /*#__PURE__*/React.createElement("div", {
    className: "field-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "color-input",
    value: r.color || "#cccccc",
    onChange: function onChange(e) {
      return setAll({
        color: e.target.value
      });
    }
  }), r.color && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      height: 26,
      fontSize: 11
    },
    onClick: function onClick() {
      return setAll({
        color: null
      });
    }
  }, "\u21BA"))), /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("props.region")), !multi && /*#__PURE__*/React.createElement(TextField, {
    label: t("f.population"),
    value: r.population,
    onChange: function onChange(v) {
      return setAll({
        population: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.culture"),
    listKey: "culture",
    stateField: "culture",
    value: commonMeta("culture"),
    onChange: function onChange(v) {
      return setAll({
        culture: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.language"),
    listKey: "language",
    stateField: "language",
    value: commonMeta("language"),
    onChange: function onChange(v) {
      return setAll({
        language: v
      });
    }
  }), /*#__PURE__*/React.createElement(ComboField, {
    label: t("f.religion"),
    listKey: "religion",
    stateField: "religion",
    value: commonMeta("religion"),
    onChange: function onChange(v) {
      return setAll({
        religion: v
      });
    }
  }), commonOwner && commonOwner !== "__mixed" && p.states[commonOwner] && ["culture", "religion", "language"].some(function (k) {
    return (p.states[commonOwner][k] || "").trim();
  }) && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return Actions.toast(t("region.resetToStateDone").replace("{n}", Actions.resetRegionMetaToState(sel)));
    }
  }, t("region.resetToState")), !multi && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AreaField, {
    label: t("f.notes"),
    value: r.notes,
    onChange: function onChange(v) {
      return setAll({
        notes: v
      });
    }
  }), f && /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    onClick: function onClick() {
      return MapAPI.zoomTo(f.b);
    }
  }, t("zoom.fit"), " \u2192 ", r.name || f.name), window.GeomEdit && GeomEdit.enabled() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("edit.section")), /*#__PURE__*/React.createElement("div", {
    className: "field-row",
    style: {
      flexWrap: "wrap",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      return GeomEdit.startEdit(rid);
    }
  }, t("edit.editBorders")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      Actions.ui({
        tool: "split"
      });
      Actions.toast(t("edit.splitHint"));
    }
  }, t("edit.splitBtn")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline",
    style: {
      fontSize: 11
    },
    title: t("edit.healHint"),
    onClick: function onClick() {
      return Actions.healGaps([rid]);
    }
  }, t("edit.healBtnHot")), /*#__PURE__*/React.createElement("button", {
    className: "btn outline danger",
    style: {
      fontSize: 11
    },
    onClick: function onClick() {
      if (!confirm(t("edit.deleteAsk"))) return;
      var merge = confirm(t("edit.deleteMergeAsk"));
      Actions.deleteRegionGeometry(rid, merge ? "merge" : "hole");
    }
  }, t("edit.deleteBtn"))), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11
    }
  }, t("edit.hint"))), RegionModel.supportsRegions() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "props-section-title"
  }, t("region.fromProvinces")), /*#__PURE__*/React.createElement(NewRegionForm, {
    defaultType: "historical",
    onCreate: function onCreate(name, type) {
      return Actions.createRegionFromProvinces(sel, {
        name: name,
        type: type
      });
    }
  }))));
}
function PropsPanel() {
  useStore();
  if (!App.project) return /*#__PURE__*/React.createElement("div", {
    className: "props-panel"
  });
  var tab = App.ui.panel;
  var Tabs = {
    map: MapTab,
    state: StateTab,
    region: RegionTab,
    catalog: CatalogTab
  };
  var Body = Tabs[tab] || MapTab;
  return /*#__PURE__*/React.createElement("div", {
    className: "props-panel",
    "data-screen-label": "Properties panel",
    style: {
      width: App.ui.propsWidth || 320
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "props-tabs"
  }, ["map", "state", "region", "catalog"].map(function (k) {
    return /*#__PURE__*/React.createElement("button", {
      key: k,
      className: "props-tab" + (tab === k ? " active" : ""),
      onClick: function onClick() {
        return Actions.ui({
          panel: k
        });
      }
    }, t("props." + k));
  })), /*#__PURE__*/React.createElement(Body, null));
}

// drag handle on the left edge of the properties panel; width persists in UI prefs
function PanelResizer() {
  useStore();
  if (App.ui.present) return null;
  var onDown = function onDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    var el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {}
    document.body.classList.add("resizing");
    var raf = false,
      pending = App.ui.propsWidth;
    var host = el.parentElement.getBoundingClientRect(); // not window.innerWidth: the app may be embedded
    var move = function move(ev) {
      pending = host.right - ev.clientX;
      if (!raf) {
        raf = true;
        requestAnimationFrame(function () {
          raf = false;
          Actions.setPropsWidth(pending);
        });
      }
    };
    var _up = function up() {
      Actions.setPropsWidth(pending); // apply the final position even if no frame was pending
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", _up);
      el.removeEventListener("pointercancel", _up);
      document.body.classList.remove("resizing");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", _up);
    el.addEventListener("pointercancel", _up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "panel-resizer",
    title: t("props.resize"),
    onPointerDown: onDown
  });
}
Object.assign(window, {
  Toolbar: Toolbar,
  StatesPanel: StatesPanel,
  PropsPanel: PropsPanel,
  PanelResizer: PanelResizer
});
//# sourceMappingURL=panels.js.map
