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
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); Actions.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); Actions.redo(); return; }
      if (e.ctrlKey || e.metaKey) return;
      if (k === "enter") {
        if (App.ui.geomDraw && window.MapAPI && MapAPI.finishGeomDraw) { e.preventDefault(); MapAPI.finishGeomDraw(); return; }
        return;
      }
      if (k === "escape") {
        if (App.ui.geomDraw) { App.ui.geomDraw = null; Actions.ui({ tool: "select" }); return; }
        if (App.ui.geomEdit) { window.GeomEdit && GeomEdit.cancelEdit(); return; }
        if (App.ui.present) { Actions.ui({ present: false }); return; }
        if (App.ui.modal && App.project) { Actions.ui({ modal: null }); return; }
        Actions.ui({ selLabel: null });
        Actions.clearRegionSelection();
        Actions.select([], false);
        return;
      }
      const tools = { v: "select", b: "paint", g: "fill", e: "erase", t: "label", h: "pan" };
      if (tools[k]) { Actions.ui({ tool: tools[k] }); return; }
      if (k === "p") { Actions.ui({ present: !App.ui.present }); return; }
      if (k === "f") { window.MapAPI && MapAPI.fit(); return; }
      if (k === "+" || k === "=") { window.MapAPI && MapAPI.zoomBy(1.4); return; }
      if (k === "-") { window.MapAPI && MapAPI.zoomBy(1 / 1.4); return; }
      if (k === "delete" || k === "backspace") {
        if (App.ui.selLabel) { Actions.deleteLabel(App.ui.selLabel); Actions.ui({ selLabel: null }); return; }
        if (App.ui.selectMode === "region" && App.ui.regionSelection.length) { Actions.assignRegions(App.ui.regionSelection, null); return; }
        if (App.ui.selection.length) { Actions.assign(App.ui.selection, null); return; }
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
        <StatesPanel></StatesPanel>
        <MapView></MapView>
        <Legend></Legend>
        <PropsPanel></PropsPanel>
        {App.ui.present && (
          <button className="btn outline present-exit" onClick={() => Actions.ui({ present: false })}>{t("present.exit")}</button>
        )}
      </div>
      <Timeline></Timeline>
      {App.ui.modal === "templates" && <TemplatesModal></TemplatesModal>}
      <Toast></Toast>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot></AppRoot>);
