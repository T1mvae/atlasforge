"use strict";

// AtlasForge — app root, hotkeys, bootstrapping
function AppRoot() {
  useStore();
  React.useEffect(function () {
    Actions.loadSaved();
  }, []);

  // theme attribute
  React.useEffect(function () {
    document.documentElement.setAttribute("data-theme", App.ui.theme);
  }, [App.ui.theme]);

  // close menus on outside click
  React.useEffect(function () {
    var close = function close() {
      if (App.ui.menu) Actions.ui({
        menu: null
      });
    };
    document.addEventListener("click", close);
    return function () {
      return document.removeEventListener("click", close);
    };
  }, []);

  // hotkeys
  React.useEffect(function () {
    var onKey = function onKey(e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
        e.preventDefault();
        Actions.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === "y" || k === "z" && e.shiftKey)) {
        e.preventDefault();
        Actions.redo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (k === "enter") {
        if (App.ui.geomDraw && window.MapAPI && MapAPI.finishGeomDraw) {
          e.preventDefault();
          MapAPI.finishGeomDraw();
          return;
        }
        return;
      }
      if (k === "escape") {
        if (window.World && World.preview && !App.ui.modal) {
          World.cancelGeography();
          return;
        }
        if (App.ui.roadFrom) {
          Actions.ui({
            roadFrom: null
          });
          return;
        }
        if (App.ui.waterCut || App.ui.waterMerge) {
          Actions.ui({
            waterCut: false,
            waterMerge: null
          });
          return;
        }
        if (App.ui.card) {
          Actions.ui({
            card: null,
            selLabel: null,
            selStateLabel: null
          });
          return;
        }
        if (App.ui.geomDraw) {
          App.ui.geomDraw = null;
          Actions.ui({
            tool: "select"
          });
          return;
        }
        if (App.ui.geomEdit) {
          window.GeomEdit && GeomEdit.cancelEdit();
          return;
        }
        if (App.ui.present) {
          Actions.ui({
            present: false
          });
          return;
        }
        if (App.ui.modal && App.project) {
          Actions.ui({
            modal: null
          });
          return;
        }
        Actions.ui({
          selLabel: null,
          selFeatLabel: null,
          selStateLabel: null
        });
        Actions.clearRegionSelection();
        Actions.select([], false);
        return;
      }
      var tools = {
        v: "select",
        b: "paint",
        g: "fill",
        e: "erase",
        t: "label",
        c: "place",
        h: "pan"
      };
      if (tools[k]) {
        App.ui.geomDraw = null;
        Actions.ui({
          tool: tools[k]
        });
        return;
      }
      if (k === "w" && window.World && World.active()) {
        App.ui.geomDraw = null;
        Actions.ui({
          tool: "world"
        });
        return;
      }
      if (App.ui.tool === "world" && window.World && World.active() && (k === "[" || k === "]")) {
        Actions.ui({
          worldSize: Math.max(1, Math.min(60, (App.ui.worldSize || 12) + (k === "]" ? 2 : -2)))
        });
        return;
      }
      var geomOk = window.GeomEdit && GeomEdit.enabled();
      if (geomOk && (k === "s" || k === "d")) {
        App.ui.geomDraw = null;
        Actions.ui({
          tool: k === "s" ? "split" : "draw"
        });
        return;
      }
      if (geomOk && k === "q") {
        Actions.healGaps(App.ui.selection.length ? App.ui.selection : null);
        return;
      }
      if (k === "p") {
        Actions.ui({
          present: !App.ui.present
        });
        return;
      }
      if (k === "f") {
        window.MapAPI && MapAPI.fit();
        return;
      }
      if (k === "+" || k === "=") {
        window.MapAPI && MapAPI.zoomBy(1.4);
        return;
      }
      if (k === "-") {
        window.MapAPI && MapAPI.zoomBy(1 / 1.4);
        return;
      }
      if (k === "delete" || k === "backspace") {
        if (App.ui.selFeatLabel) {
          Actions.setFeatLabel(App.ui.selFeatLabel, {
            hidden: true
          });
          Actions.ui({
            selFeatLabel: null
          });
          return;
        }
        if (App.ui.selLabel) {
          Actions.deleteLabel(App.ui.selLabel);
          Actions.ui({
            selLabel: null,
            card: null
          });
          return;
        }
        if (App.ui.selectMode === "region" && App.ui.regionSelection.length) {
          Actions.assignRegions(App.ui.regionSelection, null);
          return;
        }
        if (App.ui.selection.length) {
          Actions.assign(App.ui.selection, null);
          return;
        }
      }
      if (k === "r" && RegionModel.supportsRegions()) {
        Actions.setSelectMode(App.ui.selectMode === "region" ? "province" : "region");
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return function () {
      return document.removeEventListener("keydown", onKey);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "app" + (App.ui.present ? " present" : ""),
    "data-screen-label": "AtlasForge editor"
  }, /*#__PURE__*/React.createElement(TopBar, null), /*#__PURE__*/React.createElement("div", {
    className: "app-mid"
  }, /*#__PURE__*/React.createElement(Toolbar, null), App.ui.leftOpen && /*#__PURE__*/React.createElement(StatesPanel, null), /*#__PURE__*/React.createElement(MapView, null), /*#__PURE__*/React.createElement(Legend, null), App.ui.rightOpen && /*#__PURE__*/React.createElement(PanelResizer, null), App.ui.rightOpen && /*#__PURE__*/React.createElement(PropsPanel, null), (App.ui.leftOpen || App.ui.rightOpen) && !App.ui.present && /*#__PURE__*/React.createElement("div", {
    className: "drawer-scrim",
    onClick: function onClick() {
      return Actions.setPref({
        leftOpen: false,
        rightOpen: false
      });
    }
  }), App.ui.present && /*#__PURE__*/React.createElement("button", {
    className: "btn outline present-exit",
    onClick: function onClick() {
      return Actions.ui({
        present: false
      });
    }
  }, t("present.exit"))), /*#__PURE__*/React.createElement(Timeline, null), App.ui.modal === "templates" && /*#__PURE__*/React.createElement(TemplatesModal, null), App.ui.modal === "library" && /*#__PURE__*/React.createElement(LibraryModal, null), App.ui.modal === "atlas" && window.AtlasModal && /*#__PURE__*/React.createElement(AtlasModal, null), App.ui.modal === "geo" && window.GeoSheet && /*#__PURE__*/React.createElement(GeoSheet, null), App.ui.modal === "names" && window.NameRuleModal && /*#__PURE__*/React.createElement(NameRuleModal, null), App.ui.modal === "export" && window.ExportModal && /*#__PURE__*/React.createElement(ExportModal, null), /*#__PURE__*/React.createElement(PwaBanner, null), /*#__PURE__*/React.createElement(Toast, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(AppRoot, null));
//# sourceMappingURL=app.js.map
