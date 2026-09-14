// AtlasForge — custom world UI: brush palette (floating over the map) and the AI atlas modal
function WorldPalette() {
  useStore();
  const p = App.project;
  if (!p || !p.world) return null;
  const w = p.world;
  const brush = App.ui.worldBrush || "land";
  const size = App.ui.worldSize || 12;
  const collapsed = !!App.ui.worldPaletteCollapsed;
  const [riversOpen, setRiversOpen] = React.useState(false);
  const km = +w.scaleKm || 5;
  const stale = w.genRev != null && w.genRev !== w.rev;
  const hasProvinces = App.basemap.count > 0;

  const generate = () => {
    if (hasProvinces && !confirm(t("world.regenAsk"))) return;
    Actions.toast(t("world.generating"));
    setTimeout(() => World.generate(), 40); // let the toast paint first
  };

  if (collapsed) {
    return (
      <div className="world-palette collapsed" data-export-skip="1">
        <button className="btn" onClick={() => Actions.ui({ worldPaletteCollapsed: false })}>
          <span className="wp-swatch" style={{ background: World.BRUSH_SWATCH[brush] }}></span> {t("world.brush." + brush)} ▸
        </button>
      </div>
    );
  }
  return (
    <div className="world-palette" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wp-head">
        <span className="wp-title">{t("world.palette")}</span>
        <button className="btn icon" title={t("world.collapse")} onClick={() => Actions.ui({ worldPaletteCollapsed: true })}>◂</button>
      </div>
      <div className="wp-brushes">
        {World.BRUSHES.map((b) => (
          <button key={b} className={"wp-brush" + (brush === b ? " on" : "")} onClick={() => Actions.setPref({ worldBrush: b })} title={t("world.brushHint." + b)}>
            <span className="wp-swatch" style={{ background: World.BRUSH_SWATCH[b] }}></span>
            <span>{t("world.brush." + b)}</span>
          </button>
        ))}
      </div>
      <label className="wp-field">
        <span>{t("world.size")} — {size}</span>
        <input type="range" className="range" min="1" max="60" step="1" value={size} onChange={(e) => Actions.setPref({ worldSize: +e.target.value })}></input>
      </label>
      <label className="check-row wp-check">
        <input type="checkbox" checked={App.ui.worldPressure !== false} onChange={(e) => Actions.setPref({ worldPressure: e.target.checked })}></input>
        {t("world.pressure")}{window.World && World.pressureSupport() === "no" ? " — " + t("input.noPressureShort") : ""}
      </label>
      <label className="check-row wp-check">
        <input type="checkbox" checked={App.ui.worldRough !== false} onChange={(e) => Actions.setPref({ worldRough: e.target.checked })}></input>
        {t("world.rough")}
      </label>
      <label className="wp-field">
        <span>{t("input.stabilizer")} — {Math.round((+App.ui.worldStabilizer || 0) * 100)}%</span>
        <input type="range" className="range" min="0" max="0.85" step="0.05" value={+App.ui.worldStabilizer || 0}
          onChange={(e) => Actions.setPref({ worldStabilizer: +e.target.value })}></input>
      </label>

      <div className="wp-sep"></div>
      <div className="wp-section">{t("world.provinces")}</div>
      <label className="wp-field">
        <span>{t("world.cellSize")} — ≈{Math.round((w.cellSize || 18) * km)} {t("world.km")}</span>
        <input type="range" className="range" min="6" max="50" step="1" value={w.cellSize || 18}
          onChange={(e) => World.setWorld({ cellSize: +e.target.value })}></input>
      </label>
      <button className={"btn " + (stale || !hasProvinces ? "primary" : "outline")} onClick={generate}>
        {hasProvinces ? t("world.regenerate") : t("world.generate")}
      </button>
      {stale && <div className="wp-note">{t("world.stale")}</div>}

      <div className="wp-sep"></div>
      <label className="wp-field">
        <span>{t("world.scale")}</span>
        <span className="wp-inline">
          <input type="number" className="input" min="0.1" step="0.5" value={km} style={{ width: 70 }}
            onChange={(e) => World.setWorld({ scaleKm: Math.max(0.1, +e.target.value || 5) })}></input>
          <span className="muted">{t("world.km")} · {t("world.mapSize").replace("{w}", Math.round(World.GW * km).toLocaleString()).replace("{h}", Math.round(World.GH * km).toLocaleString())}</span>
        </span>
      </label>
      <label className="wp-field">
        <span>{t("world.fillOpacity")} — {Math.round((p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62) * 100)}%</span>
        <input type="range" className="range" min="0.15" max="1" step="0.01" value={p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62}
          onChange={(e) => Actions.setSettings({ worldFillOpacity: +e.target.value }, { undo: false })}></input>
      </label>

      <button className="btn outline wp-toggle" onClick={() => setRiversOpen((v) => !v)}>
        {riversOpen ? "▾ " : "▸ "}{t("world.rivers")} ({(w.rivers || []).length})
      </button>
      {riversOpen && (
        <div className="wp-rivers">
          {(w.rivers || []).length === 0 && <div className="wp-note">{t("world.noRivers")}</div>}
          {(w.rivers || []).map((rv) => (
            <div key={rv.id} className="wp-river">
              <input className="input" value={rv.name} onChange={(e) => World.renameRiver(rv.id, e.target.value)}></input>
              <button className="btn icon" title={t("world.deleteRiver")} onClick={() => World.deleteRiver(rv.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="wp-sep"></div>
      <button className="btn primary" disabled={!hasProvinces} onClick={() => Actions.ui({ modal: "atlas" })}>{t("world.atlas")}</button>
      <div className="wp-row">
        <button className="btn outline" onClick={() => { if (App.basemap.count === 0 && !(w.elev) || confirm(t("world.randomAsk"))) World.randomContinent(); }}>{t("world.random")}</button>
        <button className="btn outline" onClick={() => { if (confirm(t("world.clearAsk"))) World.clearTerrain(); }}>{t("world.clear")}</button>
      </div>
      <div className="wp-note">{t("world.labelsHint")}</div>
    </div>
  );
}

// Procreate-style vertical brush-size rail on the left edge of the map: drag with a
// thumb while the other hand draws (no keyboard shortcuts on an iPad)
function WorldSizeRail() {
  useStore();
  const size = App.ui.worldSize || 12;
  const MIN = 1, MAX = 60;
  const trackRef = React.useRef(null);
  const setFrom = (clientY) => {
    const r = trackRef.current.getBoundingClientRect();
    const k = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    // quadratic: fine control over small brushes
    Actions.ui({ worldSize: Math.max(MIN, Math.round(MIN + (MAX - MIN) * k * k)) });
  };
  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    setFrom(e.clientY);
    const move = (ev) => setFrom(ev.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      Actions.setPref({ worldSize: App.ui.worldSize });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const k = Math.sqrt((size - MIN) / (MAX - MIN));
  return (
    <div className={"size-rail" + (App.ui.worldPaletteCollapsed ? "" : " shifted")} data-export-skip="1" onPointerDown={onDown} title={t("world.size")}>
      <div className="size-rail-track" ref={trackRef}>
        <div className="size-rail-fill" style={{ height: (k * 100) + "%" }}></div>
        <div className="size-rail-thumb" style={{ bottom: "calc(" + (k * 100) + "% - 14px)" }}>{size}</div>
      </div>
    </div>
  );
}

function AtlasModal() {
  useStore();
  const [withProvinces, setWithProvinces] = React.useState(true);
  const text = React.useMemo(() => {
    try { return World.buildAtlas({ provinces: withProvinces }); } catch (e) { console.error(e); return String(e); }
  }, [withProvinces, App.ui.lang]);
  const areaRef = React.useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); Actions.toast(t("world.copied")); }
    catch (e) { if (areaRef.current) { areaRef.current.select(); document.execCommand("copy"); Actions.toast(t("world.copied")); } }
  };
  const save = () => {
    const name = ((App.project && App.project.name) || "world").replace(/[^\wЀ-ӿ -]+/g, "").trim() || "world";
    window.downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), name + ".atlas.md");
  };
  const tokens = Math.round(text.length / 3.5);
  return (
    <div className="modal-backdrop" onClick={() => Actions.ui({ modal: null })}>
      <div className="modal atlas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("world.atlasTitle")}</span>
          <button className="btn icon" onClick={() => Actions.ui({ modal: null })}>✕</button>
        </div>
        <div className="modal-body">
          <div className="muted">{t("world.atlasDesc")}</div>
          <label className="check-row">
            <input type="checkbox" checked={withProvinces} onChange={(e) => setWithProvinces(e.target.checked)}></input>
            {t("world.atlasProvinces")}
          </label>
          <textarea ref={areaRef} className="atlas-text" readOnly value={text}></textarea>
          <div className="muted" style={{ fontSize: 11 }}>{t("world.atlasSize").replace("{c}", text.length.toLocaleString()).replace("{t}", tokens.toLocaleString())}</div>
        </div>
        <div className="modal-foot">
          <button className="btn outline" onClick={save}>{t("world.atlasSave")}</button>
          <button className="btn primary" onClick={copy}>{t("world.atlasCopy")}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WorldPalette, AtlasModal, WorldSizeRail });
