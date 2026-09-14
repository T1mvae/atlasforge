// AtlasForge — top bar, menus, search, legend, timeline, modals, toast
function MenuButton({ id, label, children, right }) {
  useStore();
  const open = App.ui.menu === id;
  return (
    <div className="menu-wrap">
      <button className="btn" onClick={(e) => { e.stopPropagation(); Actions.ui({ menu: open ? null : id }); }}>
        {label} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
      </button>
      {open && <div className={"menu" + (right ? " right" : "")} onClick={(e) => e.stopPropagation()}>{children}</div>}
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
      <button className={"btn icon panel-toggle" + (App.ui.leftOpen ? " on" : "")} title={t("input.toggleLeft")}
        onClick={() => Actions.setPref({ leftOpen: !App.ui.leftOpen })}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="12" height="10" rx="1.5"></rect><path d="M6 3 V13"></path></svg></button>
      <div className="brand"><span className="brand-glyph">AF</span><span className="brand-name">{t("app.title")}</span></div>
      {p && (
        <input className="proj-name" value={p.name} onChange={(e) => Actions.mut((pr) => { pr.name = e.target.value; }, { undo: false })}></input>
      )}
      <MenuButton id="file" label={t("menu.file")}>
        {window.ProjectStore && ProjectStore.available && <MenuItem label={t("lib.menu")} onClick={() => Actions.ui({ modal: "library" })}></MenuItem>}
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
        {window.World && World.active() && <MenuItem label={t("world.atlas")} disabled={!App.basemap.count} onClick={() => Actions.ui({ modal: "atlas" })}></MenuItem>}
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
      <MenuButton id="input" label={<span className="input-menu-label"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M11 2.5 L13.5 5 L6 12.5 L3 13 L3.5 10 Z"></path><path d="M9.5 4 L12 6.5"></path></svg></span>} right>
        <div className="menu-title">{t("input.title")}</div>
        <label className="menu-check">
          <input type="checkbox" checked={App.ui.pencilOnly !== false} onChange={(e) => Actions.setPref({ pencilOnly: e.target.checked })}></input>
          <span>{t("input.pencilOnly")}<small>{t("input.pencilOnlyHint")}</small></span>
        </label>
        <label className="menu-check">
          <input type="checkbox" checked={App.ui.worldPressure !== false} onChange={(e) => Actions.setPref({ worldPressure: e.target.checked })}></input>
          <span>{t("world.pressure")}<small>{window.World && World.pressureSupport() === "no" ? t("input.noPressure") : t("input.pressureHint")}</small></span>
        </label>
        <label className="menu-check">
          <input type="checkbox" checked={!!App.ui.tiltSize} onChange={(e) => Actions.setPref({ tiltSize: e.target.checked })}></input>
          <span>{t("input.tilt")}<small>{t("input.tiltHint")}</small></span>
        </label>
        <div className="menu-sep"></div>
        <div className="menu-note">{t("input.gestures")}</div>
      </MenuButton>
      <button className="btn" title="Language" onClick={() => Actions.setLang(App.ui.lang === "ru" ? "en" : "ru")}>
        {App.ui.lang === "ru" ? "RU" : "EN"}
      </button>
      <button className="btn icon" title={t("theme.toggle")} onClick={() => Actions.setTheme(App.ui.theme === "dark" ? "light" : "dark")}>
        {App.ui.theme === "dark" ? "☾" : "☀"}
      </button>
      <button className={"btn icon panel-toggle" + (App.ui.rightOpen ? " on" : "")} title={t("input.toggleRight")}
        onClick={() => Actions.setPref({ rightOpen: !App.ui.rightOpen })}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="3" width="12" height="10" rx="1.5"></rect><path d="M10 3 V13"></path></svg></button>
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
  const metadataField = ["culture", "religion", "language"].includes(p.displayMode) ? p.displayMode : null;
  const metadataRows = metadataField && window.Metadata ? Metadata.legend(p, metadataField) : [];
  if (!metadataField && !rows.length) return null;
  if (metadataField && !metadataRows.length) return null;

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
        <span>{metadataField ? t("legend." + metadataField) : t("legend.title")}</span>
        <button className="btn icon" style={{ height: 18, width: 18, fontSize: 11 }} onClick={() => Actions.ui({ showLegend: false })}>✕</button>
      </div>
      <div className="legend-body">
        {metadataField ? metadataRows.map((row) => (
          <div key={row.name} className="legend-row" style={{ cursor: "pointer" }} onClick={() => Actions.selectByMetadata(metadataField, row.name)}>
            <span className="state-swatch" style={{ background: row.color }}></span>
            <span>{row.name}</span>
            <span className="legend-count">{row.count}</span>
          </div>
        )) : rows.map((s) => (
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

// template id -> i18n key prefix of its name (library cards show which map a project uses)
const TEMPLATE_KEYS = {
  admin1: "tmpl.admin1", world_hoi4: "tmpl.worldhoi4", owb: "tmpl.owb", agot: "tmpl.agot", blank: "tmpl.blank",
  world: "tmpl.world", agot_duchies: "tmpl.agotd", agot_kingdoms: "tmpl.agotk", agot_baronies: "tmpl.agotb",
  best_regions_world: "tmpl.best", atlas_world: "tmpl.atlas", world_states: "tmpl.worldstates",
  detailed_province_world: "tmpl.dpw", provinces: "tmpl.provinces", strategic: "tmpl.strategic",
  "world-50": "tmpl.world50", custom: "tmpl.custom"
};
const templateName = (id) => (TEMPLATE_KEYS[id] ? t(TEMPLATE_KEYS[id] + ".name") : id);

// ---------- project library ("My maps") ----------
function LibraryModal() {
  useStore();
  const [items, setItems] = React.useState(null);
  const [tab, setTab] = React.useState("maps");
  const [thumbs, setThumbs] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const store = window.ProjectStore;
  const canClose = !!App.project;

  const reload = React.useCallback(async () => {
    if (!store || !store.available) { setItems([]); return; }
    const list = await store.list();
    setItems(list);
    const urls = {};
    for (const it of list) {
      try { const b = await store.thumb(it.id); if (b) urls[it.id] = URL.createObjectURL(b); } catch (e) {}
    }
    setThumbs((prev) => { Object.values(prev).forEach((u) => URL.revokeObjectURL(u)); return urls; });
  }, []);

  React.useEffect(() => {
    (async () => {
      if (App.project) { await Exports.saveThumbnail(); await Actions.saveNow(); }
      reload();
    })();
    return () => setThumbs((prev) => { Object.values(prev).forEach((u) => URL.revokeObjectURL(u)); return {}; });
  }, []);

  const act = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); reload(); } };
  const open = (it) => act(() => Actions.openProject(it.id));
  const rename = (it) => {
    const name = prompt(t("lib.renameAsk"), it.name);
    if (name == null) return;
    act(async () => {
      await store.rename(it.id, name);
      if (App.projectId === it.id && App.project) Actions.mut((p) => { p.name = name; }, { undo: false });
    });
  };
  const duplicate = (it) => act(() => store.duplicate(it.id, uid(), " " + t("lib.copySuffix")));
  const exportFile = (it) => act(async () => {
    const p = App.projectId === it.id && App.project ? App.project : await store.load(it.id);
    if (!p) return;
    const name = (p.name || "map").replace(/[^\w\u0400-\u04FF -]+/g, "").trim() || "map";
    const data = window.World ? World.exportable(p) : p;
    window.downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), name + ".atlasforge.json");
  });
  const trash = (it) => {
    if (!confirm(t("lib.trashAsk").replace("{name}", it.name || t("lib.untitled")))) return;
    act(async () => {
      await store.trash(it.id);
      if (App.projectId === it.id) Actions.closeProject();
    });
  };
  const restore = (it) => act(() => store.restore(it.id));
  const purge = (it) => {
    if (!confirm(t("lib.purgeAsk").replace("{name}", it.name || t("lib.untitled")))) return;
    act(() => store.purge(it.id));
  };
  const emptyTrash = () => {
    const tr = (items || []).filter((x) => x.trashed);
    if (!tr.length || !confirm(t("lib.emptyTrashAsk").replace("{n}", tr.length))) return;
    act(async () => { for (const it of tr) await store.purge(it.id); });
  };

  const fmtDate = (ms) => {
    try {
      return new Date(ms).toLocaleString(App.ui.lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  };
  const visible = (items || []).filter((x) => (tab === "trash" ? !!x.trashed : !x.trashed));
  const trashCount = (items || []).filter((x) => x.trashed).length;

  return (
    <div className="modal-backdrop" onClick={() => { if (canClose) Actions.ui({ modal: null }); }}>
      <div className="modal library-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("lib.title")}</span>
          <div className="library-head-actions">
            <button className="btn outline" onClick={() => Exports.importProject()}>{t("lib.import")}</button>
            <button className="btn primary" onClick={() => Actions.ui({ modal: "templates" })}>＋ {t("lib.new")}</button>
            {canClose && <button className="btn icon" onClick={() => Actions.ui({ modal: null })}>✕</button>}
          </div>
        </div>
        <div className="library-tabs">
          <button className={"chip" + (tab === "maps" ? " on" : "")} onClick={() => setTab("maps")}>{t("lib.maps")}</button>
          <button className={"chip" + (tab === "trash" ? " on" : "")} onClick={() => setTab("trash")}>{t("lib.trash")}{trashCount ? " (" + trashCount + ")" : ""}</button>
          {tab === "trash" && trashCount > 0 && <button className="btn outline" style={{ marginLeft: "auto" }} onClick={emptyTrash}>{t("lib.emptyTrash")}</button>}
        </div>
        <div className="modal-body">
          {!store || !store.available ? <div className="muted">{t("lib.unavailable")}</div> : null}
          {items && visible.length === 0 && <div className="muted library-empty">{tab === "trash" ? t("lib.trashEmpty") : t("lib.empty")}</div>}
          <div className={"library-grid" + (busy ? " busy" : "")}>
            {visible.map((it) => (
              <div key={it.id} className={"library-card" + (App.projectId === it.id ? " current" : "")}>
                <button className="library-thumb" onClick={() => (tab === "trash" ? restore(it) : open(it))}>
                  {thumbs[it.id] ? <img src={thumbs[it.id]} alt=""></img> : <span className="library-thumb-empty">{templateName(it.basemapId)}</span>}
                  {App.projectId === it.id && <span className="library-badge">{t("lib.open")}</span>}
                </button>
                <div className="library-meta">
                  <div className="library-name">{it.name || t("lib.untitled")}</div>
                  <div className="library-sub">{templateName(it.basemapId)} · {fmtDate(it.updated)}</div>
                  <div className="library-sub">{t("lib.stats").replace("{s}", it.states || 0).replace("{r}", it.owned || 0)}</div>
                </div>
                <div className="library-actions">
                  {tab === "trash" ? (
                    <React.Fragment>
                      <button className="btn outline" onClick={() => restore(it)}>{t("lib.restore")}</button>
                      <button className="btn outline danger" onClick={() => purge(it)}>{t("lib.purge")}</button>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <button className="btn outline" onClick={() => rename(it)} title={t("lib.rename")}>✎</button>
                      <button className="btn outline" onClick={() => duplicate(it)} title={t("lib.duplicate")}>⧉</button>
                      <button className="btn outline" onClick={() => exportFile(it)} title={t("lib.export")}>⇪</button>
                      <button className="btn outline" onClick={() => trash(it)} title={t("lib.toTrash")}>🗑</button>
                    </React.Fragment>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// "download for offline" chip on a template card
function OfflineChip({ id }) {
  const [state, setState] = React.useState("checking");
  React.useEffect(() => {
    let alive = true;
    if (!window.PWA || !PWA.templateUrls(id).length) { setState("none"); return; }
    PWA.isTemplateOffline(id).then((ok) => { if (alive) setState(ok ? "ready" : "idle"); });
    return () => { alive = false; };
  }, [id]);
  if (state === "none" || state === "checking") return null;
  if (state === "ready") return <span className="chip offline-chip ready" title={t("offline.readyHint")}>✓ {t("offline.ready")}</span>;
  return (
    <span className={"chip offline-chip" + (state === "loading" ? " loading" : "")} role="button"
      onClick={(e) => {
        e.stopPropagation();
        if (state === "loading") return;
        setState("loading");
        PWA.downloadTemplate(id).then(() => setState("ready"), () => { setState("idle"); Actions.toast(t("offline.failed")); });
      }}>
      {state === "loading" ? "…" : "⬇"} {t(state === "loading" ? "offline.loading" : "offline.download")}
    </span>
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
    { id: "agot", name: t("tmpl.agot.name"), desc: t("tmpl.agot.desc"), count: "~4130", feats: ["region-grid", "physical", "countries"] },
    { id: "world", name: t("tmpl.world.name"), desc: t("tmpl.world.desc"), count: "0", feats: ["paintTerrain", "aiAtlas"] },
    { id: "blank", name: t("tmpl.blank.name"), desc: t("tmpl.blank.desc"), count: "0", feats: ["draw", "physical"] }
  ];
  // Other base maps kept available but out of the main gallery.
  const classic = [
    { id: "agot_duchies", name: t("tmpl.agotd.name"), desc: t("tmpl.agotd.desc"), count: "~720" },
    { id: "agot_kingdoms", name: t("tmpl.agotk.name"), desc: t("tmpl.agotk.desc"), count: "~68" },
    { id: "agot_baronies", name: t("tmpl.agotb.name"), desc: t("tmpl.agotb.desc"), count: "~23110" },
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
    if (choice === "world") Actions.ui({ tool: "world", worldBrush: "land" });
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
      <span className="tmpl-count">{c.count} {t("stat.regions")} <OfflineChip id={c.id}></OfflineChip></span>
    </button>
  );
  return (
    <div className="modal-backdrop" onClick={() => { if (!firstRun) Actions.ui({ modal: null }); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t("modal.templates.title")}</span>
          <span className="library-head-actions">
            {window.ProjectStore && ProjectStore.available && <button className="btn outline" onClick={() => Actions.ui({ modal: "library" })}>{t("lib.title")}</button>}
            {!firstRun && <button className="btn icon" onClick={() => Actions.ui({ modal: null })}>✕</button>}
          </span>
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

// installable app: "new version ready" + "add to Home Screen" (Safari on iPad)
function PwaBanner() {
  useStore();
  const P = window.PWA;
  if (!P) return null;
  if (App.ui.card || (window.World && (World.preview || World.geoBusy))) return null; // a card or the geography bar needs the spot
  if (P.updateReady) {
    return (
      <div className="pwa-banner">
        <span>{t("pwa.updateReady")}</span>
        <button className="btn primary" onClick={() => P.applyUpdate()}>{t("pwa.reload")}</button>
      </div>
    );
  }
  if (P.showInstallHint() && !App.ui.modal) {
    return (
      <div className="pwa-banner">
        <span>{t("pwa.installHint")}</span>
        <button className="btn outline" onClick={() => P.hideInstallHint()}>{t("pwa.dismiss")}</button>
      </div>
    );
  }
  return null;
}

// round quick menu for thumbs (bottom-right of the map): the actions one reaches for
// mid-drawing without travelling to the toolbars
function QuickMenu() {
  useStore();
  const open = !!App.ui.quickOpen;
  if (!App.project || App.ui.present) return null;
  const world = window.World && World.active();
  const close = () => Actions.ui({ quickOpen: false });
  const items = [
    { key: "undo", icon: "↶", label: t("edit.undo"), disabled: !App.undoStack.length, run: () => Actions.undo() },
    { key: "redo", icon: "↷", label: t("edit.redo"), disabled: !App.redoStack.length, run: () => Actions.redo() },
    { key: "panels", icon: "▭", label: t("input.panels"), run: () => {
      const any = App.ui.leftOpen || App.ui.rightOpen;
      Actions.setPref({ leftOpen: !any && window.innerWidth >= 1300, rightOpen: !any });
    } },
    { key: "fit", icon: "⤢", label: t("zoom.fit"), run: () => MapAPI.fit() },
    { key: "select", icon: "➚", label: t("tools.select"), on: App.ui.tool === "select", run: () => Actions.ui({ tool: "select" }) },
    { key: "paint", icon: "✎", label: t("tools.paint"), on: App.ui.tool === "paint", run: () => Actions.ui({ tool: "paint" }) },
    world
      ? { key: "world", icon: "⛰", label: t("tools.world"), on: App.ui.tool === "world", run: () => Actions.ui({ tool: "world" }) }
      : { key: "label", icon: "T", label: t("tools.label"), on: App.ui.tool === "label", run: () => Actions.ui({ tool: "label" }) },
    { key: "present", icon: "◱", label: t("input.fullscreen"), run: () => Actions.ui({ present: true }) }
  ];
  const short = (label) => String(label).replace(/\s*\([^)]*\)\s*$/, "");
  return (
    <div className={"quick-menu" + (open ? " open" : "")} data-export-skip="1">
      {open && <div className="quick-scrim" onPointerDown={close}></div>}
      {open && (
        <div className="quick-grid">
          {items.map((it) => (
            <button key={it.key} className={"quick-item" + (it.on ? " on" : "")} disabled={it.disabled}
              onClick={() => { it.run(); if (it.key !== "undo" && it.key !== "redo") close(); }}>
              <span className="quick-icon">{it.icon}</span>
              <span className="quick-label">{short(it.label)}</span>
            </button>
          ))}
        </div>
      )}
      <button className="quick-toggle" title={t("input.quick")} onClick={() => Actions.ui({ quickOpen: !open })}>{open ? "✕" : "◎"}</button>
    </div>
  );
}

function Toast() {
  useStore();
  if (!App.ui.toast) return null;
  return <div className="toast">{App.ui.toast}</div>;
}

Object.assign(window, { TopBar, Legend, Timeline, TemplatesModal, LibraryModal, Toast, PwaBanner, QuickMenu });
