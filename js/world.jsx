// AtlasForge — custom world UI: brush palette, world settings, the geography pass (options
// sheet + preview bar), AI atlas modal, brush-size rail and the river card
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
  const cutting = !!(World.cutPreview || World.generating);
  const busy = !!(World.preview || World.geoBusy || cutting);
  const rivers = w.rivers || [];

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

      {w.legacyAuto && !busy && (
        <div className="wp-banner">
          <div>{t("world.legacy.text")}</div>
          <button className="btn outline" onClick={() => World.setWorld({ legacyAuto: false })}>{t("world.legacy.ok")}</button>
        </div>
      )}

      <button className="btn primary wp-geo" disabled={busy} onClick={() => Actions.ui({ modal: "geo", card: null })}>{t("world.geo.button")}</button>
      <div className="wp-note">{cutting ? t("world.cut.previewing") : busy ? t("world.geo.previewing") : t("world.geo.hint")}</div>

      {!busy && (
        <React.Fragment>
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
            <label className="check-row wp-check">
              <input type="checkbox" checked={!!po.joinIslets} onChange={(e) => setPO({ joinIslets: e.target.checked })}></input>
              {t("world.joinIslets")}
            </label>
            <button className={"btn " + (stale || !hasProvinces ? "primary" : "outline")} disabled={World.generating} onClick={() => World.generate()}>
              {World.generating ? t("world.generating") : hasProvinces ? t("world.regenerate") : t("world.generate")}
            </button>
            {stale && <div className="wp-note">{t("world.stale")}</div>}
            <div className="wp-note">{t("world.smartHint")}</div>
          </WorldSection>

          <WorldSection id="rivers" title={t("world.rivers") + (rivers.length ? " (" + rivers.length + ")" : "")}>
            {!rivers.length && <div className="wp-note">{t("world.noRivers")}</div>}
            {rivers.length > 0 && (
              <div className="wp-rivers">
                {rivers.map((rv) => (
                  <div key={rv.id} className="wp-river">
                    <input className="input" value={rv.name || ""} placeholder={t("card.unnamedRiver")} onChange={(e) => World.renameRiver(rv.id, e.target.value)}></input>
                    <button className="btn icon" title={t("world.deleteRiver")} onClick={() => World.deleteRiver(rv.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </WorldSection>

          <WorldSection id="nature" title={t("world.nature")}>
            <label className="wp-field">
              <span>{t("world.seaLevel")} — {fmtNum(w.seaLevel || 0)} {t("world.m")}</span>
              <input type="range" className="range" min="-1500" max="1500" step="10" value={w.seaLevel || 0}
                onChange={(e) => World.setWorld({ seaLevel: +e.target.value })}></input>
            </label>
            <label className="wp-field">
              <span>{t("world.snowline")} — {fmtNum(w.snowline || 4200)} {t("world.m")}</span>
              <input type="range" className="range" min="1000" max="7000" step="100" value={w.snowline || 4200}
                onChange={(e) => World.setWorld({ snowline: +e.target.value })}></input>
            </label>
            <div className="wp-note">{t("world.climateHint")}</div>
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
            <label className="wp-field">
              <span>{t("world.tPole")} — {clim.tPole ?? -28} °C</span>
              <input type="range" className="range" min="-50" max="10" step="1" value={clim.tPole ?? -28}
                onChange={(e) => setClimate({ tPole: +e.target.value })}></input>
            </label>
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
            <div className="wp-row">
              <button className="btn outline" onClick={() => { if (confirm(t("world.randomAsk"))) World.randomContinent(); }}>{t("world.random")}</button>
              <button className="btn outline" onClick={() => { if (confirm(t("world.clearAsk"))) World.clearTerrain(); }}>{t("world.clear")}</button>
            </div>
          </WorldSection>

          <button className="btn primary" disabled={!hasProvinces} onClick={() => Actions.ui({ modal: "atlas" })}>{t("world.atlas")}</button>
          <div className="wp-note">{t("world.labelsHint")}</div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------- "Поправить географию" ----------
// the options sheet: what the pass may change, then a preview on the map
function GeoSheet() {
  useStore();
  const p = App.project;
  const [o, setO] = React.useState(() => Object.assign({}, World.GEO_DEFAULTS, (p && p.world && p.world.geoOpts) || {}));
  if (!p || !p.world || !World.active()) return null;
  const set = (patch) => setO(Object.assign({}, o, patch));
  const hasRivers = (p.world.rivers || []).some((r) => !r.auto);
  const any = o.fixRivers || o.addRivers || o.tributaries || o.lakes || o.biomes || o.foothills || o.erosion;
  const legacy = World.handCoverShare(); // % of land whose cover the fix leaves alone
  const close = () => Actions.ui({ modal: null });
  const run = () => {
    World.setWorld({ geoOpts: Object.assign({}, o, { repaintAll: false }) }); // repainting everything is never remembered
    close();
    World.runGeography(o);
  };
  const opt = (k, extra) => (
    <label className={"geo-opt" + (o[k] ? " on" : "")}>
      <input type="checkbox" checked={!!o[k]} onChange={(e) => set({ [k]: e.target.checked })}></input>
      <span className="geo-opt-text">
        <b>{t("world.geo.opt." + k)}</b>
        <span>{t("world.geo.desc." + k)}</span>
        {extra}
      </span>
    </label>
  );
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal geo-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("world.geo.title")}</span>
          <button className="btn icon" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <div className="muted">{t("world.geo.intro")}</div>
          <div className="wp-section">{t("world.geo.groupWater")}</div>
          {opt("fixRivers", !hasRivers ? <span className="geo-opt-warn">{t("world.geo.noDrawnRivers")}</span> : null)}
          {opt("tributaries", !hasRivers ? <span className="geo-opt-warn">{t("world.geo.noDrawnRivers")}</span> : null)}
          {opt("addRivers")}
          {o.addRivers && (
            <label className="wp-field geo-slider">
              <span>{t("world.geo.density")}</span>
              <input type="range" className="range" min="0" max="1" step="0.05" value={o.density == null ? 0.5 : o.density}
                onChange={(e) => set({ density: +e.target.value })}></input>
            </label>
          )}
          {opt("lakes")}
          <div className="wp-section">{t("world.geo.groupLand")}</div>
          {opt("biomes")}
          {o.biomes && legacy >= 30 && !o.repaintAll && <div className="wp-note geo-legacy">{t("world.geo.legacyCover").replace("{n}", legacy)}</div>}
          {o.biomes && legacy >= 1 && opt("repaintAll")}
          {opt("foothills")}
          {opt("erosion")}
        </div>
        <div className="modal-foot">
          <button className="btn outline" onClick={close}>{t("modal.cancel")}</button>
          <button className="btn primary" disabled={!any} onClick={run}>{t("world.geo.run")}</button>
        </div>
      </div>
    </div>
  );
}

// what the pass changed, in plain words
function geoReportLines(r, opts) {
  const names = (list) => {
    const named = list.filter(Boolean);
    if (!named.length) return "";
    return " (" + named.slice(0, 3).join(", ") + (named.length > 3 ? "…" : "") + ")";
  };
  const out = [];
  if (opts.fixRivers) {
    if (r.reversed.length) out.push(t("world.geo.r.reversed").replace("{n}", r.reversed.length) + names(r.reversed));
    if (r.extended.length) {
      const km = r.extended.reduce((s, e) => s + e.km, 0);
      out.push(t("world.geo.r.extended").replace("{n}", r.extended.length).replace("{km}", fmtNum(km)) + names(r.extended.map((e) => e.name)));
    }
    if (r.gorges.length) out.push(t("world.geo.r.gorges").replace("{n}", r.gorges.length) + names(r.gorges));
    if (!r.reversed.length && !r.extended.length && !r.gorges.length) out.push(t("world.geo.r.riversOk"));
  }
  if (opts.addRivers || opts.tributaries) {
    out.push(t("world.geo.r.added").replace("{n}", r.added).replace("{m}", r.tributaries) +
      (r.replaced ? " " + t("world.geo.r.replaced").replace("{n}", r.replaced) : ""));
    if (r.named) out.push(t("world.geo.r.named").replace("{n}", r.named));
  }
  if (opts.tributaries && r.systems && r.systems.length) {
    const sys = r.systems.slice().sort((a, b) => b.km2 - a.km2);
    const list = sys.slice(0, 3).map((sy) => t("world.geo.r.system").replace("{name}", sy.name ? "«" + sy.name + "»" : t("world.geo.r.unnamed"))
      .replace("{km}", fmtNum(Math.round(sy.km2 / 1000) * 1000)).replace("{n}", sy.tribs || 0) + (sy.boosted ? t("world.geo.r.systemWet") : ""));
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
    return (
      <div className="geo-bar" data-export-skip="1">
        <div className="geo-bar-busy"><div className="spinner"></div><span>{t("world.geo.running")}</span></div>
      </div>
    );
  }
  const pv = World.preview;
  if (!pv) return null;
  const off = () => World.setCompare(false);
  return (
    <div className="geo-bar" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="geo-bar-title">{World.compare ? t("world.geo.showingBefore") : t("world.geo.previewTitle")}</div>
      <ul className="geo-report">
        {geoReportLines(pv.report, pv.opts).map((line, i) => <li key={i}>{line}</li>)}
      </ul>
      <div className="geo-bar-actions">
        <button className={"btn outline geo-hold" + (World.compare ? " on" : "")}
          onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} World.setCompare(true); }}
          onPointerUp={off} onPointerCancel={off} onLostPointerCapture={off} onContextMenu={(e) => e.preventDefault()}>
          {t("world.geo.holdBefore")}
        </button>
        <button className="btn outline" onClick={() => { World.cancelGeography(); Actions.ui({ modal: "geo" }); }}>{t("world.geo.adjust")}</button>
        <button className="btn outline" onClick={() => World.cancelGeography()}>{t("world.geo.discard")}</button>
        <button className="btn primary" onClick={() => World.applyGeography()}>{t("world.geo.apply")}</button>
      </div>
    </div>
  );
}

// preview of a new province cut: what it did, what its borders follow, apply or discard
function CutBar() {
  useStore();
  if (World.generating) {
    return (
      <div className="geo-bar" data-export-skip="1">
        <div className="geo-bar-busy"><div className="spinner"></div><span>{t("world.generating")}</span></div>
      </div>
    );
  }
  const pv = World.cutPreview;
  if (!pv) return null;
  const r = pv.report || {};
  const lines = [t("world.cut.r.count").replace("{n}", fmtNum(pv.count)) + (pv.before ? " " + t("world.cut.r.before").replace("{n}", fmtNum(pv.before)) : "")];
  if (r.straits) lines.push(t("world.cut.r.straits").replace("{n}", r.straits));
  if (r.isthmuses) lines.push(t("world.cut.r.isthmuses").replace("{n}", r.isthmuses));
  if (r.crests) lines.push(t("world.cut.r.crests").replace("{n}", r.crests));
  if (pv.opts.riversAsBorders) lines.push(t("world.cut.r.rivers"));
  if (r.islets) lines.push(t("world.cut.r.islets").replace("{n}", r.islets));
  const many = pv.expected > 0 && pv.count > pv.expected * 1.3 + 3;
  return (
    <div className="geo-bar" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="geo-bar-title">{t("world.cut.title")}</div>
      <ul className="geo-report">
        {lines.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
      {many && <div className="geo-opt-warn">{t("world.cut.many")}</div>}
      <label className="check-row cut-why-toggle">
        <input type="checkbox" checked={World.cutWhy} onChange={(e) => World.setCutWhy(e.target.checked)}></input>
        {t("world.cut.why")}
      </label>
      {World.cutWhy && (
        <div className="cut-legend">
          {["strait", "isthmus", "river", "crest"].map((k, i) => (
            <span key={k}><i style={{ background: World.WHY_COLORS[i + 1] }}></i>{t("world.cut.why." + k)}</span>
          ))}
        </div>
      )}
      <div className="geo-bar-actions">
        <button className="btn outline" onClick={() => World.cancelCut()}>{t("world.geo.discard")}</button>
        <button className="btn primary" onClick={() => World.applyCut()}>{t("world.geo.apply")}</button>
      </div>
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
  const riversRef = World.preview && !World.compare ? World.preview.rivers : (App.project.world.rivers || []);
  // owners and names do not enter the analysis: political edits keep the cache (a geometry
  // edit reloads the basemap, which does)
  const key = App.basemap.count + ":" + (World.hydro ? World.hydro.rev : 0) + ":" + World.rasterRev + ":" + App.ui.lang +
    ":" + (World.watersFresh() ? World.waters.key : ""); // the seas and gulfs, once worked out
  const c = worldAnalysisCache;
  if (!c || c.key !== key || c.bm !== App.basemap || c.riversRef !== riversRef) {
    const feats = (App.basemap.raw && App.basemap.raw.features) || [];
    const rivers = World.displayRivers();
    worldAnalysisCache = { key, bm: App.basemap, riversRef, an: Atlas.analyze(feats, rivers), feats, rivers };
  }
  // names change while typing: refresh them without redoing the analysis
  const wa = worldAnalysisCache;
  wa.rivers.forEach((rv) => { const rec = riversRef[rv.index]; if (rec) { rv.name = rec.name; rv.notes = rec.notes || ""; } });
  wa.names = Atlas.names(wa.an, App.ui.lang === "ru" ? "ru" : "en");
  return wa;
}

// ---------- names by a rule for the selected provinces ----------
const NAME_RULE_DEFAULT = { starts: "", samples: "", endings: "", length: "medium", geography: true, replaceAuto: true, replaceManual: false };
// what naming needs to know about a province: its area (landmass + drainage basin) and the
// kind of place it is
function nameItems(ids) {
  const wa = worldAnalysis();
  const idx = new Map(wa.feats.map((f, i) => [String(f.id), i]));
  const items = ids.map((id) => {
    const i = idx.get(String(id));
    const c = i != null ? wa.an.cells[i] : null;
    const props = (i != null && wa.feats[i].properties) || {};
    let land = -1, bv = 0;
    if (c) c.lands.forEach((v, k) => { if (v > bv) { bv = v; land = k; } });
    const island = land >= 0 && wa.an.lands[land] && wa.an.lands[land].area < wa.names.totalLand * 0.08;
    const terr = props.terrain;
    const kind = terr === "mountain" ? "mountain" : island ? "island" : props.coastal ? "coast" : c && c.rivers.size ? "river"
      : terr === "forest" || terr === "taiga" || terr === "jungle" ? "forest" : terr === "marsh" ? "marsh"
      : terr === "desert" ? "desert" : terr === "hills" ? "hills" : null;
    return { id, area: land + ":" + (props.basin != null ? props.basin : ""), kind,
      x: c && c.land ? c.sx / c.land : 0, y: c && c.land ? c.sy / c.land : 0 };
  });
  // area by area, each from north-west
  const areaY = new Map();
  items.forEach((it) => { if (!areaY.has(it.area) || it.y < areaY.get(it.area)) areaY.set(it.area, it.y); });
  return items.sort((a, b) => (areaY.get(a.area) - areaY.get(b.area)) || (a.area < b.area ? -1 : a.area > b.area ? 1 : 0) || (a.y - b.y) || (a.x - b.x));
}

function NameRuleModal() {
  useStore();
  const p = App.project;
  const [rule, setRule] = React.useState(() => Object.assign({}, NAME_RULE_DEFAULT, (p && p.world && p.world.nameRule) || {}));
  const [seed, setSeed] = React.useState(1);
  const [fixed, setFixed] = React.useState({}); // id -> a name picked again for one province
  const ids = App.ui.nameIds || [];
  const lang = App.ui.lang === "ru" ? "ru" : "en";
  const active = !!(p && World.active() && window.NameGen);
  const recs = active ? ids.filter((id) => App.basemap.byId[id]).map((id) => ({ id, r: p.regions[id] || {}, f: App.basemap.byId[id] })) : [];
  const manual = recs.filter((x) => x.r.name && !x.r.nameAuto);
  const auto = recs.filter((x) => x.r.name && x.r.nameAuto);
  const targets = recs.filter((x) => !x.r.name || (x.r.nameAuto ? rule.replaceAuto : rule.replaceManual));
  const targetKey = targets.map((x) => x.id).join(",");
  const items = React.useMemo(() => (active ? nameItems(targets.map((x) => x.id)) : []), [active, targetKey, App.basemap]);
  // names already on the map stay unique
  const taken = React.useMemo(() => {
    if (!active) return [];
    const tset = new Set(targets.map((x) => x.id));
    const out = [];
    Object.keys(p.regions).forEach((id) => { const r = p.regions[id]; if (r && r.name && !tset.has(id)) out.push(r.name); });
    Object.values(p.states).forEach((st) => { if (st.name) out.push(st.name); });
    return out;
  }, [active, targetKey, App.version]);
  const ruleKey = JSON.stringify([rule.starts, rule.samples, rule.endings, rule.length, rule.geography]);
  const names = React.useMemo(() => (active ? NameGen.nameAll(rule, items, taken, { seed, lang }) : {}), [active, ruleKey, items, taken, seed, lang]);
  if (!active) return null;
  const close = () => Actions.ui({ modal: null });
  const set = (patch) => { setRule(Object.assign({}, rule, patch)); setFixed({}); };
  const nameOf = (id) => fixed[id] || names[id];
  const reroll = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const others = taken.concat(items.map((x) => nameOf(x.id)).filter(Boolean));
    const nm = NameGen.nameOne(rule, it, others, { seed: NameGen.hash(id + ":" + seed + ":" + Object.keys(fixed).length + ":" + Date.now()), lang });
    if (nm) setFixed(Object.assign({}, fixed, { [id]: nm }));
  };
  const apply = () => {
    const out = {};
    targets.forEach((x) => { const nm = nameOf(x.id); if (nm) out[x.id] = nm; });
    Actions.setRegionNames(out, { auto: true, rule: Object.assign({}, rule) });
    Actions.toast(t("names.done").replace("{n}", Object.keys(out).length));
    close();
  };
  const oldName = (x) => x.r.name || (x.f && x.f.name) || x.id;
  const kept = recs.length - targets.length;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal names-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("names.title")}</span>
          <button className="btn icon" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          <div className="muted">{t("names.intro").replace("{n}", recs.length)}</div>
          <label className="wp-field">
            <span>{t("names.starts")}</span>
            <input className="input" value={rule.starts} placeholder={t("names.startsPh")} onChange={(e) => set({ starts: e.target.value })}></input>
          </label>
          <label className="wp-field">
            <span>{t("names.samples")}</span>
            <input className="input" value={rule.samples} placeholder={t("names.samplesPh")} onChange={(e) => set({ samples: e.target.value })}></input>
            <span className="names-hint">{t("names.samplesHint")}</span>
          </label>
          <label className="wp-field">
            <span>{t("names.endings")}</span>
            <input className="input" value={rule.endings} placeholder={t("names.endingsPh")} onChange={(e) => set({ endings: e.target.value })}></input>
          </label>
          <div className="wp-field">
            <span>{t("names.length")}</span>
            <div className="chip-row">
              {["short", "medium", "long"].map((k) => (
                <button key={k} className={"chip" + (rule.length === k ? " on" : "")} onClick={() => set({ length: k })}>{t("names.length." + k)}</button>
              ))}
            </div>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={!!rule.geography} onChange={(e) => set({ geography: e.target.checked })}></input>
            <span>{t("names.geography")}<span className="names-hint"> — {t("names.geographyHint")}</span></span>
          </label>
          {auto.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={!!rule.replaceAuto} onChange={(e) => set({ replaceAuto: e.target.checked })}></input>
              {t("names.replaceAuto").replace("{n}", auto.length)}
            </label>
          )}
          {manual.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={!!rule.replaceManual} onChange={(e) => set({ replaceManual: e.target.checked })}></input>
              <span className={rule.replaceManual ? "names-danger" : ""}>{t("names.replaceManual").replace("{n}", manual.length)}</span>
            </label>
          )}
          <div className="names-summary">
            {t("names.summary").replace("{n}", targets.length)}{kept ? " " + t("names.kept").replace("{n}", kept) : ""}
          </div>
          {targets.length > 0 && (
            <div className="names-list">
              {items.map((it) => {
                const x = targets.find((y) => y.id === it.id);
                return (
                  <div key={it.id} className="names-row">
                    <span className="names-old">{oldName(x)}</span>
                    <span className="names-arrow">→</span>
                    <b className="names-new">{nameOf(it.id) || "—"}</b>
                    <button className="btn icon" title={t("names.reroll")} onClick={() => reroll(it.id)}>↻</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn outline" disabled={!targets.length} onClick={() => { setSeed(seed + 1); setFixed({}); }}>{t("names.another")}</button>
          <button className="btn outline" onClick={close}>{t("modal.cancel")}</button>
          <button className="btn primary" disabled={!targets.length} onClick={apply}>{t("names.apply")}</button>
        </div>
      </div>
    </div>
  );
}

// where a province of a custom world lies, in one line (region panel)
function ProvinceGeo({ id }) {
  if (!World.active() || !App.basemap.raw) return null;
  let line = "";
  try {
    const wa = worldAnalysis();
    const i = wa.feats.findIndex((f) => String(f.id) === String(id));
    if (i >= 0) line = Atlas.provinceLine(wa.an, wa.names, i, App.ui.lang === "ru" ? "ru" : "en", wa.feats[i].properties);
  } catch (e) { console.warn(e); }
  return line ? <div className="muted province-geo">{line}</div> : null;
}

function CardRow({ k, v }) {
  if (v == null || v === "") return null;
  return <div className="card-row"><span className="card-k">{k}</span><span className="card-v">{v}</span></div>;
}

// a river parameter: automatic (computed from the drawing) or set by hand
function RiverParam({ label, value, autoLabel, options, onChange }) {
  const manual = value != null;
  return (
    <div className="card-row card-param">
      <span className="card-k">{label}</span>
      <span className="card-v">
        <select className={"select card-select" + (manual ? " manual" : "")} value={manual ? String(value) : "auto"}
          onChange={(e) => onChange(e.target.value === "auto" ? null : e.target.value)}>
          <option value="auto">{t("card.auto").replace("{v}", autoLabel)}</option>
          {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      </span>
    </div>
  );
}

function RiverCard({ index }) {
  useStore();
  const [help, setHelp] = React.useState(false);
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
  const mouthH = cells.length ? an.dg.h[cells[cells.length - 1]] : 0;
  const len = ri ? ri.len * km : 0;
  const states = [];
  (ri ? ri.cells : []).forEach((i) => { const o = ownerOf(i); const nm = o ? p.states[o].name : t("card.noOwner"); if (states[states.length - 1] !== nm) states.push(nm); });
  const into = rv.into >= 0 ? rivers.find((r) => r.index === rv.into) : null;
  const intoRi = into ? an.rivers.find((x) => x.rv === into) : null;
  const mouthWater = ri && ri.mouthWater >= 0 ? names.waterLabel[ri.mouthWater] : null;
  const mouthText = into ? (into.name || (intoRi ? names.riverLabel[intoRi.k] : t("card.unnamed")))
    : rv.mouthType === "water" ? (mouthWater || t("card.sea")) : rv.mouthType === "edge" ? t("card.edge") : t("card.sink");
  const tributaries = rivers.filter((r) => r.into === rv.index);
  const firstProv = ri && ri.cells.length ? ri.cells[0] : -1, lastProv = ri && ri.cells.length ? ri.cells[ri.cells.length - 1] : -1;
  const uphill = srcH > 0 && mouthH > srcH + 50;
  const rec = (w.rivers || [])[rv.index] || {}; // live record: typing edits it in place
  const man = rec.manual || {};
  // fit the river into the part of the map the card leaves free (left of a docked card,
  // above a bottom sheet), so its source and mouth handles can be reached
  const zoom = () => {
    const proj = App.basemap.proj;
    const xs = rv.pts.map((q) => q[0]), ys = rv.pts.map((q) => q[1]);
    const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, y0 = Math.min(...ys) - 6, y1 = Math.max(...ys) + 6;
    const docked = window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
    MapAPI.zoomTo(docked ? [proj([x0, y0]), proj([x1 + (x1 - x0) * 0.9, y1])] : [proj([x0, y0]), proj([x1, y1 + (y1 - y0) * 1.2])]);
  };
  const minimized = !!App.ui.cardMin;
  if (minimized) {
    return (
      <div className="info-card minimized" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
        <div className="card-head">
          <span className="card-kind">〰 {rec.name || autoName || t("card.unnamedRiver")}</span>
          <span className="card-head-actions">
            <button className="btn icon card-min-btn" title={t("card.expand")} onClick={() => Actions.ui({ cardMin: false })}>⌃</button>
            <button className="btn icon" onClick={() => Actions.ui({ card: null })}>✕</button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="info-card" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="card-head">
        <span className="card-kind">〰 {t("card.river")}</span>
        <span className="card-head-actions">
          <button className="btn icon card-min-btn" title={t("card.minimize")} onClick={() => Actions.ui({ cardMin: true })}>⌄</button>
          <button className="btn icon" onClick={() => Actions.ui({ card: null })}>✕</button>
        </span>
      </div>
      <input className="input card-title" value={rec.name || ""} placeholder={autoName || t("card.unnamedRiver")} onChange={(e) => World.renameRiver(rv.id, e.target.value)}></input>
      <div className="card-grid">
        <CardRow k={t("card.length")} v={len ? "≈ " + fmtNum(len) + " " + t("world.km") : null}></CardRow>
        {tributaries.length ? <CardRow k={t("card.withTributaries")} v={"≈ " + fmtNum(rv.upLen * km) + " " + t("world.km")}></CardRow> : null}
        <RiverParam label={t("card.size")} value={man.size} autoLabel={t("card.size" + rv.sizeAuto)}
          options={[0, 1, 2, 3].map((v) => ({ value: v, label: t("card.size" + v) }))}
          onChange={(v) => World.setRiverManual(rv.id, { size: v == null ? null : +v })}></RiverParam>
        <RiverParam label={t("card.order")} value={man.order} autoLabel={String(rv.orderAuto)}
          options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ({ value: v, label: String(v) }))}
          onChange={(v) => World.setRiverManual(rv.id, { order: v == null ? null : +v })}></RiverParam>
        <RiverParam label={t("card.navigable")} value={man.navigable} autoLabel={rv.navigableAuto ? t("card.yes") : t("card.no")}
          options={[{ value: true, label: t("card.yes") }, { value: false, label: t("card.no") }]}
          onChange={(v) => World.setRiverManual(rv.id, { navigable: v == null ? null : v === "true" })}></RiverParam>
        <button className="card-help-toggle" onClick={() => setHelp(!help)}>{help ? "▾ " : "ⓘ "}{t("card.paramsHelp")}</button>
        {help && (
          <div className="card-help">
            <p>{t("card.sizeHelp").replace("{a}", fmtNum(World.SIZE_KM[0])).replace("{b}", fmtNum(World.SIZE_KM[1])).replace("{c}", fmtNum(World.SIZE_KM[2]))}</p>
            <p>{t("card.orderHelp")}</p>
            <p>{t("card.navHelp")}</p>
          </div>
        )}
        <CardRow k={t("card.source")} v={[srcH > 0 ? fmtNum(srcH) + " " + t("world.m") : "", firstProv >= 0 ? provName(firstProv) : "", rv.sourceType === "lake" ? t("card.fromLake") : ""].filter(Boolean).join(" · ")}></CardRow>
        <CardRow k={t("card.mouth")} v={[mouthText, lastProv >= 0 ? provName(lastProv) : ""].filter(Boolean).join(" · ")}></CardRow>
        <div className="card-ends">
          <span className="card-ends-text">{t("card.endsHint")}</span>
          <button className="btn outline" onClick={() => World.reverseRiver(rv.id)}>{t("card.reverse")}</button>
        </div>
        {states.length ? <CardRow k={t("card.states")} v={states.join(" → ")}></CardRow> : null}
        {tributaries.length ? <CardRow k={t("card.tributaries")} v={tributaries.map((r) => { const x = an.rivers.find((q) => q.rv === r); return r.name || (x ? names.riverLabel[x.k] : t("card.unnamed")); }).join(", ")}></CardRow> : null}
      </div>
      {uphill && <div className="card-warn">{t("card.uphill")}</div>}
      <textarea className="textarea card-notes" placeholder={t("card.notes")} value={rec.notes || ""} onChange={(e) => World.setRiverNotes(rv.id, e.target.value)}></textarea>
      <div className="card-actions">
        <button className="btn outline" onClick={zoom}>{t("card.showOnMap")}</button>
        <button className="btn outline danger" onClick={() => World.deleteRiver(rv.id)}>{t("world.deleteRiver")}</button>
      </div>
    </div>
  );
}

// ---------- seas, gulfs and straits: the card of a water zone ----------
// the provinces along a zone's shore (the analysis grid under the province raster), kept
// per zone while the zones and the provinces stay the same
let waterCoastCache = null;
function waterCoast(zid) {
  const ws = World.waters, wa = worldAnalysis();
  const key = ws.key + ":" + wa.key;
  if (!waterCoastCache || waterCoastCache.key !== key) waterCoastCache = { key, map: new Map() };
  const hit = waterCoastCache.map.get(zid);
  if (hit) return hit;
  const W = World.GW, H = World.GH, zone = ws.zone, cellOf = wa.an.cellOf, z = ws.zones[zid];
  const prov = new Map(), lands = new Map();
  const lid = World.dataGrid().landId;
  const [x0, y0, x1, y1] = z.box;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      if (zone[i] !== zid) continue;
      const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nbs) {
        if (j < 0 || zone[j] >= 0) continue;
        const c = cellOf[j];
        if (c >= 0) prov.set(c, (prov.get(c) || 0) + 1);
        if (lid && lid[j] >= 0) lands.set(lid[j], (lands.get(lid[j]) || 0) + 1);
      }
    }
  }
  const out = { prov, lands };
  waterCoastCache.map.set(zid, out);
  return out;
}

function WaterCard({ pt }) {
  useStore();
  const [help, setHelp] = React.useState(false);
  React.useEffect(() => { World.ensureWaters().catch((e) => console.warn("water zones", e)); });
  const p = App.project;
  const close = () => Actions.ui({ card: null, waterMerge: null, waterCut: false });
  const ws = World.waters && World.waters.project === p ? World.waters : null;
  const zid = ws ? World.waterZoneAt(pt, true) : -1;
  if (!ws || zid < 0) {
    return (
      <div className="info-card minimized" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
        <div className="card-head">
          <span className="card-kind">🌊 {ws ? t("water.gone") : t("water.counting")}</span>
          <span className="card-head-actions"><button className="btn icon" onClick={close}>✕</button></span>
        </div>
      </div>
    );
  }
  const z = ws.zones[zid], names = World.waterNames(), rec = names[zid];
  const km = +p.world.scaleKm || 5;
  const title = rec.name || rec.auto;
  if (App.ui.cardMin) {
    return (
      <div className="info-card minimized" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
        <div className="card-head">
          <span className="card-kind">🌊 {title}</span>
          <span className="card-head-actions">
            <button className="btn icon card-min-btn" title={t("card.expand")} onClick={() => Actions.ui({ cardMin: false })}>⌃</button>
            <button className="btn icon" onClick={close}>✕</button>
          </span>
        </div>
      </div>
    );
  }
  const nameOf = (v) => (names[v] ? names[v].name || names[v].auto : "");
  // shores: the states whose provinces lie along it (most shore first), and the lands
  let shores = [], lands = 0;
  try {
    const wa = worldAnalysis(), co = waterCoast(zid), own = new Map();
    co.prov.forEach((n, c) => {
      const f = wa.feats[c];
      const e = f ? effRegion(p, String(f.id)) : null;
      const sid = e && e.owner && p.states[e.owner] ? e.owner : "";
      own.set(sid, (own.get(sid) || 0) + n);
    });
    shores = [...own.entries()].sort((a, b) => b[1] - a[1]).map(([sid]) => (sid ? p.states[sid].name : t("card.noOwner")));
    lands = co.lands.size;
  } catch (e) { console.warn(e); }
  // what it joins: a strait's two waters; otherwise its straits and the waters beside it
  const nb = Object.keys(z.nb).map(Number).sort((a, b) => z.nb[b] - z.nb[a]);
  const straits = nb.filter((v) => names[v] && names[v].kind === "strait");
  const others = nb.filter((v) => straits.indexOf(v) < 0 && !(rec.kind === "strait" && z.links && z.links.indexOf(v) >= 0));
  const into = World.displayRivers().filter((rv) => rv.pts.length && World.waterZoneAt(rv.pts[rv.pts.length - 1], true) === zid)
    .sort((a, b) => (b.upLen || 0) - (a.upLen || 0));
  const intoNamed = into.filter((rv) => rv.name).map((rv) => rv.name);
  const edited = World.waterEdited(zid);
  const zoom = () => {
    const proj = App.basemap.proj, b = z.box;
    MapAPI.zoomTo([proj([b[0] - 4, b[1] - 4]), proj([b[2] + 4, b[3] + 4])]);
  };
  return (
    <div className="info-card water-card" data-export-skip="1" onPointerDown={(e) => e.stopPropagation()}>
      <div className="card-head">
        <span className="card-kind">🌊 {t("water.kind." + rec.kind)}</span>
        <span className="card-head-actions">
          <button className="btn icon card-min-btn" title={t("card.minimize")} onClick={() => Actions.ui({ cardMin: true })}>⌄</button>
          <button className="btn icon" onClick={close}>✕</button>
        </span>
      </div>
      {rec.label
        ? <div className="card-title-static">{rec.name}<div className="muted">{t("water.fromLabel")}</div></div>
        : <input className="input card-title" value={rec.name} placeholder={rec.auto}
            onChange={(e) => World.setWaterZone(zid, { name: e.target.value }, { undo: false })}></input>}
      <div className="card-grid">
        <RiverParam label={t("water.kindLabel")} value={rec.kindSet ? rec.kind : null} autoLabel={t("water.kind." + rec.kindAuto)}
          options={World.WATER_KINDS.map((k) => ({ value: k, label: t("water.kind." + k) }))}
          onChange={(v) => World.setWaterZone(zid, { kind: v })}></RiverParam>
        <CardRow k={t("water.area")} v={"≈ " + fmtNum(Math.round(z.area * km * km / 100) * 100) + " " + t("world.km") + "²"}></CardRow>
        {rec.kind === "strait" && z.links && z.links.length
          ? <CardRow k={t("water.joins")} v={z.links.map(nameOf).join(" — ")}></CardRow>
          : null}
        {rec.kind !== "strait" && straits.length ? <CardRow k={t("water.straits")} v={straits.map(nameOf).join(", ")}></CardRow> : null}
        {others.length ? <CardRow k={t("water.neighbours")} v={others.map(nameOf).join(", ")}></CardRow> : null}
        <CardRow k={t("water.shores")} v={shores.length ? shores.slice(0, 6).join(", ") + (shores.length > 6 ? " " + t("water.more").replace("{n}", shores.length - 6) : "") : t("water.noShore")}></CardRow>
        {lands > 1 ? <CardRow k={t("water.lands")} v={String(lands)}></CardRow> : null}
        {into.length ? <CardRow k={t("water.rivers")} v={(intoNamed.length ? intoNamed.slice(0, 4).join(", ") + (into.length > Math.min(4, intoNamed.length) ? " " + t("water.more").replace("{n}", into.length - Math.min(4, intoNamed.length)) : "") : String(into.length))}></CardRow> : null}
        <button className="card-help-toggle" onClick={() => setHelp(!help)}>{help ? "▾ " : "ⓘ "}{t("water.howTitle")}</button>
        {help && <div className="card-help"><p>{t("water.how")}</p></div>}
      </div>
      <textarea className="textarea card-notes" placeholder={t("card.notes")} value={rec.notes}
        onChange={(e) => World.setWaterZone(zid, { notes: e.target.value }, { undo: false })}></textarea>
      <div className="card-actions">
        <button className={"btn outline" + (App.ui.waterMerge ? " on" : "")} onClick={() => Actions.ui({ waterMerge: App.ui.waterMerge ? null : pt, waterCut: false })}>{t("water.merge")}</button>
        <button className={"btn outline" + (App.ui.waterCut ? " on" : "")} onClick={() => Actions.ui({ waterCut: !App.ui.waterCut, waterMerge: null })}>{t("water.cut")}</button>
        <button className="btn outline" onClick={zoom}>{t("card.showOnMap")}</button>
        {edited && <button className="btn outline danger" onClick={() => World.resetWaterZone(zid)}>{t("water.reset")}</button>}
      </div>
    </div>
  );
}

// what a tap or a stroke on the map does now: join the zone to another, or divide it
function WaterModeBar() {
  useStore();
  const cut = !!App.ui.waterCut;
  return (
    <div className="geom-bar road-bar" data-export-skip="1">
      <span className="muted">{t(cut ? "water.cutHint" : "water.mergeHint")}</span>
      <button className="btn outline" onClick={() => Actions.ui({ waterCut: false, waterMerge: null })}>{t("edit.cancel")}</button>
    </div>
  );
}

function WorldCard() {
  useStore();
  const card = App.ui.card;
  if (!card) return null;
  if (card.kind === "river" && World.active()) return <RiverCard index={card.index}></RiverCard>;
  if (card.kind === "water" && World.active()) return <WaterCard pt={card.pt}></WaterCard>;
  if (card.kind === "object" && window.ObjectCard) return <ObjectCard id={card.id}></ObjectCard>;
  if ((card.kind === "label" || card.kind === "stateLabel") && window.LabelCard) return <LabelCard card={card}></LabelCard>;
  return null;
}

function AtlasModal() {
  useStore();
  const detail = ["overview", "areas", "provinces"].indexOf(App.ui.atlasDetail) >= 0 ? App.ui.atlasDetail : "areas";
  // the atlas describes the climate too: make sure the analysis matches the map
  React.useEffect(() => {
    World.ensureAnalysis().catch((e) => console.warn(e));
    World.ensureWaters().catch((e) => console.warn(e)); // seas, gulfs and straits
  }, []);
  const hyRev = World.hydroFresh() ? World.hydro.rev : 0;
  const wKey = World.watersFresh() ? World.waters.key + JSON.stringify((App.project.world.waters || {}).names || []) : "";
  const text = React.useMemo(() => {
    try { return Atlas.build({ detail }); } catch (e) { console.error(e); return String(e); }
  }, [detail, App.ui.lang, hyRev, wKey]);
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
          <div className="wp-field">
            <span>{t("world.atlasDetail")}</span>
            <div className="chip-row">
              {["overview", "areas", "provinces"].map((k) => (
                <button key={k} className={"chip" + (detail === k ? " on" : "")} onClick={() => Actions.setPref({ atlasDetail: k })}>{t("world.atlasDetail." + k)}</button>
              ))}
            </div>
            <span className="names-hint">{t("world.atlasDetailHint." + detail)}</span>
          </div>
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

Object.assign(window, { WorldPalette, AtlasModal, WorldSizeRail, WorldCard, worldAnalysis, CardRow, fmtNum, GeoSheet, GeoBar, CutBar, ProvinceGeo, NameRuleModal, WaterModeBar });
