// AtlasForge — top bar, menus, search, legend, timeline, modals, toast
function MenuButton({ id, label, children }) {
  useStore();
  const open = App.ui.menu === id;
  return (
    <div className="menu-wrap">
      <button className="btn" onClick={(e) => { e.stopPropagation(); Actions.ui({ menu: open ? null : id }); }}>
        {label} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
      </button>
      {open && <div className="menu" onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

function MenuItem({ label, kbd, danger, onClick, disabled }) {
  return (
    <button className="menu-item" disabled={disabled} style={danger ? { color: "var(--danger)" } : null}
      onClick={() => { Actions.ui({ menu: null }); onClick && onClick(); }}>
      <span>{label}</span>
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  );
}

function SearchBox() {
  useStore();
  const [q, setQ] = React.useState("");
  const results = React.useMemo(() => {
    if (q.trim().length < 2 || App.basemap.status !== "ready") return [];
    const needle = q.trim().toLowerCase();
    const out = [];
    const p = App.project;
    for (const sid of p.stateOrder) {
      const s = p.states[sid];
      if (s && s.name.toLowerCase().includes(needle)) out.push({ kind: "state", id: sid, name: s.name, color: s.color });
      if (out.length >= 4) break;
    }
    for (const f of App.basemap.features) {
      const r = p.regions[f.id];
      const nm = (r && r.name) || f.name;
      if (nm.toLowerCase().includes(needle)) out.push({ kind: "region", id: f.id, name: nm, sub: f.country });
      if (out.length >= 12) break;
    }
    return out;
  }, [q, App.version]);

  const pick = (res) => {
    setQ("");
    if (res.kind === "region") {
      const f = App.basemap.byId[res.id];
      Actions.select([res.id], false);
      if (f) MapAPI.zoomTo(f.b);
    } else {
      Actions.ui({ activeState: res.id, panel: "state" });
      const p = App.project;
      let b = null;
      for (const rid in p.regions) {
        if (p.regions[rid].owner !== res.id) continue;
        const f = App.basemap.byId[rid];
        if (!f) continue;
        b = b ? [[Math.min(b[0][0], f.b[0][0]), Math.min(b[0][1], f.b[0][1])], [Math.max(b[1][0], f.b[1][0]), Math.max(b[1][1], f.b[1][1])]] : f.b;
      }
      if (b) MapAPI.zoomTo(b);
    }
  };

  return (
    <div className="search-wrap">
      <span className="search-icon">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="6" r="4.4"></circle><path d="M9.4 9.4 L13 13"></path></svg>
      </span>
      <input className="search-input" value={q} placeholder={t("search.placeholder")} onChange={(e) => setQ(e.target.value)}></input>
      {results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button key={i} className="search-res-item" onClick={() => pick(r)}>
              {r.kind === "state" && <span className="state-swatch" style={{ background: r.color }}></span>}
              <span>{r.name}{r.sub ? <span style={{ color: "var(--text-faint)" }}> · {r.sub}</span> : null}</span>
              <span className="search-res-kind">{t("search." + r.kind)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar() {
  useStore();
  const p = App.project;
  return (
    <div className="topbar" data-screen-label="Top bar">
      <div className="brand"><span className="brand-glyph">AF</span><span>{t("app.title")}</span></div>
      {p && (
        <input className="proj-name" value={p.name} onChange={(e) => Actions.mut((pr) => { pr.name = e.target.value; }, { undo: false })}></input>
      )}
      <MenuButton id="file" label={t("menu.file")}>
        <MenuItem label={t("menu.newProject")} onClick={() => Actions.ui({ modal: "templates" })}></MenuItem>
        <div className="menu-sep"></div>
        <MenuItem label={t("menu.importProject")} onClick={() => Exports.importProject()}></MenuItem>
        <MenuItem label={t("menu.importGeo")} onClick={() => Exports.importGeoJSON()}></MenuItem>
      </MenuButton>
      <MenuButton id="export" label={t("menu.export")}>
        <MenuItem label={t("menu.exportPng")} onClick={() => Exports.png(2, true)}></MenuItem>
        <MenuItem label={t("menu.exportPngHi")} onClick={() => Exports.png(4, true)}></MenuItem>
        <MenuItem label={t("menu.exportSvg")} onClick={() => Exports.svg()}></MenuItem>
        <MenuItem label={t("menu.exportJson")} onClick={() => Exports.json()}></MenuItem>
        {window.GeomEdit && GeomEdit.enabled() && <div className="menu-sep"></div>}
        {window.GeomEdit && GeomEdit.enabled() && <MenuItem label={t("menu.exportRegions")} onClick={() => Exports.regionsGeoJSON(false)}></MenuItem>}
        {window.GeomEdit && GeomEdit.enabled() && <MenuItem label={t("menu.exportRegionsSimplified")} onClick={() => Exports.regionsGeoJSON(true)}></MenuItem>}
      </MenuButton>
      <div className="tb-sep"></div>
      <div className="tb-group">
        <button className="btn icon" title={t("edit.undo") + " (Ctrl+Z)"} disabled={!App.undoStack.length} onClick={() => Actions.undo()}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3 L3 6 L6 9"></path><path d="M3 6 H10 a3.5 3.5 0 0 1 0 7 H6"></path></svg>
        </button>
        <button className="btn icon" title={t("edit.redo") + " (Ctrl+Y)"} disabled={!App.redoStack.length} onClick={() => Actions.redo()}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3 L13 6 L10 9"></path><path d="M13 6 H6 a3.5 3.5 0 0 0 0 7 H10"></path></svg>
        </button>
      </div>
      <div className="tb-spacer"></div>
      <SearchBox></SearchBox>
      <div className="tb-sep"></div>
      <button className="btn" title="Language" onClick={() => Actions.setLang(App.ui.lang === "ru" ? "en" : "ru")}>
        {App.ui.lang === "ru" ? "RU" : "EN"}
      </button>
      <button className="btn icon" title={t("theme.toggle")} onClick={() => Actions.setTheme(App.ui.theme === "dark" ? "light" : "dark")}>
        {App.ui.theme === "dark" ? "☾" : "☀"}
      </button>
      <button className="btn icon" title="Presentation (P)" onClick={() => Actions.ui({ present: true, menu: null })}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="8" rx="1"></rect><path d="M8 11 V13.5 M5.5 13.5 H10.5"></path></svg>
      </button>
    </div>
  );
}

function Legend() {
  useStore();
  const ref = React.useRef(null);
  const drag = React.useRef(null);
  const p = App.project;
  if (!p || !App.ui.showLegend || App.basemap.status !== "ready") return null;
  const counts = stateStats();
  const pos = App.ui.legendPos || { x: 276, y: 56 };
  const rows = p.stateOrder.map((id) => p.states[id]).filter(Boolean);
  if (!rows.length) return null;

  const onDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const onMove = (ev) => {
      if (!drag.current) return;
      Actions.ui({ legendPos: { x: drag.current.ox + ev.clientX - drag.current.sx, y: drag.current.oy + ev.clientY - drag.current.sy } });
    };
    const onUp = () => { drag.current = null; document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div className="legend" ref={ref} style={{ left: pos.x, top: pos.y }}>
      <div className="legend-head" onPointerDown={onDown}>
        <span>{t("legend.title")}</span>
        <button className="btn icon" style={{ height: 18, width: 18, fontSize: 11 }} onClick={() => Actions.ui({ showLegend: false })}>✕</button>
      </div>
      <div className="legend-body">
        {rows.map((s) => (
          <div key={s.id} className="legend-row" style={{ cursor: "pointer" }} onClick={() => Actions.ui({ activeState: s.id, panel: "state" })}>
            <span className="state-swatch" style={{ background: s.color }}></span>
            {s.flag && <img className="state-flag-mini" src={s.flag} alt=""></img>}
            <span>{s.name}</span>
            <span className="legend-count">{counts[s.id] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline() {
  useStore();
  const p = App.project;
  const playRef = React.useRef(null);
  if (!p) return null;
  const addYear = () => {
    const v = prompt(t("timeline.prompt"), p.currentYear != null ? String(p.currentYear + 10) : "1900");
    if (v == null) return;
    const y = parseInt(v, 10);
    if (Number.isFinite(y)) Actions.addYear(y);
  };
  const play = () => {
    if (App.ui.playing) {
      clearInterval(playRef.current);
      Actions.ui({ playing: false });
      return;
    }
    if (p.years.length < 2) return;
    let i = 0;
    Actions.gotoYear(p.years[0]);
    Actions.ui({ playing: true });
    playRef.current = setInterval(() => {
      i++;
      if (i >= App.project.years.length) { clearInterval(playRef.current); Actions.ui({ playing: false }); return; }
      Actions.gotoYear(App.project.years[i]);
    }, 1400);
  };
  return (
    <div className="timeline" data-screen-label="Timeline">
      <span className="timeline-label">{t("timeline.title")}</span>
      <div className="year-chips">
        {p.years.length === 0 && <span className="muted">{t("timeline.hint")}</span>}
        {p.years.map((y) => (
          <button key={y} className={"year-chip" + (p.currentYear === y ? " current" : "")}
            onClick={() => Actions.gotoYear(y)}
            onContextMenu={(e) => { e.preventDefault(); if (confirm(t("timeline.deleteYear"))) Actions.deleteYear(y); }}>
            {y < 0 ? Math.abs(y) + " BC" : y}
          </button>
        ))}
      </div>
      <button className="btn outline" onClick={addYear}>{t("timeline.addYear")}</button>
      <button className="btn outline" disabled={p.years.length < 2} onClick={play}>{App.ui.playing ? t("timeline.stop") : t("timeline.play")}</button>
    </div>
  );
}

function TemplatesModal() {
  useStore();
  const [choice, setChoice] = React.useState("admin1");
  const [showClassic, setShowClassic] = React.useState(false);
  const firstRun = !App.project;
  // The primary map plus the themed / blank starting points (all fully editable).
  const cards = [
    { id: "admin1", name: t("tmpl.admin1.name"), desc: t("tmpl.admin1.desc"), count: "~4600", feats: ["region-grid", "physical", "countries"] },
    { id: "world_hoi4", name: t("tmpl.worldhoi4.name"), desc: t("tmpl.worldhoi4.desc"), count: "~1770", feats: ["region-grid", "physical", "countries"] },
    { id: "owb", name: t("tmpl.owb.name"), desc: t("tmpl.owb.desc"), count: "~1984", feats: ["region-grid", "physical", "countries"] },
    { id: "blank", name: t("tmpl.blank.name"), desc: t("tmpl.blank.desc"), count: "0", feats: ["draw", "physical"] }
  ];
  // Other base maps kept available but out of the main gallery.
  const classic = [
    { id: "best_regions_world", name: t("tmpl.best.name"), desc: t("tmpl.best.desc"), count: "~2550" },
    { id: "atlas_world", name: t("tmpl.atlas.name"), desc: t("tmpl.atlas.desc"), count: "~1250" },
    { id: "world_states", name: t("tmpl.worldstates.name"), desc: t("tmpl.worldstates.desc"), count: "~1050" },
    { id: "detailed_province_world", name: t("tmpl.dpw.name"), desc: t("tmpl.dpw.desc"), count: "~10000" },
    { id: "provinces", name: t("tmpl.provinces.name"), desc: t("tmpl.provinces.desc"), count: "~6500" },
    { id: "strategic", name: t("tmpl.strategic.name"), desc: t("tmpl.strategic.desc"), count: "~2200" },
    { id: "world-50", name: t("tmpl.world50.name"), desc: t("tmpl.world50.desc"), count: "~241" },
    { id: "custom", name: t("tmpl.custom.name"), desc: t("tmpl.custom.desc"), count: "GeoJSON" }
  ];
  const grouped = false;
  const create = () => {
    if (choice === "custom") { Exports.importGeoJSON(); return; }
    Actions.newProject(choice, { groupByCountry: false });
  };
  const Card = (c, big) => (
    <button key={c.id} className={"tmpl-card" + (choice === c.id ? " selected" : "")} style={big ? { gridColumn: "1 / -1" } : null} onClick={() => setChoice(c.id)}>
      <span className="tmpl-name">{c.name}</span>
      <span className="tmpl-desc">{c.desc}</span>
      {c.feats && (
        <span className="chip-row" style={{ marginTop: 2 }}>
          {c.feats.map((f) => <span key={f} className="chip" style={{ cursor: "default" }}>{t("feat." + f)}</span>)}
        </span>
      )}
      <span className="tmpl-count">{c.count} {t("stat.regions")}</span>
    </button>
  );
  return (
    <div className="modal-backdrop" onClick={() => { if (!firstRun) Actions.ui({ modal: null }); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("modal.templates.title")}</span>
          {!firstRun && <button className="btn icon" onClick={() => Actions.ui({ modal: null })}>✕</button>}
        </div>
        <div className="modal-body">
          <div className="muted">{t("modal.templates.desc")}</div>
          <div className="tmpl-grid">
            {cards.map((c, i) => Card(c, i === 0))}
          </div>
          <button className="btn outline" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => setShowClassic((v) => !v)}>
            {showClassic ? "▾ " : "▸ "}{t("tmpl.classic")}
          </button>
          {showClassic && <div className="tmpl-grid">{classic.map((c) => Card(c, false))}</div>}
          {grouped && (
            <label className="check-row">
              <span>{t("tmpl.groupByCountry")} ✓</span>
            </label>
          )}
        </div>
        <div className="modal-foot">
          {!firstRun && <button className="btn outline" onClick={() => Actions.ui({ modal: null })}>{t("modal.cancel")}</button>}
          <button className="btn primary" onClick={create}>{t("modal.create")}</button>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  useStore();
  if (!App.ui.toast) return null;
  return <div className="toast">{App.ui.toast}</div>;
}

Object.assign(window, { TopBar, Legend, Timeline, TemplatesModal, Toast });
