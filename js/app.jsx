// AtlasForge — app root, hotkeys, bootstrapping
function AppRoot() {
  useStore();

  React.useEffect(() => {
    Actions.loadSaved();
  }, []);

  // theme attribute
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", App.ui.theme);
  }, [App.ui.theme]);

  // close menus on outside click
  React.useEffect(() => {
    const close = () => { if (App.ui.menu) Actions.ui({ menu: null }); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // hotkeys
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      // typing into a text field: the keys are text. A checkbox, slider, colour or list
      // keeps the focus after a click but must not swallow Ctrl+Z.
      const typing = tag === "textarea" || e.target.isContentEditable ||
        (tag === "input" && !/^(checkbox|radio|range|color|button|file)$/.test(e.target.type || "text"));
      if (typing) return;
      // the physical key on a non-Latin layout (on a Russian one e.key is "я", not "z")
      let k = (e.key || "").toLowerCase();
      if (!/^[a-z]$/.test(k) && /^Key[A-Z]$/.test(e.code || "")) k = e.code[3].toLowerCase();
      // a window is open: the keys must not act on the map behind it
      if (App.ui.modal) { if (k === "escape" && App.project) Actions.ui({ modal: null }); return; }
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); Actions.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); Actions.redo(); return; }
      if (e.ctrlKey || e.metaKey) return;
      if (tag === "select") return; // letters pick an option in a list
      if (k === "enter") {
        if (App.ui.geomDraw && window.MapAPI && MapAPI.finishGeomDraw) { e.preventDefault(); MapAPI.finishGeomDraw(); return; }
        return;
      }
      if (k === "escape") {
        if (window.World && World.preview && !App.ui.modal) { World.cancelGeography(); return; }
        if (App.ui.roadFrom) { Actions.ui({ roadFrom: null }); return; }
        if (App.ui.waterCut || App.ui.waterMerge) { Actions.ui({ waterCut: false, waterMerge: null }); return; }
        if (App.ui.card) { Actions.ui({ card: null, selLabel: null, selStateLabel: null }); return; }
        if (App.ui.geomDraw) { App.ui.geomDraw = null; Actions.ui({ tool: "select" }); return; }
        if (App.ui.geomEdit) { window.GeomEdit && GeomEdit.cancelEdit(); return; }
        if (App.ui.present) { Actions.ui({ present: false }); return; }
        if (App.ui.modal && App.project) { Actions.ui({ modal: null }); return; }
        Actions.ui({ selLabel: null, selFeatLabel: null, selStateLabel: null, activeMacroRegion: null });
        Actions.clearRegionSelection();
        Actions.select([], false);
        return;
      }
      const tools = { v: "select", b: "paint", g: "fill", e: "erase", t: "label", c: "place", h: "pan" };
      if (tools[k]) { App.ui.geomDraw = null; Actions.ui({ tool: tools[k] }); return; }
      if (k === "w" && window.World && World.active()) { App.ui.geomDraw = null; Actions.ui({ tool: "world" }); return; }
      if (App.ui.tool === "world" && window.World && World.active() && (k === "[" || k === "]")) {
        Actions.ui({ worldSize: Math.max(1, Math.min(60, (App.ui.worldSize || 12) + (k === "]" ? 2 : -2))) }); return;
      }
      const geomOk = window.GeomEdit && GeomEdit.enabled();
      if (geomOk && (k === "s" || k === "d")) { App.ui.geomDraw = null; Actions.ui({ tool: k === "s" ? "split" : "draw" }); return; }
      if (geomOk && k === "q") { Actions.healGaps(App.ui.selection.length ? App.ui.selection : null); return; }
      if (k === "p") { Actions.ui({ present: !App.ui.present }); return; }
      if (k === "f") { window.MapAPI && MapAPI.fit(); return; }
      if (k === "+" || k === "=") { window.MapAPI && MapAPI.zoomBy(1.4); return; }
      if (k === "-") { window.MapAPI && MapAPI.zoomBy(1 / 1.4); return; }
      if (k === "delete" || k === "backspace") {
        if (App.ui.selFeatLabel) { Actions.setFeatLabel(App.ui.selFeatLabel, { hidden: true }); Actions.ui({ selFeatLabel: null }); return; }
        if (App.ui.selLabel) { Actions.deleteLabel(App.ui.selLabel); Actions.ui({ selLabel: null, card: null }); return; }
        if (App.ui.selectMode === "region" && App.ui.regionSelection.length) { Actions.assignRegions(App.ui.regionSelection, null); return; }
        if (App.ui.selection.length) {
          // on the regions tab the tools work on regions, and so does Delete
          if (App.ui.leftView === "regions" && window.macroRegionsOn()) Actions.assignMacroRegion(App.ui.selection, null);
          else Actions.assign(App.ui.selection, null);
          return;
        }
      }
      if (k === "r" && RegionModel.supportsRegions()) { Actions.setSelectMode(App.ui.selectMode === "region" ? "province" : "region"); return; }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={"app" + (App.ui.present ? " present" : "")} data-screen-label="AtlasForge editor">
      <TopBar></TopBar>
      <div className="app-mid">
        <Toolbar></Toolbar>
        {App.ui.leftOpen && <StatesPanel></StatesPanel>}
        <MapView></MapView>
        <Legend></Legend>
        {App.ui.rightOpen && <PanelResizer></PanelResizer>}
        {App.ui.rightOpen && <PropsPanel></PropsPanel>}
        {(App.ui.leftOpen || App.ui.rightOpen) && !App.ui.present && (
          <div className="drawer-scrim" onClick={() => Actions.setPref({ leftOpen: false, rightOpen: false })}></div>
        )}
        {App.ui.present && (
          <button className="btn outline present-exit" onClick={() => Actions.ui({ present: false })}>{t("present.exit")}</button>
        )}
      </div>
      <Timeline></Timeline>
      {App.ui.modal === "templates" && <TemplatesModal></TemplatesModal>}
      {App.ui.modal === "library" && <LibraryModal></LibraryModal>}
      {App.ui.modal === "atlas" && window.AtlasModal && <AtlasModal></AtlasModal>}
      {App.ui.modal === "geo" && window.GeoSheet && <GeoSheet></GeoSheet>}
      {App.ui.modal === "names" && window.NameRuleModal && <NameRuleModal></NameRuleModal>}
      {App.ui.modal === "export" && window.ExportModal && <ExportModal></ExportModal>}
      <PwaBanner></PwaBanner>
      <Toast></Toast>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot></AppRoot>);
