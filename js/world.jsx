// AtlasForge — custom world UI: brush palette, world settings, AI atlas modal,
// brush-size rail and the river card
const fmtNum = (v) => Math.round(v).toLocaleString(App.ui.lang === "ru" ? "ru-RU" : "en-US");

function WorldSection({ id, title, children, defaultOpen }) {
  const key = "wpOpen_" + id;
  const open = App.ui[key] != null ? App.ui[key] : !!defaultOpen;
  return (
    <div className="wp-group">
      <button className="wp-group-head" onClick={() => Actions.ui({ [key]: !open })}>
        <span>{open ? "▾" : "▸"}</span> {title}
      </button>
      {open && <div className="wp-group-body">{children}</div>}
    </div>
  );
}

function BrushGrid({ list, brush }) {
  return (
    <div className="wp-brushes">
      {list.map((b) => (
        <button key={b} className={"wp-brush" + (brush === b ? " on" : "")} onClick={() => Actions.setPref({ worldBrush: b })} title={t("world.brushHint." + b)}>
          <span className="wp-swatch" style={{ background: World.BRUSH_SWATCH[b] }}></span>
          <span>{t("world.brush." + b)}</span>
        </button>
      ))}
    </div>
  );
}

function WorldPalette() {
  useStore();
  const p = App.project;
  if (!p || !p.world) return null;
  const w = p.world;
  const brush = App.ui.worldBrush || "land";
  const size = App.ui.worldSize || 12;
  const collapsed = !!App.ui.worldPaletteCollapsed;
  const km = +w.scaleKm || 5;
  const stale = w.genRev != null && w.genRev !== w.rev;
  const hasProvinces = App.basemap.count > 0;
  const clim = w.climate || {};
  const po = w.provinceOpts || {};
  const setClimate = (patch) => World.setWorld({ climate: Object.assign({}, clim, patch) });
  const setPO = (patch) => World.setWorld({ provinceOpts: Object.assign({}, po, patch) });
  const strengthBrush = brush === "raise" || brush === "lower" || brush === "smooth";

  const generate = () => {
    if (hasProvinces && !confirm(t("world.regenAsk"))) return;
    Actions.toast(t("world.generating"));
    World.generate();
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

      <div className="wp-section">{t("world.groupRelief")}</div>
      <BrushGrid list={World.RELIEF_BRUSHES} brush={brush}></BrushGrid>
      <div className="wp-section">{t("world.groupCover")}</div>
      <BrushGrid list={World.COVER_BRUSHES} brush={brush}></BrushGrid>
      <div className="wp-section">{t("world.groupWater")}</div>
      <BrushGrid list={World.WATER_BRUSHES} brush={brush}></BrushGrid>

      <label className="wp-field">
        <span>{t("world.size")} — {size}</span>
        <input type="range" className="range" min="1" max="60" step="1" value={size} onChange={(e) => Actions.setPref({ worldSize: +e.target.value })}></input>
      </label>
      {strengthBrush && (
        <label className="wp-field">
          <span>{t("world.strength")} — {Math.round((+App.ui.worldStrength || 0.6) * 100)}%</span>
          <input type="range" className="range" min="0.05" max="1" step="0.05" value={+App.ui.worldStrength || 0.6}
            onChange={(e) => Actions.setPref({ worldStrength: +e.target.value })}></input>
        </label>
      )}
      {(brush === "ridge" || brush === "valley" || brush === "river") && <div className="wp-note">{t("world.lineHint")}</div>}

      <WorldSection id="brush" title={t("world.brushSettings")}>
        <label className="check-row wp-check">
          <input type="checkbox" checked={App.ui.worldPressure !== false} onChange={(e) => Actions.setPref({ worldPressure: e.target.checked })}></input>
          {t("world.pressure")}{World.pressureSupport() === "no" ? " — " + t("input.noPressureShort") : ""}
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
      </WorldSection>

      <WorldSection id="provinces" title={t("world.provinces")} defaultOpen>
        <label className="wp-field">
          <span>{t("world.cellSize")} — ≈{Math.round((w.cellSize || 18) * km)} {t("world.km")}</span>
          <input type="range" className="range" min="6" max="50" step="1" value={w.cellSize || 18}
            onChange={(e) => World.setWorld({ cellSize: +e.target.value })}></input>
        </label>
        <div className="wp-field">
          <span>{t("world.mountainsMode")}</span>
          <div className="chip-row">
            <button className={"chip" + (po.mountains !== "separate" ? " on" : "")} onClick={() => setPO({ mountains: "sides" })}>{t("world.mountainsSides")}</button>
            <button className={"chip" + (po.mountains === "separate" ? " on" : "")} onClick={() => setPO({ mountains: "separate" })}>{t("world.mountainsSeparate")}</button>
          </div>
        </div>
        <label className="check-row wp-check">
          <input type="checkbox" checked={!!po.riversAsBorders} onChange={(e) => setPO({ riversAsBorders: e.target.checked })}></input>
          {t("world.riversAsBorders")}
        </label>
        <label className="check-row wp-check">
          <input type="checkbox" checked={po.citySeeds !== false} onChange={(e) => setPO({ citySeeds: e.target.checked })}></input>
          {t("world.citySeeds")}
        </label>
        <button className={"btn " + (stale || !hasProvinces ? "primary" : "outline")} disabled={World.generating} onClick={generate}>
          {World.generating ? t("world.generating") : hasProvinces ? t("world.regenerate") : t("world.generate")}
        </button>
        {stale && <div className="wp-note">{t("world.stale")}</div>}
        <div className="wp-note">{t("world.smartHint")}</div>
      </WorldSection>

      <WorldSection id="nature" title={t("world.nature")}>
        <label className="wp-field">
          <span>{t("world.seaLevel")} — {fmtNum(w.seaLevel || 0)} {t("world.m")}</span>
          <input type="range" className="range" min="-1500" max="1500" step="10" value={w.seaLevel || 0}
            onChange={(e) => World.setWorld({ seaLevel: +e.target.value })}></input>
        </label>
        <label className="wp-field">
          <span>{t("world.latTop")} — {clim.latTop ?? 70}°</span>
          <input type="range" className="range" min="-90" max="90" step="1" value={clim.latTop ?? 70}
            onChange={(e) => setClimate({ latTop: +e.target.value })}></input>
        </label>
        <label className="wp-field">
          <span>{t("world.latBottom")} — {clim.latBottom ?? -10}°</span>
          <input type="range" className="range" min="-90" max="90" step="1" value={clim.latBottom ?? -10}
            onChange={(e) => setClimate({ latBottom: +e.target.value })}></input>
        </label>
        <label className="wp-field">
          <span>{t("world.tEquator")} — {clim.tEquator ?? 27} °C</span>
          <input type="range" className="range" min="10" max="40" step="1" value={clim.tEquator ?? 27}
            onChange={(e) => setClimate({ tEquator: +e.target.value })}></input>
        </label>
        <label className="check-row wp-check">
          <input type="checkbox" checked={w.autoRivers !== false} onChange={(e) => World.setWorld({ autoRivers: e.target.checked })}></input>
          {t("world.autoRivers")}
        </label>
        {w.autoRivers !== false && (
          <label className="wp-field">
            <span>{t("world.riverThreshold")}</span>
            <input type="range" className="range" min="15" max="400" step="5" value={w.riverThreshold || 60}
              onChange={(e) => World.setWorld({ riverThreshold: +e.target.value })}></input>
          </label>
        )}
      </WorldSection>

      <WorldSection id="map" title={t("world.mapSettings")}>
        <label className="wp-field">
          <span>{t("world.scale")}</span>
          <span className="wp-inline">
            <input type="number" className="input" min="0.1" step="0.5" value={km} style={{ width: 70 }}
              onChange={(e) => World.setWorld({ scaleKm: Math.max(0.1, +e.target.value || 5) })}></input>
            <span className="muted">{t("world.km")} · {t("world.mapSize").replace("{w}", fmtNum(World.GW * km)).replace("{h}", fmtNum(World.GH * km))}</span>
          </span>
        </label>
        <label className="wp-field">
          <span>{t("world.fillOpacity")} — {Math.round((p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62) * 100)}%</span>
          <input type="range" className="range" min="0.15" max="1" step="0.01" value={p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62}
            onChange={(e) => Actions.setSettings({ worldFillOpacity: +e.target.value }, { undo: false })}></input>
        </label>
        {w.autoRivers === false && (w.rivers || []).length > 0 && (
          <div className="wp-rivers">
            {(w.rivers || []).map((rv) => (
              <div key={rv.id} className="wp-river">
                <input className="input" value={rv.name} onChange={(e) => World.renameRiver(rv.id, e.target.value)}></input>
                <button className="btn icon" title={t("world.deleteRiver")} onClick={() => World.deleteRiver(rv.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="wp-row">
          <button className="btn outline" onClick={() => { if (confirm(t("world.randomAsk"))) World.randomContinent(); }}>{t("world.random")}</button>
          <button className="btn outline" onClick={() => { if (confirm(t("world.clearAsk"))) World.clearTerrain(); }}>{t("world.clear")}</button>
        </div>
      </WorldSection>

      <button className="btn primary" disabled={!hasProvinces} onClick={() => Actions.ui({ modal: "atlas" })}>{t("world.atlas")}</button>
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

// ---------- cards (tap a river…) ----------
// analysis of the current provinces + rivers, cached per basemap / hydrology / project version
let worldAnalysisCache = null;
function worldAnalysis() {
  const key = App.basemap.count + ":" + (World.hydro ? World.hydro.rev : 0) + ":" + World.rasterRev + ":" + App.terrVersion + ":" + App.ui.lang;
  if (!worldAnalysisCache || worldAnalysisCache.key !== key || worldAnalysisCache.bm !== App.basemap) {
    const feats = (App.basemap.raw && App.basemap.raw.features) || [];
    const rivers = World.displayRivers();
    const an = Atlas.analyze(feats, rivers);
    worldAnalysisCache = { key, bm: App.basemap, an, feats, rivers, names: Atlas.names(an, App.ui.lang === "ru" ? "ru" : "en") };
  }
  return worldAnalysisCache;
}

function CardRow({ k, v }) {
  if (v == null || v === "") return null;
  return <div className="card-row"><span className="card-k">{k}</span><span className="card-v">{v}</span></div>;
}

function RiverCard({ index }) {
  useStore();
  const p = App.project;
  const w = p.world;
  const { an, feats, rivers, names } = worldAnalysis();
  const rv = rivers.find((r) => r.index === index);
  if (!rv) return null;
  const ri = an.rivers.find((x) => x.rv === rv);
  const km = +w.scaleKm || 5;
  const provName = (i) => { const f = feats[i]; const r = p.regions[String(f.id)]; return (r && r.name) || (f.properties && f.properties.name) || f.id; };
  const ownerOf = (i) => { const e = effRegion(p, String(feats[i].id)); return e && e.owner && p.states[e.owner] ? e.owner : null; };
  const autoName = ri ? names.riverLabel[ri.k] : "";
  const cells = World.riverCellsOf(rv);
  const srcH = cells.length ? an.dg.h[cells[0]] : 0;
  const len = ri ? ri.len * km : 0;
  const thr = +w.riverThreshold || 60;
  const size = rv.flux ? (rv.flux < thr * 3 ? 0 : rv.flux < thr * 12 ? 1 : rv.flux < thr * 40 ? 2 : 3) : null;
  const navigable = (rv.order || 0) >= 4 || (rv.flux && rv.flux >= thr * 12);
  const states = [];
  (ri ? ri.cells : []).forEach((i) => { const o = ownerOf(i); const nm = o ? p.states[o].name : t("card.noOwner"); if (states[states.length - 1] !== nm) states.push(nm); });
  const into = rv.into >= 0 ? rivers.find((r) => r.index === rv.into) : null;
  const intoRi = into ? an.rivers.find((x) => x.rv === into) : null;
  const mouthWater = ri && ri.mouthWater >= 0 ? names.waterLabel[ri.mouthWater] : null;
  const mouthText = into ? (into.name || (intoRi ? names.riverLabel[intoRi.k] : t("card.unnamed")))
    : (mouthWater || (rv.mouthType === "land" ? t("card.sink") : t("card.sea")));
  const tributaries = rivers.filter((r) => r.into === rv.index);
  let basinArea = null;
  const hy = World.hydro;
  if (hy && rv.cells && rv.cells.length) {
    const b = hy.basin[rv.cells[rv.cells.length - 1]];
    let n = 0;
    for (let i = 0; i < hy.basin.length; i++) if (hy.basin[i] === b) n++;
    basinArea = n * km * km;
  }
  const firstProv = ri && ri.cells.length ? ri.cells[0] : -1, lastProv = ri && ri.cells.length ? ri.cells[ri.cells.length - 1] : -1;
  const handRec = rv.hand ? (w.rivers || []).find((r) => r.id === rv.id) : null;
  const notes = rv.hand ? ((handRec && handRec.notes) || "") : (rv.notes || "");
  const rename = (name) => (rv.hand ? World.renameRiver(rv.id, name) : World.nameRiver(rv, name, null));
  const setNotes = (text) => {
    if (rv.hand) Actions.mut((pp) => { const r = pp.world.rivers.find((x) => x.id === rv.id); if (r) r.notes = text; }, { undo: false });
    else World.nameRiver(rv, rv.name != null ? rv.name : autoName, text);
  };
  const zoom = () => {
    const proj = App.basemap.proj;
    const xs = rv.pts.map((q) => q[0]), ys = rv.pts.map((q) => q[1]);
    MapAPI.zoomTo([proj([Math.min(...xs) - 6, Math.min(...ys) - 6]), proj([Math.max(...xs) + 6, Math.max(...ys) + 6])]);
  };
  return (
    <div className="info-card" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="card-head">
        <span className="card-kind">〰 {t("card.river")}</span>
        <button className="btn icon" onClick={() => Actions.ui({ card: null })}>✕</button>
      </div>
      <input className="input card-title" value={rv.name != null ? rv.name : ""} placeholder={autoName || t("card.unnamedRiver")} onChange={(e) => rename(e.target.value)}></input>
      <div className="card-grid">
        <CardRow k={t("card.length")} v={len ? "≈ " + fmtNum(len) + " " + t("world.km") : null}></CardRow>
        {rv.order ? <CardRow k={t("card.order")} v={rv.order}></CardRow> : null}
        {size != null ? <CardRow k={t("card.size")} v={t("card.size" + size)}></CardRow> : null}
        {rv.flux ? <CardRow k={t("card.navigable")} v={navigable ? t("card.yes") : t("card.no")}></CardRow> : null}
        <CardRow k={t("card.source")} v={[srcH > 0 ? fmtNum(srcH) + " " + t("world.m") : "", firstProv >= 0 ? provName(firstProv) : "", rv.sourceType === "lake" ? t("card.fromLake") : ""].filter(Boolean).join(" · ")}></CardRow>
        <CardRow k={t("card.mouth")} v={[mouthText, lastProv >= 0 ? provName(lastProv) : ""].filter(Boolean).join(" · ")}></CardRow>
        {basinArea ? <CardRow k={t("card.basin")} v={"≈ " + fmtNum(basinArea) + " " + t("world.km2")}></CardRow> : null}
        {states.length ? <CardRow k={t("card.states")} v={states.join(" → ")}></CardRow> : null}
        {tributaries.length ? <CardRow k={t("card.tributaries")} v={tributaries.map((r) => r.name || t("card.unnamed")).join(", ")}></CardRow> : null}
      </div>
      <textarea className="textarea card-notes" placeholder={t("card.notes")} value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
      <div className="card-actions">
        <button className="btn outline" onClick={zoom}>{t("card.showOnMap")}</button>
      </div>
    </div>
  );
}

function WorldCard() {
  useStore();
  const card = App.ui.card;
  if (!card) return null;
  if (card.kind === "river" && World.active()) return <RiverCard index={card.index}></RiverCard>;
  if (card.kind === "object" && window.ObjectCard) return <ObjectCard id={card.id}></ObjectCard>;
  return null;
}

function AtlasModal() {
  useStore();
  const [withProvinces, setWithProvinces] = React.useState(true);
  const text = React.useMemo(() => {
    try { return Atlas.build({ provinces: withProvinces }); } catch (e) { console.error(e); return String(e); }
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

Object.assign(window, { WorldPalette, AtlasModal, WorldSizeRail, WorldCard, worldAnalysis, CardRow, fmtNum });
