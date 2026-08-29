// AtlasForge — left toolbar, states list, right properties panel
const Icons = {
  select: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2 L12 9 L8.5 9.5 L10.5 13.5 L8.8 14.3 L6.8 10.3 L4 12.5 Z" fill="currentColor" stroke="none"></path></svg>,
  paint: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M10 2.5 L13.5 6 L7 12.5 L3.5 13 L4 9.5 Z"></path><path d="M4 9.5 L7 12.5"></path></svg>,
  fill: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7.5 2 L13 7.5 L7.5 13 L2.5 8 L8 2.5"></path><circle cx="13.2" cy="11.5" r="1.6" fill="currentColor" stroke="none"></circle></svg>,
  erase: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="6.5" width="7" height="6" rx="1" transform="rotate(-35 6.5 9.5)"></rect><path d="M3 14 H13"></path></svg>,
  label: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 4.5 V3 H12.5 V4.5 M8 3 V13 M6 13 H10"></path></svg>,
  pan: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2 V14 M2 8 H14 M8 2 L6 4 M8 2 L10 4 M8 14 L6 12 M8 14 L10 12 M2 8 L4 6 M2 8 L4 10 M14 8 L12 6 M14 8 L12 10"></path></svg>,
  split: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 13 L13 3"></path><circle cx="3" cy="13" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="13" cy="3" r="1.4" fill="currentColor" stroke="none"></circle><path d="M5 5 L7.5 7.5 M11 11 L8.5 8.5" strokeDasharray="1.5 1.5"></path></svg>,
  draw: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2.5 L13.5 6.5 L11.5 13 L4.5 13 L2.5 6.5 Z"></path><circle cx="8" cy="2.5" r="1.3" fill="currentColor" stroke="none"></circle><circle cx="13.5" cy="6.5" r="1.3" fill="currentColor" stroke="none"></circle></svg>
};

const TOOLS = ["select", "paint", "fill", "erase", "label", "pan"];
const GEOM_TOOLS = ["split", "draw"];

function Toolbar() {
  useStore();
  const geomOk = window.GeomEdit && GeomEdit.enabled();
  const pick = (tl) => {
    if (App.ui.tool !== tl) App.ui.geomDraw = null;
    Actions.ui({ tool: tl });
  };
  return (
    <div className="toolbar" data-screen-label="Toolbar">
      {TOOLS.map((tl) => (
        <button
          key={tl}
          className={"tool-btn" + (App.ui.tool === tl ? " active" : "")}
          title={t("tools." + tl)}
          onClick={() => pick(tl)}
        >
          {Icons[tl]}
        </button>
      ))}
      {geomOk && <div className="toolbar-sep"></div>}
      {geomOk && GEOM_TOOLS.map((tl) => (
        <button
          key={tl}
          className={"tool-btn" + (App.ui.tool === tl ? " active" : "")}
          title={t("tools." + tl)}
          onClick={() => pick(tl)}
        >
          {Icons[tl]}
        </button>
      ))}
    </div>
  );
}

// ---------- selection mode toggle (Province / Region) ----------
function ModeBar() {
  useStore();
  const supports = RegionModel.supportsRegions();
  if (!supports) return null;
  const mode = App.ui.selectMode;
  return (
    <div className="modebar">
      <button className={"modebtn" + (mode === "province" ? " on" : "")} onClick={() => Actions.setSelectMode("province")}>
        {t("mode.province")}
      </button>
      <button className={"modebtn" + (mode === "region" ? " on" : "")} disabled={!supports}
        title={supports ? "" : t("mode.regionUnavailable")}
        onClick={() => Actions.setSelectMode("region")}>
        {t("mode.region")}
      </button>
    </div>
  );
}

// ---------- region layers (active layer selector + visibility / lock / tools) ----------
function RegionLayersPanel() {
  useStore();
  const p = App.project;
  const supports = RegionModel.supportsRegions();
  if (!supports) return null;
  const status = App.regionData.status;
  const layers = RegionModel.layers();
  const activeId = p.activeRegionLayerId;
  return (
    <div className="region-layers" data-screen-label="Region layers">
      <div className="panel-head">
        <span>{t("rlayer.title")}</span>
        <button className="btn icon" title={t("rlayer.add")} style={{ height: 22, width: 22, fontSize: 15 }}
          onClick={() => { const nm = prompt(t("rlayer.addPrompt"), t("rtype.historical")); if (nm) Actions.addRegionLayer(nm, "historical"); }}>+</button>
      </div>
      {status === "loading" && <div className="empty-hint">{t("rlayer.loading")}</div>}
      {status === "error" && <div className="empty-hint">{t("rlayer.error")}</div>}
      <div className="layer-list">
        {layers.map((l) => {
          const n = l.builtin ? (App.regionData.regions || []).length : (l.regionIds || []).length;
          return (
            <div key={l.id} className={"layer-row" + (activeId === l.id ? " active" : "")}
              onClick={() => Actions.setActiveRegionLayer(l.id)}>
              <button className="layer-eye" title={t("rlayer.visible")}
                onClick={(e) => { e.stopPropagation(); Actions.toggleLayerVisible(l.id); }}>
                {l.visible === false ? "🚫" : "👁"}
              </button>
              <span className="layer-name">{l.name}</span>
              <span className="layer-type">{t("rtype." + l.type)}</span>
              <span className="layer-count">{n}</span>
              {l.builtin
                ? <span className="layer-lock" title={t("rlayer.lockedBuiltin")}>🔒</span>
                : <button className="layer-lock" title={t("rlayer.lock")} onClick={(e) => { e.stopPropagation(); Actions.toggleLayerLock(l.id); }}>{l.locked ? "🔒" : "🔓"}</button>}
            </div>
          );
        })}
      </div>
      <div className="layer-tools">
        <button className="btn outline" style={{ fontSize: 11 }}
          onClick={() => { const src = RegionModel.layerById(activeId); const nm = prompt(t("rlayer.dupPrompt"), (src ? src.name : "Regions") + " " + t("rlayer.copy")); if (nm) Actions.duplicateLayer(activeId, nm); }}>
          {t("rlayer.duplicate")}
        </button>
        {(() => { const l = RegionModel.layerById(activeId); return l && !l.builtin ? (
          <button className="btn outline danger" style={{ fontSize: 11 }}
            onClick={() => { if (confirm(t("rlayer.deleteConfirm"))) Actions.deleteRegionLayer(activeId); }}>
            {t("rlayer.delete")}
          </button>
        ) : null; })()}
      </div>
    </div>
  );
}

function StatesPanel() {
  useStore();
  const p = App.project;
  if (!p) return <div className="states-panel"></div>;
  const counts = stateStats();
  return (
    <div className="states-panel" data-screen-label="States panel">
      <ModeBar></ModeBar>
      {App.ui.selectMode === "region" && <RegionLayersPanel></RegionLayersPanel>}
      <div className="panel-head">
        <span>{t("states.title")}</span>
        <button className="btn icon" title={t("states.add")} onClick={() => Actions.addState()} style={{ height: 22, width: 22, fontSize: 15 }}>+</button>
      </div>
      <div className="states-list">
        {p.stateOrder.length === 0 && <div className="empty-hint">{t("states.none")}</div>}
        {p.stateOrder.map((sid) => {
          const s = p.states[sid];
          if (!s) return null;
          return (
            <div
              key={sid}
              className={"state-row" + (App.ui.activeState === sid ? " active" : "")}
              onClick={() => {
                Actions.ui({ activeState: sid, panel: "state", selection: [] });
              }}
            >
              <span className="state-swatch" style={{ background: s.color }}></span>
              {s.flag && <img className="state-flag-mini" src={s.flag} alt=""></img>}
              <span className="state-row-name">{s.name || t("misc.unnamed")}</span>
              <span className="state-row-count">{counts[sid] || 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- form primitives ----------
function Field({ label, children }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}
function TextField({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <input className="input" value={value || ""} placeholder={placeholder || ""} onChange={(e) => onChange(e.target.value)}></input>
    </Field>
  );
}
function AreaField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <textarea className="textarea" value={value || ""} onChange={(e) => onChange(e.target.value)}></textarea>
    </Field>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}></input>
      <span>{label}</span>
    </label>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

// Built-in suggestion lists for country fields (localized). Users can always type
// a custom value; new custom values are remembered project-wide (Actions.rememberValue).
const VALUE_DEFAULTS = {
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
  culture: { en: [], ru: [] }, // very map-dependent -> seeded from the map + custom
  language: {
    en: ["English", "Spanish", "French", "Portuguese", "German", "Russian", "Arabic", "Hindi", "Mandarin Chinese", "Japanese", "Korean", "Latin"],
    ru: ["Английский", "Испанский", "Французский", "Португальский", "Немецкий", "Русский", "Арабский", "Хинди", "Китайский", "Японский", "Корейский", "Латынь"]
  }
};

// Distinct values already present in the loaded map (so dropdowns reflect the map).
function mapVocab(listKey) {
  const set = new Set();
  const add = (v) => { if (v && typeof v === "string" && v.trim()) set.add(v.trim()); };
  const p = App.project, bm = App.basemap;
  if (window.Metadata && Metadata.fields.includes(listKey)) return Metadata.values(p, listKey);
  if (listKey === "culture") (bm && bm.features ? bm.features : []).forEach((f) => add(f.cultArea));
  if (listKey === "culture" || listKey === "religion" || listKey === "language") {
    for (const rid in (p.regions || {})) add(p.regions[rid][listKey]);
    for (const gid in (p.groups || {})) add(p.groups[gid][listKey]);
  }
  return [...set];
}

// A real dropdown backed by built-ins + project values. "Custom…" keeps the
// free-text workflow without relying on browser-specific <datalist> UI.
function ComboField({ label, listKey, stateField, value, onChange }) {
  const p = App.project;
  const lang = App.ui.lang === "ru" ? "ru" : "en";
  const [customMode, setCustomMode] = React.useState(false);
  const [customValue, setCustomValue] = React.useState(value || "");
  const builtins = (VALUE_DEFAULTS[listKey] && VALUE_DEFAULTS[listKey][lang]) || [];
  const opts = React.useMemo(() => {
    const set = new Set();
    const add = (v) => { if (v && typeof v === "string" && v.trim()) set.add(v.trim()); };
    builtins.forEach(add);
    ((p.valueLists || {})[listKey] || []).forEach(add);
    mapVocab(listKey).forEach(add);
    Object.keys(p.states || {}).forEach((sid) => add(p.states[sid][stateField]));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [App.version, listKey, lang]);
  const commit = (v) => {
    const val = (v || "").trim();
    onChange(val);
    if (val && builtins.indexOf(val) < 0) Actions.rememberValue(listKey, val);
  };
  const displayOpts = value && !opts.includes(value) ? [value].concat(opts) : opts;
  const selectValue = customMode ? "__custom" : (value ? value : "");
  return (
    <Field label={label}>
      <select className="select" value={selectValue} onChange={(e) => {
        if (e.target.value === "__custom") { setCustomMode(true); setCustomValue(""); return; }
        setCustomMode(false); commit(e.target.value);
      }}>
        <option value="">{t("misc.none")}</option>
        {displayOpts.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">{t("misc.customValue")}</option>
      </select>
      {customMode && <input className="input" autoFocus placeholder={t("misc.customValueHint")} value={customValue}
        onChange={(e) => { setCustomValue(e.target.value); onChange(e.target.value); }}
        onBlur={(e) => { commit(e.target.value); setCustomMode(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { commit(e.target.value); setCustomMode(false); } }}></input>}
    </Field>
  );
}

const STATUSES = ["core", "autonomy", "colony", "disputed", "occupied", "assimilation"];

// Extra inputs that appear under the status field for statuses that involve a
// SECOND (or several) countries: disputed -> any number of claimants, occupied ->
// the country it was taken from. All reference state ids (map-independent).
function StatusExtras({ status, claimants, occupiedFrom, owner, onChange }) {
  const p = App.project;
  if (!p.stateOrder.length) return null;
  if (status === "disputed") {
    const set = new Set(claimants || []);
    return (
      <Field label={t("f.claimants")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 168, overflowY: "auto" }}>
          {p.stateOrder.map((x) => (
            <Check key={x} label={p.states[x].name + (x === owner ? " ★" : "")} checked={set.has(x)}
              onChange={(v) => { const ns = new Set(set); v ? ns.add(x) : ns.delete(x); onChange({ claimants: [...ns] }); }}></Check>
          ))}
        </div>
      </Field>
    );
  }
  if (status === "occupied") {
    return (
      <Field label={t("f.occupiedFrom")}>
        <select className="select" value={occupiedFrom || ""} onChange={(e) => onChange({ occupiedFrom: e.target.value || null })}>
          <option value="">{t("misc.none")}</option>
          {p.stateOrder.filter((x) => x !== owner).map((x) => <option key={x} value={x}>{p.states[x].name}</option>)}
        </select>
      </Field>
    );
  }
  return null;
}

// Group the selected autonomy regions into a NAMED autonomous entity that draws
// its own border + label. Shown only when the status is "autonomy".
function AutonomyPicker({ sel, owner, autonomyId }) {
  const p = App.project;
  const autos = p.autonomies || {};
  const list = Object.keys(autos).map((k) => autos[k]).filter((a) => !owner || owner === "__mixed" || a.owner === owner);
  const cur = autonomyId && autos[autonomyId] ? autos[autonomyId] : null;
  return (
    <Field label={t("f.autonomy")}>
      <select className="select" value={autonomyId || ""} onChange={(e) => {
        const v = e.target.value;
        if (v === "__new") {
          const nm = prompt(t("autonomy.nameAsk"), t("autonomy.new"));
          if (nm) Actions.createAutonomy(sel, nm);
        } else Actions.setRegionAutonomy(sel, v || null);
      }}>
        <option value="">{t("misc.none")}</option>
        {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        <option value="__new">＋ {t("autonomy.new")}</option>
      </select>
      {cur && (
        <div className="field-row" style={{ marginTop: 4 }}>
          <input className="input" value={cur.name} onChange={(e) => Actions.setAutonomy(cur.id, { name: e.target.value }, { undo: false })}></input>
          <input type="color" className="color-input" value={cur.color || "#c8c8c8"} onChange={(e) => Actions.setAutonomy(cur.id, { color: e.target.value })}></input>
          <button className="btn icon danger" style={{ height: 26, width: 26 }} title={t("autonomy.remove")} onClick={() => Actions.setRegionAutonomy(sel, null)}>✕</button>
        </div>
      )}
    </Field>
  );
}

// ---------- Map settings tab ----------
function MapTab() {
  const p = App.project;
  const s = p.settings;
  const set = (patch) => Actions.setSettings(patch, { undo: false });
  const mode = s.mapMode || "color";
  const supportsRegions = RegionModel.supportsRegions();
  const displayModes = ["country", "province", "culture", "religion", "language", "terrain"].concat(
    supportsRegions ? ["stateRegion", "historicalRegion", "culturalRegion", "geographicalRegion", "politicalRegion"] : []);
  return (
    <div className="props-body">
      <SelectField label={t("map.displayMode")} value={p.displayMode || "country"}
        onChange={(v) => Actions.setDisplayMode(v)}
        options={displayModes.map((m) => ({ value: m, label: t("dmode." + m) }))}></SelectField>
      <Field label={t("map.mode")}>
        <div className="chip-row" style={{ gap: 6 }}>
          <button className={"chip" + (mode === "color" ? " on" : "")} style={{ flex: 1, padding: "6px 8px" }} onClick={() => set({ mapMode: "color" })}>■ {t("map.modeColor")}</button>
          <button className={"chip" + (mode === "flag" ? " on" : "")} style={{ flex: 1, padding: "6px 8px" }} onClick={() => set({ mapMode: "flag" })}>⚑ {t("map.modeFlag")}</button>
        </div>
      </Field>
      {mode === "flag" && (
        <Field label={t("map.flagOpacity") + " — " + Math.round((s.flagOpacity == null ? 0.92 : s.flagOpacity) * 100) + "%"}>
          <input type="range" className="range" min="0.3" max="1" step="0.02" value={s.flagOpacity == null ? 0.92 : s.flagOpacity} onChange={(e) => set({ flagOpacity: +e.target.value })}></input>
        </Field>
      )}
      <Field label={t("map.style")}>
        <div className="chip-row">
          {Object.keys(MAP_STYLES).map((k) => (
            <button key={k} className={"chip" + (s.style === k ? " on" : "")} onClick={() => Actions.applyStyle(k)}>{t("style." + k)}</button>
          ))}
        </div>
      </Field>
      <div className="field-row">
        <Field label={t("map.sea")}>
          <input type="color" className="color-input" value={s.sea} onChange={(e) => set({ sea: e.target.value })}></input>
        </Field>
        <Field label={t("map.land")}>
          <input type="color" className="color-input" value={s.land} onChange={(e) => set({ land: e.target.value })}></input>
        </Field>
        <Field label={t("map.borders")}>
          <input type="color" className="color-input" value={s.borders} onChange={(e) => set({ borders: e.target.value })}></input>
        </Field>
      </div>
      {/* ---- borders: region / country / coast are SEPARATE layers & toggles ---- */}
      <div className="props-section-title">{t("map.sectionBorders")}</div>
      {App.basemap.topo
        ? <Check label={t("map.showRegionBorders")} checked={s.showRegionBorders !== undefined ? s.showRegionBorders !== false : s.innerBorders !== false} onChange={(v) => set({ showRegionBorders: v })}></Check>
        : <Check label={t("map.showProvinceBorders")} checked={s.showProvinceBorders !== false} onChange={(v) => set({ showProvinceBorders: v })}></Check>}
      <Field label={t("map.borderW") + " — " + s.borderW.toFixed(1)}>
        <input type="range" className="range" min="0" max="3" step="0.1" value={s.borderW} onChange={(e) => set({ borderW: +e.target.value })}></input>
      </Field>
      <Check label={t("map.showCountryBorders")} checked={s.showCountryBorders !== false} onChange={(v) => set({ showCountryBorders: v })}></Check>
      <Field label={t("map.countryBorderW") + " — " + (s.countryBorderW != null ? (+s.countryBorderW).toFixed(1) : "1.6")}>
        <input type="range" className="range" min="0.4" max="4" step="0.1" value={s.countryBorderW != null ? s.countryBorderW : 1.6} onChange={(e) => set({ countryBorderW: +e.target.value })}></input>
      </Field>
      <Check label={t("map.showAutonomies")} checked={s.showAutonomies !== false} onChange={(v) => set({ showAutonomies: v })}></Check>
      {App.basemap.topo && <Check label={t("map.showCoastlines")} checked={s.showCoastlines !== false} onChange={(v) => set({ showCoastlines: v })}></Check>}
      {supportsRegions && <Check label={t("map.showRegionBorders")} checked={s.showRegionBorders !== false} onChange={(v) => set({ showRegionBorders: v })}></Check>}

      <div className="props-section-title">{t("props.map")}</div>
      {(App.basemap.physical || (App.physical && App.physical.status === "ready")) && (
        <React.Fragment>
          <Check label={t("map.showRivers")} checked={s.showRivers !== false} onChange={(v) => set({ showRivers: v })}></Check>
          <Check label={t("map.showLakes")} checked={s.showLakes !== false} onChange={(v) => set({ showLakes: v })}></Check>
          <Check label={t("map.showMountains")} checked={s.showMountains !== false} onChange={(v) => set({ showMountains: v })}></Check>
          {App.physical && App.physical.status === "ready" && App.physical.relief.some((f) => f.typ === "forest") &&
            <Check label={t("map.showForest")} checked={s.showForest !== false} onChange={(v) => set({ showForest: v })}></Check>}
          {App.physical && App.physical.status === "ready" && App.physical.relief.some((f) => f.typ === "desert") &&
            <Check label={t("map.showDesert")} checked={s.showDesert !== false} onChange={(v) => set({ showDesert: v })}></Check>}
        </React.Fragment>
      )}
      <Check label={t("map.provinceTint")} checked={s.provinceTint} onChange={(v) => set({ provinceTint: v })}></Check>
      {window.GeomEdit && GeomEdit.enabled() && (
        <React.Fragment>
          <div className="props-section-title">{t("snap.title")}</div>
          {["borders", "rivers", "lakes", "mountains"].map((k) => (
            <Check key={k} label={t("snap." + k)}
              checked={k === "mountains" ? (s.snap || {})[k] === true : (s.snap || {})[k] !== false}
              onChange={(v) => set({ snap: Object.assign({}, s.snap, { [k]: v }) })}></Check>
          ))}
        </React.Fragment>
      )}
      <Check label={t("map.showStateLabels")} checked={s.showStateLabels} onChange={(v) => set({ showStateLabels: v })}></Check>
      <Check label={t("map.showCapitals")} checked={s.showCapitals !== false} onChange={(v) => set({ showCapitals: v })}></Check>
      <Check label={t("map.atlasLabels")} checked={s.labelAtlas !== false} onChange={(v) => set({ labelAtlas: v })}></Check>
      <Check label={t("map.showLabels")} checked={s.showLabels} onChange={(v) => set({ showLabels: v })}></Check>
      <Check label={t("map.showFlags")} checked={s.showFlags} onChange={(v) => set({ showFlags: v })}></Check>
      <Check label={t("map.showLegend")} checked={App.ui.showLegend} onChange={(v) => Actions.ui({ showLegend: v })}></Check>

      {/* ---- reference image backdrop (tracing) ---- */}
      <div className="props-section-title">{t("backdrop.section")}</div>
      {!p.backdrop ? (
        <React.Fragment>
          <button className="btn outline" onClick={() => pickImageFile((f) => Actions.loadBackdropImage(f))}>{t("backdrop.load")}</button>
          <div className="muted" style={{ fontSize: 11 }}>{t("backdrop.hint")}</div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Check label={t("backdrop.show")} checked={p.backdrop.visible !== false} onChange={(v) => Actions.setBackdrop({ visible: v })}></Check>
          <Check label={t("backdrop.move")} checked={!!App.ui.moveBackdrop} onChange={(v) => Actions.ui({ moveBackdrop: v })}></Check>
          <Field label={t("backdrop.opacity") + " — " + Math.round((p.backdrop.opacity == null ? 0.55 : p.backdrop.opacity) * 100) + "%"}>
            <input type="range" className="range" min="0.05" max="1" step="0.05" value={p.backdrop.opacity == null ? 0.55 : p.backdrop.opacity} onChange={(e) => Actions.setBackdrop({ opacity: +e.target.value })}></input>
          </Field>
          <div className="field-row" style={{ flexWrap: "wrap", gap: 4 }}>
            <button className="btn outline" style={{ fontSize: 11 }} onClick={() => Actions.setBackdrop({ x: 0, y: 0, w: MAP_W, h: MAP_H })}>{t("backdrop.fit")}</button>
            <button className="btn outline" style={{ fontSize: 11 }} onClick={() => pickImageFile((f) => Actions.loadBackdropImage(f))}>{t("backdrop.replace")}</button>
            <button className="btn outline danger" style={{ fontSize: 11 }} onClick={() => Actions.removeBackdrop()}>{t("backdrop.remove")}</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------- reusable metadata dictionaries ----------
const CATALOG_TABS = ["culture", "religion", "language", "government"];

function CatalogEntryEditor({ field, name, parents }) {
  const p = App.project;
  const source = (window.Metadata && Metadata.entry(p, field, name)) || { name, color: Metadata.color(p, field, name), parent: "", description: "" };
  const [draft, setDraft] = React.useState({ name: source.name || "", color: source.color || "#888888", parent: source.parent || "", description: source.description || "" });
  React.useEffect(() => {
    setDraft({ name: source.name || "", color: source.color || Metadata.color(App.project, field, name), parent: source.parent || "", description: source.description || "" });
  }, [field, name, source.name, source.color, source.parent, source.description]);
  const set = (patch) => setDraft((d) => Object.assign({}, d, patch));
  return (
    <div className="catalog-entry">
      <div className="catalog-entry-head">
        <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })}></input>
        <input type="color" className="color-input" value={draft.color || "#888888"} onChange={(e) => set({ color: e.target.value })}></input>
      </div>
      <select className="select" value={draft.parent || ""} onChange={(e) => set({ parent: e.target.value })}>
        <option value="">{t("catalog.noParent")}</option>
        {parents.filter((v) => v !== name).map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <textarea className="textarea catalog-description" rows="2" placeholder={t("catalog.description")} value={draft.description || ""} onChange={(e) => set({ description: e.target.value })}></textarea>
      <div className="field-row">
        <button className="btn outline" style={{ fontSize: 11 }} onClick={() => Actions.saveCatalogEntry(field, name, draft)}>{t("catalog.save")}</button>
        {field !== "government" && <button className="btn outline" style={{ fontSize: 11 }} onClick={() => Actions.selectByMetadata(field, name)}>{t("catalog.selectUsed")}</button>}
      </div>
    </div>
  );
}

function CatalogTab() {
  useStore();
  const p = App.project;
  const [field, setField] = React.useState("culture");
  const [newName, setNewName] = React.useState("");
  const [query, setQuery] = React.useState("");
  const values = (window.Metadata ? Metadata.values(p, field) : []).filter(Boolean);
  const visibleValues = values.filter((name) => !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 100);
  const [applyValue, setApplyValue] = React.useState("");
  React.useEffect(() => { if (!values.includes(applyValue)) setApplyValue(values[0] || ""); }, [field, values.join("\u0001")]);
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    Actions.saveCatalogEntry(field, "", { name, color: Metadata.color(p, field, name), parent: "", description: "" });
    setNewName("");
  };
  const selected = App.ui.selection || [];
  return (
    <div className="props-body catalog-panel">
      <div className="chip-row catalog-tabs">
        {CATALOG_TABS.map((k) => <button key={k} className={"chip" + (field === k ? " on" : "")} onClick={() => setField(k)}>{t("catalog." + k)}</button>)}
      </div>
      <div className="muted">{t("catalog.hint")}</div>
      {field !== "government" && <div className="catalog-apply">
        <div className="props-section-title">{t("catalog.bulk")}</div>
        <select className="select" value={applyValue} onChange={(e) => setApplyValue(e.target.value)} disabled={!values.length}>
          {!values.length && <option value="">{t("catalog.empty")}</option>}
          {values.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <button className="btn primary" disabled={!selected.length || !applyValue} onClick={() => Actions.setRegion(selected, { [field]: applyValue })}>
          {t("catalog.apply")} ({selected.length})
        </button>
      </div>}
      <div className="catalog-add">
        <input className="input" placeholder={t("catalog.new")} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}></input>
        <button className="btn outline" onClick={add}>{t("catalog.add")}</button>
      </div>
      {values.length > 12 && <input className="input" placeholder={t("catalog.search")} value={query} onChange={(e) => setQuery(e.target.value)}></input>}
      {visibleValues.length < values.length && <div className="muted">{t("catalog.showing").replace("{shown}", visibleValues.length).replace("{total}", values.length)}</div>}
      <div className="catalog-list">
        {visibleValues.map((name) => <CatalogEntryEditor key={field + "|" + name} field={field} name={name} parents={values}></CatalogEntryEditor>)}
      </div>
    </div>
  );
}

function pickImageFile(cb) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*";
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}

// ---------- State tab ----------
function StateTab() {
  const p = App.project;
  const sid = App.ui.activeState;
  const s = sid ? p.states[sid] : null;
  if (!s) return <div className="props-body"><div className="muted">{t("state.none")}</div></div>;
  const set = (patch) => Actions.setState(sid, patch, { undo: false });
  const counts = stateStats();
  const capOptions = React.useMemo(() => {
    const out = [], bm = App.basemap;
    for (const rid in p.regions) {
      const e = effRegion(p, rid);
      if (!e || e.owner !== sid) continue;
      const f = bm && bm.byId ? bm.byId[rid] : null;
      out.push({ id: rid, name: (p.regions[rid] && p.regions[rid].name) || (f && f.name) || rid });
    }
    out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return out;
  }, [App.version, sid]);
  return (
    <div className="props-body">
      <TextField label={t("f.name")} value={s.name} onChange={(v) => set({ name: v })}></TextField>
      <div className="field-row">
        <Field label={t("f.color")}>
          <input type="color" className="color-input" value={s.color} onChange={(e) => set({ color: e.target.value })}></input>
        </Field>
        <Field label={t("f.flag")}>
          <div className="field-row">
            {s.flag && <img src={s.flag} alt="" style={{ width: 34, height: 22, objectFit: "cover", borderRadius: 3, border: "1px solid var(--border)" }}></img>}
            <button className="btn outline" style={{ height: 26, fontSize: 11 }} onClick={() => Exports.uploadFlag(sid)}>{t("f.flagUpload")}</button>
            {s.flag && <button className="btn icon danger" style={{ height: 26, width: 26 }} title={t("f.flagClear")} onClick={() => set({ flag: null })}>✕</button>}
          </div>
        </Field>
      </div>
      <div className="muted">{counts[sid] || 0} {t("state.regions")} · <a href="#" onClick={(e) => { e.preventDefault(); Actions.selectByOwner(sid); }} style={{ color: "var(--accent)" }}>{t("state.selectRegions")}</a></div>
      {s.flag && <Check label={t("f.flagFill")} checked={s.flagFill} onChange={(v) => set({ flagFill: v })}></Check>}
      <Field label={t("state.vassalOf")}>
        <select className="select" value={s.vassalOf || ""} onChange={(e) => set({ vassalOf: e.target.value || null })}>
          <option value="">{t("state.sovereign")}</option>
          {p.stateOrder.filter((x) => x !== sid).map((x) => <option key={x} value={x}>{p.states[x].name}</option>)}
        </select>
      </Field>
      {s.vassalOf && p.states[s.vassalOf] && <div className="muted">{t("state.vassalHint")} <b style={{ color: p.states[s.vassalOf].color }}>{p.states[s.vassalOf].name}</b></div>}

      {/* ---- manual label overrides (auto placement is the default) ---- */}
      <div className="props-section-title">{t("label.section")}</div>
      {(() => {
        const lsv = s.labelStyle || {};
        const setLS = (patch) => set({ labelStyle: Object.assign({}, lsv, patch) });
        return (
          <React.Fragment>
            <Check label={t("label.hidden")} checked={!!lsv.hidden} onChange={(v) => setLS({ hidden: v })}></Check>
            <Field label={t("label.size") + " — " + (lsv.size ? lsv.size : t("label.auto"))}>
              <input type="range" className="range" min="0" max="36" step="1" value={lsv.size || 0} onChange={(e) => setLS({ size: +e.target.value || 0 })}></input>
            </Field>
            <Field label={t("label.rotation") + " — " + (lsv.angle != null ? lsv.angle + "°" : t("label.auto"))}>
              <div className="field-row">
                <input type="range" className="range" min="-180" max="180" step="1" value={lsv.angle != null ? lsv.angle : 0} onChange={(e) => setLS({ angle: +e.target.value })}></input>
                {lsv.angle != null && <button className="btn outline" style={{ height: 22, fontSize: 10 }} onClick={() => setLS({ angle: null })}>{t("label.auto")}</button>}
              </div>
            </Field>
            <Field label={t("label.spacing") + " — " + (lsv.spacing != null ? lsv.spacing : t("label.auto"))}>
              <div className="field-row">
                <input type="range" className="range" min="0" max="8" step="0.5" value={lsv.spacing != null ? lsv.spacing : 0} onChange={(e) => setLS({ spacing: +e.target.value })}></input>
                {lsv.spacing != null && <button className="btn outline" style={{ height: 22, fontSize: 10 }} onClick={() => setLS({ spacing: null })}>{t("label.auto")}</button>}
              </div>
            </Field>
            {s.labelOffset && <button className="btn outline" style={{ fontSize: 11 }} onClick={() => set({ labelOffset: null })}>{t("label.resetPos")}</button>}
          </React.Fragment>
        );
      })()}

      <div className="props-section-title">{t("props.state")}</div>
      <Field label={t("f.capital")}>
        <select className="select" value={s.capitalRegion || ""} onChange={(e) => set({ capitalRegion: e.target.value || null })}>
          <option value="">{t("misc.none")}</option>
          {capOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <ComboField label={t("f.gov")} listKey="government" stateField="gov" value={s.gov} onChange={(v) => set({ gov: v })}></ComboField>
      <ComboField label={t("f.ideology")} listKey="ideology" stateField="ideology" value={s.ideology} onChange={(v) => set({ ideology: v })}></ComboField>
      <ComboField label={t("f.officialReligion")} listKey="religion" stateField="religion" value={s.religion} onChange={(v) => set({ religion: v })}></ComboField>
      <ComboField label={t("f.officialCulture")} listKey="culture" stateField="culture" value={s.culture} onChange={(v) => set({ culture: v })}></ComboField>
      <ComboField label={t("f.officialLanguage")} listKey="language" stateField="language" value={s.language} onChange={(v) => set({ language: v })}></ComboField>
      <TextField label={t("f.population")} value={s.population} onChange={(v) => set({ population: v })}></TextField>
      <ComboField label={t("f.economy")} listKey="economy" stateField="economy" value={s.economy} onChange={(v) => set({ economy: v })}></ComboField>
      <TextField label={t("f.army")} value={s.army} onChange={(v) => set({ army: v })}></TextField>
      <AreaField label={t("f.notes")} value={s.notes} onChange={(v) => set({ notes: v })}></AreaField>
      <button className="btn outline danger" onClick={() => { if (confirm(t("state.deleteConfirm"))) Actions.deleteState(sid); }}>{t("state.delete")}</button>
    </div>
  );
}

// ---------- Region tab (also label editor) ----------
function LabelEditor({ id }) {
  const p = App.project;
  const l = p.labels.find((x) => x.id === id);
  if (!l) return null;
  const set = (patch) => Actions.setLabel(id, patch, { undo: false });
  return (
    <div className="props-body">
      <TextField label={t("f.text")} value={l.text} onChange={(v) => set({ text: v })}></TextField>
      <Field label={t("f.size") + " — " + l.size}>
        <input type="range" className="range" min="6" max="72" step="1" value={l.size} onChange={(e) => set({ size: +e.target.value })}></input>
      </Field>
      <div className="field-row">
        <Field label={t("f.color")}>
          <input type="color" className="color-input" value={l.color || "#222222"} onChange={(e) => set({ color: e.target.value })}></input>
        </Field>
        <Check label="Bold" checked={l.bold} onChange={(v) => set({ bold: v })}></Check>
      </div>
      <button className="btn outline danger" onClick={() => { Actions.deleteLabel(id); Actions.ui({ selLabel: null }); }}>✕ {t("misc.none") === "—" ? (App.ui.lang === "ru" ? "Удалить подпись" : "Delete label") : "Delete"}</button>
    </div>
  );
}

// ---------- per-region name label editor (move / rotate / size / hide) ----------
function FeatLabelEditor({ id }) {
  const p = App.project;
  const ov = (p.featLabels || {})[id] || {};
  const set = (patch) => Actions.setFeatLabel(id, patch, { undo: false });
  const baseId = id.indexOf("L:") === 0 ? id.slice(2) : id;
  const f = App.basemap.byId && App.basemap.byId[baseId];
  const nm = (f && f.name) || (App.regionData && App.regionData.byId && App.regionData.byId[baseId] && RegionModel.displayName(App.regionData.byId[baseId])) || baseId;
  return (
    <div className="props-body">
      <div className="props-section-title">{t("label.section")}</div>
      <div className="muted" style={{ marginBottom: 8 }}>{nm}</div>
      <Check label={t("label.hidden")} checked={!!ov.hidden} onChange={(v) => set({ hidden: v || null })}></Check>
      <Field label={t("label.size") + " — " + (ov.size ? ov.size : t("label.auto"))}>
        <input type="range" className="range" min="0" max="48" step="1" value={ov.size || 0} onChange={(e) => set({ size: +e.target.value || null })}></input>
      </Field>
      <Field label={t("label.rotation") + " — " + (ov.angle ? ov.angle + "°" : "0°")}>
        <input type="range" className="range" min="-180" max="180" step="1" value={ov.angle || 0} onChange={(e) => set({ angle: +e.target.value || null })}></input>
      </Field>
      <div className="muted" style={{ fontSize: 11, margin: "6px 0" }}>{t("label.dragHint")}</div>
      <button className="btn outline" onClick={() => Actions.clearFeatLabel(id)}>{t("label.reset")}</button>
    </div>
  );
}

// ---------- region selection editor (Region mode) ----------
const META_FIELDS = ["culture", "language", "religion", "terrain", "climate", "historicalPeriod", "politicalStatus", "population", "development"];

function NewRegionForm({ onCreate, defaultType }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState(defaultType || "historical");
  return (
    <div className="newregion-form">
      <TextField label={t("region.newName")} value={name} onChange={setName}></TextField>
      <SelectField label={t("f.type")} value={type} onChange={setType}
        options={RegionModel.types.map((tp) => ({ value: tp, label: t("rtype." + tp) }))}></SelectField>
      <button className="btn primary" disabled={!name.trim()} onClick={() => onCreate(name.trim(), type)}>{t("region.create")}</button>
    </div>
  );
}

function RegionPropsPanel() {
  const p = App.project;
  const sel = App.ui.regionSelection;
  if (!sel.length) return <div className="props-body"><div className="muted">{t("region.noneRegion")}</div></div>;
  const ownerOptions = p.stateOrder.map((sid) => ({ id: sid, name: p.states[sid].name }));

  // ----- multiple regions -----
  if (sel.length > 1) {
    const owner = RegionModel.regionOwner(RegionModel.resolve(sel[0]));
    const resolved = sel.map((id) => RegionModel.resolve(id)).filter(Boolean);
    const commonMeta = (key) => {
      const first = ((resolved[0] || {}).metadata || {})[key] || "";
      return resolved.every((r) => ((r.metadata || {})[key] || "") === first) ? first : "";
    };
    const setAllMeta = (key, value) => Actions.setRegionsMeta(sel, { [key]: value });
    return (
      <div className="props-body">
        <div className="muted"><b style={{ color: "var(--text)" }}>{sel.length}</b> {t("region.multiRegion")}</div>
        <Field label={t("f.owner")}>
          <select className="select" value={owner || ""} onChange={(e) => Actions.assignRegions(sel, e.target.value || null)}>
            <option value="">{t("legend.unowned")}</option>
            {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <button className="btn primary" onClick={() => { const nm = prompt(t("region.countryName"), ""); if (nm !== null) Actions.createCountryFromRegions(sel, nm || null); }}>
          {t("region.createCountry")}
        </button>
        <div className="props-section-title">{t("props.region")}</div>
        <ComboField label={t("f.culture")} listKey="culture" stateField="culture" value={commonMeta("culture")} onChange={(v) => setAllMeta("culture", v)}></ComboField>
        <ComboField label={t("f.language")} listKey="language" stateField="language" value={commonMeta("language")} onChange={(v) => setAllMeta("language", v)}></ComboField>
        <ComboField label={t("f.religion")} listKey="religion" stateField="religion" value={commonMeta("religion")} onChange={(v) => setAllMeta("religion", v)}></ComboField>
        <div className="props-section-title">{t("region.createLarger")}</div>
        <div className="muted" style={{ fontSize: 11 }}>{t("region.createLargerHint")}</div>
        <NewRegionForm defaultType="historical" onCreate={(name, type) => Actions.createRegionFromRegions(sel, { name, type })}></NewRegionForm>
        <button className="btn outline" onClick={() => Actions.clearRegionSelection()}>{t("region.clearSel")}</button>
      </div>
    );
  }

  // ----- single region -----
  const id = sel[0];
  const r = RegionModel.resolve(id);
  if (!r) return <div className="props-body"><div className="muted">{t("region.noneRegion")}</div></div>;
  const isCustom = !r.builtin;
  const owner = RegionModel.regionOwner(r);
  const meta = r.metadata || {};
  const setMeta = (k, v) => Actions.setRegionMeta(id, { [k]: v });
  return (
    <div className="props-body">
      <TextField label={t("f.name")} value={RegionModel.displayName(r)} onChange={(v) => Actions.renameRegion(id, v)}></TextField>
      <SelectField label={t("f.type")} value={r.type || "custom"} onChange={(v) => Actions.setRegionType(id, v)}
        options={RegionModel.types.map((tp) => ({ value: tp, label: t("rtype." + tp) }))}></SelectField>
      <div className="muted">{RegionModel.provinceCount(r)} {t("region.provinces")}
        {r.builtin ? " · " + t("region.builtinState") : ""}
        {r.category ? " · " + r.category : ""}</div>
      <Field label={t("f.owner")}>
        <select className="select" value={owner || ""} onChange={(e) => Actions.assignRegions([id], e.target.value || null)}>
          <option value="">{t("legend.unowned")}</option>
          {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label={t("f.color")}>
        <div className="field-row">
          <input type="color" className="color-input" value={r.color || "#cccccc"} onChange={(e) => Actions.setRegionColor(id, e.target.value)}></input>
          {r.color && <button className="btn outline" style={{ height: 26, fontSize: 11 }} onClick={() => Actions.setRegionColor(id, null)}>↺</button>}
        </div>
      </Field>
      <button className="btn primary" onClick={() => { const nm = prompt(t("region.countryName"), RegionModel.displayName(r)); if (nm !== null) Actions.createCountryFromRegions([id], nm || null); }}>
        {t("region.createCountry")}
      </button>
      <div className="props-section-title">{t("props.region")}</div>
      <AreaField label={t("f.notes")} value={r.notes} onChange={(v) => Actions.setRegionNotes(id, v)}></AreaField>
      {META_FIELDS.map((k) => ["culture", "language", "religion"].includes(k) ? (
        <ComboField key={k} label={t("meta." + k)} listKey={k} stateField={k} value={meta[k] == null ? "" : meta[k]} onChange={(v) => setMeta(k, v)}></ComboField>
      ) : (
        <TextField key={k} label={t("meta." + k)} value={meta[k] == null ? "" : meta[k]} onChange={(v) => setMeta(k, v)}></TextField>
      ))}
      <div className="field-row" style={{ marginTop: 6 }}>
        {r.b && <button className="btn outline" onClick={() => MapAPI.zoomTo(r.b)}>{t("zoom.fit")}</button>}
        {isCustom && <button className="btn outline danger" onClick={() => { if (confirm(t("region.deleteConfirm"))) Actions.deleteRegion(id); }}>{t("region.delete")}</button>}
      </div>
    </div>
  );
}

function RegionTab() {
  const p = App.project;
  if (App.ui.selectMode === "region") return <RegionPropsPanel></RegionPropsPanel>;
  const sel = App.ui.selection;
  if (App.ui.selFeatLabel) return <FeatLabelEditor id={App.ui.selFeatLabel}></FeatLabelEditor>;
  if (App.ui.selLabel) return <LabelEditor id={App.ui.selLabel}></LabelEditor>;
  if (!sel.length) return <div className="props-body"><div className="muted">{t("region.none")}</div></div>;

  const rid = sel[0];
  const r0 = p.regions[rid] || {};
  const gid = r0.group && p.groups && p.groups[r0.group] ? r0.group : null;
  const g = gid ? p.groups[gid] : null;
  const isGroup = !!g && sel.length === (g.members || []).length;
  const ownerOptions = p.stateOrder.map((sid) => ({ id: sid, name: p.states[sid].name }));

  // -------- merged custom region --------
  if (isGroup) {
    const setG = (patch) => Actions.setGroup(gid, patch, { undo: false });
    return (
      <div className="props-body">
        <TextField label={t("f.name")} value={g.name} onChange={(v) => setG({ name: v })}></TextField>
        <div className="muted">{(g.members || []).length} {t("group.members")}</div>
        <Field label={t("f.owner")}>
          <select className="select" value={g.owner || ""} onChange={(e) => Actions.assign(sel, e.target.value || null)}>
            <option value="">{t("legend.unowned")}</option>
            {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label={t("f.status")}>
          <select className="select" value={g.status || "core"} onChange={(e) => setG({ status: e.target.value })}>
            {STATUSES.map((st) => <option key={st} value={st}>{t("status." + st)}</option>)}
          </select>
        </Field>
        <StatusExtras status={g.status} claimants={g.claimants} occupiedFrom={g.occupiedFrom} owner={g.owner} onChange={(patch) => setG(patch)}></StatusExtras>
        {g.status === "autonomy" && <AutonomyPicker sel={sel} owner={g.owner} autonomyId={g.autonomyId}></AutonomyPicker>}
        <Field label={t("f.color")}>
          <div className="field-row">
            <input type="color" className="color-input" value={g.color || "#cccccc"} onChange={(e) => setG({ color: e.target.value })}></input>
            {g.color && <button className="btn outline" style={{ height: 26, fontSize: 11 }} onClick={() => setG({ color: null })}>↺</button>}
          </div>
        </Field>
        <div className="props-section-title">{t("props.region")}</div>
        <TextField label={t("f.population")} value={g.population} onChange={(v) => setG({ population: v })}></TextField>
        <ComboField label={t("f.culture")} listKey="culture" stateField="culture" value={g.culture} onChange={(v) => setG({ culture: v })}></ComboField>
        <ComboField label={t("f.language")} listKey="language" stateField="language" value={g.language} onChange={(v) => setG({ language: v })}></ComboField>
        <ComboField label={t("f.religion")} listKey="religion" stateField="religion" value={g.religion} onChange={(v) => setG({ religion: v })}></ComboField>
        <AreaField label={t("f.notes")} value={g.notes} onChange={(v) => setG({ notes: v })}></AreaField>
        <button className="btn outline danger" onClick={() => { Actions.ungroup(gid); Actions.select([], false); }}>{t("group.split")}</button>
      </div>
    );
  }

  const multi = sel.length > 1;
  const f = App.basemap.byId[rid];
  const r = p.regions[rid] || {};
  const setAll = (patch) => Actions.setRegion(sel, patch, { undo: false });
  const effFirst = effRegion(p, rid) || {};
  const commonOwner = multi ? (sel.every((x) => (effRegion(p, x) || {}).owner === effFirst.owner) ? effFirst.owner : "__mixed") : effFirst.owner;
  const commonMeta = (key) => {
    const first = effFirst[key] || "";
    return sel.every((x) => ((effRegion(p, x) || {})[key] || "") === first) ? first : "";
  };

  return (
    <div className="props-body">
      {multi ? (
        <React.Fragment>
          <div className="muted"><b style={{ color: "var(--text)" }}>{sel.length}</b> {t("region.multi")}</div>
          {window.GeomEdit && GeomEdit.enabled() ? (
            <button className="btn primary" onClick={() => {
              const nm = prompt(t("edit.mergeNameAsk"), (p.regions[sel[0]] && p.regions[sel[0]].name) || (App.basemap.byId[sel[0]] || {}).name || "");
              if (nm !== null) Actions.mergeRegionsGeometry(sel, nm || null);
            }}>{t("edit.merge")}</button>
          ) : (
            <button className="btn primary" onClick={() => Actions.groupRegions(sel)}>{t("group.merge")}</button>
          )}
          {RegionModel.supportsRegions() && (
            <React.Fragment>
              <div className="props-section-title">{t("region.fromProvinces")}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t("region.fromProvincesHint")}</div>
              <NewRegionForm defaultType="historical" onCreate={(name, type) => Actions.createRegionFromProvinces(sel, { name, type })}></NewRegionForm>
            </React.Fragment>
          )}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <TextField label={t("f.name")} value={r.name || ""} placeholder={f ? f.name : ""} onChange={(v) => setAll({ name: v || null })}></TextField>
          {f && <div className="muted">{t("region.baseName")}: {f.name}{f.country ? " · " + f.country : ""}</div>}
          {f && (f.histArea || f.cultArea) && (
            <div className="muted">
              {f.histArea ? t("region.histArea") + ": " + f.histArea : ""}
              {f.histArea && f.cultArea ? " · " : ""}
              {f.cultArea ? t("region.cultArea") + ": " + f.cultArea : ""}
            </div>
          )}
        </React.Fragment>
      )}
      <Field label={t("f.owner")}>
        <select className="select" value={commonOwner || ""} onChange={(e) => Actions.assign(sel, e.target.value || null)}>
          {commonOwner === "__mixed" && <option value="__mixed">···</option>}
          <option value="">{t("legend.unowned")}</option>
          {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <Field label={t("f.status")}>
        <select className="select" value={r.status || "core"} onChange={(e) => setAll({ status: e.target.value })}>
          {STATUSES.map((st) => <option key={st} value={st}>{t("status." + st)}</option>)}
        </select>
      </Field>
      <StatusExtras status={r.status} claimants={r.claimants} occupiedFrom={r.occupiedFrom} owner={effFirst.owner} onChange={(patch) => setAll(patch)}></StatusExtras>
      {r.status === "autonomy" && <AutonomyPicker sel={sel} owner={effFirst.owner} autonomyId={effFirst.autonomyId}></AutonomyPicker>}
      <Field label={t("f.color")}>
        <div className="field-row">
          <input type="color" className="color-input" value={r.color || "#cccccc"} onChange={(e) => setAll({ color: e.target.value })}></input>
          {r.color && <button className="btn outline" style={{ height: 26, fontSize: 11 }} onClick={() => setAll({ color: null })}>↺</button>}
        </div>
      </Field>
      <div className="props-section-title">{t("props.region")}</div>
      {!multi && <TextField label={t("f.population")} value={r.population} onChange={(v) => setAll({ population: v })}></TextField>}
      <ComboField label={t("f.culture")} listKey="culture" stateField="culture" value={commonMeta("culture")} onChange={(v) => setAll({ culture: v })}></ComboField>
      <ComboField label={t("f.language")} listKey="language" stateField="language" value={commonMeta("language")} onChange={(v) => setAll({ language: v })}></ComboField>
      <ComboField label={t("f.religion")} listKey="religion" stateField="religion" value={commonMeta("religion")} onChange={(v) => setAll({ religion: v })}></ComboField>
      {!multi && (
        <React.Fragment>
          <AreaField label={t("f.notes")} value={r.notes} onChange={(v) => setAll({ notes: v })}></AreaField>
          {f && <button className="btn outline" onClick={() => MapAPI.zoomTo(f.b)}>{t("zoom.fit")} → {r.name || f.name}</button>}
          {window.GeomEdit && GeomEdit.enabled() && (
            <React.Fragment>
              <div className="props-section-title">{t("edit.section")}</div>
              <div className="field-row" style={{ flexWrap: "wrap", gap: 4 }}>
                <button className="btn outline" style={{ fontSize: 11 }} onClick={() => GeomEdit.startEdit(rid)}>{t("edit.editBorders")}</button>
                <button className="btn outline" style={{ fontSize: 11 }} onClick={() => { Actions.ui({ tool: "split" }); Actions.toast(t("edit.splitHint")); }}>{t("edit.splitBtn")}</button>
                <button className="btn outline danger" style={{ fontSize: 11 }} onClick={() => {
                  if (!confirm(t("edit.deleteAsk"))) return;
                  const merge = confirm(t("edit.deleteMergeAsk"));
                  Actions.deleteRegionGeometry(rid, merge ? "merge" : "hole");
                }}>{t("edit.deleteBtn")}</button>
              </div>
              <div className="muted" style={{ fontSize: 11 }}>{t("edit.hint")}</div>
            </React.Fragment>
          )}
          {RegionModel.supportsRegions() && (
            <React.Fragment>
              <div className="props-section-title">{t("region.fromProvinces")}</div>
              <NewRegionForm defaultType="historical" onCreate={(name, type) => Actions.createRegionFromProvinces(sel, { name, type })}></NewRegionForm>
            </React.Fragment>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

function PropsPanel() {
  useStore();
  if (!App.project) return <div className="props-panel"></div>;
  const tab = App.ui.panel;
  const Tabs = { map: MapTab, state: StateTab, region: RegionTab, catalog: CatalogTab };
  const Body = Tabs[tab] || MapTab;
  return (
    <div className="props-panel" data-screen-label="Properties panel">
      <div className="props-tabs">
        {["map", "state", "region", "catalog"].map((k) => (
          <button key={k} className={"props-tab" + (tab === k ? " active" : "")} onClick={() => Actions.ui({ panel: k })}>
            {t("props." + k)}
          </button>
        ))}
      </div>
      <Body></Body>
    </div>
  );
}

Object.assign(window, { Toolbar, StatesPanel, PropsPanel });
