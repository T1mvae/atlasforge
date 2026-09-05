// AtlasForge — core store, actions, undo/redo, autosave
(function () {
  const LS_KEY = "atlasforge.project.v1";
  const LS_UI = "atlasforge.ui.v1";

  const uid = () => Math.random().toString(36).slice(2, 9);
  window.uid = uid;

  // ---------- color helpers ----------
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * c).toString(16).padStart(2, "0");
    };
    return "#" + f(0) + f(8) + f(4);
  }
  let autoCounter = 0;
  const hueStart = 18;
  // muted, cartographic palette variation (grand-strategy / Risk-like) instead of neon
  const AUTO_L = [56, 47, 64, 51, 60, 43];
  const AUTO_S = [38, 44, 33, 47, 36, 41];
  function nextAutoColor(i) {
    const idx = i === undefined ? autoCounter++ : i;
    const h = (hueStart + idx * 137.508) % 360;
    return hslToHex(h, AUTO_S[idx % AUTO_S.length], AUTO_L[idx % AUTO_L.length]);
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  // subtle per-region tint of the base land color, so every region is individually visible
  function provinceTint(land, id) {
    const h = hashStr(String(id));
    const lAmt = (((h % 100) / 100) - 0.5) * 0.17;      // ±8.5% lightness
    const warm = ((((h >> 7) % 100) / 100) - 0.5) * 0.10; // ±5% toward warm/cool
    let c = lAmt >= 0 ? mixHex(land, "#000000", lAmt) : mixHex(land, "#ffffff", -lAmt);
    c = warm >= 0 ? mixHex(c, "#caa46a", warm) : mixHex(c, "#6a8fca", -warm);
    return c;
  }
  function mixHex(hex, hex2, t) {
    const p = (x, i) => parseInt(x.slice(i, i + 2), 16);
    const a = [p(hex, 1), p(hex, 3), p(hex, 5)];
    const b = [p(hex2, 1), p(hex2, 3), p(hex2, 5)];
    const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  window.ColorUtil = { hslToHex, nextAutoColor, mixHex, provinceTint, lighten: (h, t) => mixHex(h, "#ffffff", t), darken: (h, t) => mixHex(h, "#000000", t) };

  // ---------- map style presets ----------
  window.MAP_STYLES = {
    standard:  { sea: "#b7cfdf", land: "#e9e5d8", borders: "#6f6a5e", labelColor: "#22252a", labelFont: "var(--font-ui)" },
    parchment: { sea: "#e6d9bb", land: "#f2ead3", borders: "#8a7350", labelColor: "#473821", labelFont: "Georgia, 'Times New Roman', serif" },
    dark:      { sea: "#0f1318", land: "#2b313a", borders: "#4a525e", labelColor: "#d8dce2", labelFont: "var(--font-ui)" },
    strategic: { sea: "#26323d", land: "#46505a", borders: "#161a1f", labelColor: "#ece7d6", labelFont: "var(--font-ui)" },
    minimal:   { sea: "#ffffff", land: "#ececec", borders: "#9a9a9a", labelColor: "#333333", labelFont: "var(--font-ui)" }
  };

  // ---------- store ----------
  const App = (window.App = {
    version: 0,
    terrVersion: 0,
    regionVersion: 0,
    listeners: new Set(),
    ui: {
      lang: "ru",
      theme: "dark",
      tool: "select",
      selectMode: "province",   // "province" | "region"
      activeState: null,
      selection: [],            // selected province feature ids
      regionSelection: [],      // selected region ids (region mode)
      panel: "map",
      modal: null,
      menu: null,
      search: "",
      present: false,
      showLegend: true,
      legendPos: null,
      toast: null,
      playing: false,
      propsWidth: 320            // right properties panel width (px), persisted
    },
    project: null,
    basemap: { status: "idle", features: [], byId: {}, sphere: "", count: 0, error: null, topo: null, topoObj: null },
    regionData: { status: "idle", regions: [], byId: {}, provinceToRegion: {} },
    physical: { status: "idle", rivers: [], lakes: [], relief: [], seas: [] },
    undoStack: [],
    redoStack: [],
    subscribe(fn) {
      App.listeners.add(fn);
      return () => App.listeners.delete(fn);
    },
    emit() {
      App.version++;
      App.listeners.forEach((l) => l());
    }
  });

  function t(key) {
    const d = window.I18N[App.ui.lang] || window.I18N.en;
    return d[key] ?? window.I18N.en[key] ?? key;
  }
  window.t = t;

  // ---------- project factory ----------
  function newProjectData(basemapId, name) {
    const def = window.BASEMAPS[basemapId] || {};
    const hasRegions = def.kind === "pixelgeo" && def.regionDataset;
    return {
      name: name || (App.ui.lang === "ru" ? "Новый проект" : "New project"),
      basemapId,
      baseMapDataset: def.dataset || null,
      provinceDataset: def.provinceDataset || null,
      regionDataset: def.regionDataset || null,
      customGeo: null,
      settings: Object.assign(
        {
          style: "standard",
          borderW: 0.8,
          innerBorders: true,
          stateBorders: true,
          showLabels: false,
          showStateLabels: true,
          showFlags: true,
          showProvinceBorders: true,
          showRegionBorders: true,
          showCountryBorders: true,
          countryBorderW: 1.6,
          showCoastlines: true,
          showRivers: true,
          showLakes: true,
          showMountains: true,
          snap: { borders: true, rivers: true, lakes: true, mountains: false },
          cutSmooth: true,
          showRivers: true,
          showLakes: true,
          showMountains: true,
          showSeaLabels: true,
          provinceTint: basemapId === "strategic" || basemapId === "admin1" || basemapId === "hybrid" || basemapId === "hoi4" || basemapId === "provinces" || basemapId === "detailed_province_world" || basemapId === "world_states" || basemapId === "atlas_world",
          mapMode: "color",
          flagOpacity: 0.92,
          labelAtlas: true,
          fontScale: 1
        },
        window.MAP_STYLES.standard
      ),
      states: {},
      stateOrder: [],
      regions: {},
      groups: {},
      labels: [],
      featLabels: {},                               // featureId -> { dx, dy, angle, size, hidden } (per-region name overrides)
      years: [],
      snapshots: {},
      currentYear: null,
      // ---- manual geometry repairs (applied over the base dataset on load) ----
      regionGeomEdits: { removed: {}, features: {} },
      // ---- reference image backdrop for tracing (map-coordinate placement) ----
      backdrop: null,                               // { x, y, w, h, opacity, visible } — small, in undo slice
      backdropHref: null,                           // data URL — kept OUT of the undo slice (big)
      // ---- mid-level region layer model ----
      displayMode: "country",                       // country|province|culture|religion|language|...Region|terrain
      activeSelectionMode: "province",              // province | region
      activeRegionLayerId: hasRegions ? "state" : null,
      regionLayers: [],                             // user/custom layers (default "state" layer ensured at runtime)
      customRegions: {},                            // id -> MapRegion (user-created, full geometry)
      regionEdits: {},                              // imported regionId -> { name?, type?, color?, notes?, metadata? }
      // ---- named autonomous entities inside a country (own border + label) ----
      autonomies: {},                               // id -> { id, name, owner, color }
      // ---- reusable custom values for country fields (persist project-wide) ----
      valueLists: { ideology: [], government: [], religion: [], economy: [], culture: [], language: [] },
      // ---- named metadata dictionaries; values in states/regions stay plain text
      // so old projects remain compatible and a rename can safely update every use.
      catalogs: { culture: [], religion: [], language: [], government: [] }
    };
  }
  window.newProjectData = newProjectData;

  // migrate away region statuses that were removed from the model (they became
  // country-level concepts) so older saved projects load cleanly.
  const REMOVED_STATUS = { protectorate: 1, puppet: 1, integration: 1, neutral: 1 };
  function normalizeStatuses(p) {
    if (!p) return;
    const fix = (o) => { if (o && REMOVED_STATUS[o.status]) o.status = "core"; };
    for (const rid in (p.regions || {})) fix(p.regions[rid]);
    for (const gid in (p.groups || {})) fix(p.groups[gid]);
    // Older saved maps predate the shared language catalogue and the state-level
    // official-language field. Keep their data intact while bringing the schema
    // forward on load.
    p.valueLists = p.valueLists || {};
    ["ideology", "government", "religion", "economy", "culture", "language"].forEach((key) => {
      if (!Array.isArray(p.valueLists[key])) p.valueLists[key] = [];
    });
    p.catalogs = p.catalogs || {};
    ["culture", "religion", "language", "government"].forEach((key) => {
      if (!Array.isArray(p.catalogs[key])) p.catalogs[key] = [];
    });
    for (const sid in (p.states || {})) {
      if (p.states[sid].language == null) p.states[sid].language = "";
    }
  }
  window.normalizeStatuses = normalizeStatuses;

  // ---------- undo / redo ----------
  function politicalSlice(p) {
    return JSON.stringify({
      name: p.name, settings: p.settings, states: p.states, stateOrder: p.stateOrder,
      regions: p.regions, groups: p.groups || {}, labels: p.labels, featLabels: p.featLabels || {}, years: p.years, snapshots: p.snapshots, currentYear: p.currentYear,
      displayMode: p.displayMode, activeSelectionMode: p.activeSelectionMode, activeRegionLayerId: p.activeRegionLayerId,
      regionLayers: p.regionLayers || [], customRegions: p.customRegions || {}, regionEdits: p.regionEdits || {},
      regionGeomEdits: p.regionGeomEdits || { removed: {}, features: {} }, backdrop: p.backdrop || null,
      autonomies: p.autonomies || {}, valueLists: p.valueLists || {}, catalogs: p.catalogs || {}
    });
  }
  function applySlice(p, json) {
    const s = JSON.parse(json);
    Object.assign(p, s);
  }
  let strokeOpen = false;
  function pushUndo() {
    if (!App.project) return;
    if (strokeOpen) return; // grouped stroke: snapshot already taken
    App.undoStack.push(politicalSlice(App.project));
    if (App.undoStack.length > 60) App.undoStack.shift();
    App.redoStack.length = 0;
  }

  const Actions = (window.Actions = {});

  Actions.beginStroke = function () {
    if (!App.project || strokeOpen) return;
    App.undoStack.push(politicalSlice(App.project));
    if (App.undoStack.length > 60) App.undoStack.shift();
    App.redoStack.length = 0;
    strokeOpen = true;
  };
  Actions.endStroke = function () { strokeOpen = false; };

  // geometry edits live in the same undo slice; when they change across an
  // undo/redo step, the basemap must be rebuilt from the edited collection
  function geomKey(p) { return JSON.stringify(p.regionGeomEdits || null); }
  Actions.undo = function () {
    if (!App.undoStack.length || !App.project) return;
    const before = geomKey(App.project);
    App.redoStack.push(politicalSlice(App.project));
    applySlice(App.project, App.undoStack.pop());
    App.terrVersion++; App.regionVersion++;
    scheduleSave(); App.emit();
    if (geomKey(App.project) !== before) { App.ui.selection = []; App.ui.geomEdit = null; window.Geo.load(App.project); }
  };
  Actions.redo = function () {
    if (!App.redoStack.length || !App.project) return;
    const before = geomKey(App.project);
    App.undoStack.push(politicalSlice(App.project));
    applySlice(App.project, App.redoStack.pop());
    App.terrVersion++; App.regionVersion++;
    scheduleSave(); App.emit();
    if (geomKey(App.project) !== before) { App.ui.selection = []; App.ui.geomEdit = null; window.Geo.load(App.project); }
  };

  // ---------- persistence ----------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!App.project) return;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(App.project));
      } catch (e) {
        Actions.toast(t("toast.storage"));
      }
    }, 700);
  }
  window.scheduleSave = scheduleSave;

  function saveUiPrefs() {
    try {
      localStorage.setItem(LS_UI, JSON.stringify({ lang: App.ui.lang, theme: App.ui.theme, propsWidth: App.ui.propsWidth }));
    } catch (e) {}
  }

  // ---------- generic mutators ----------
  Actions.ui = function (patch) {
    Object.assign(App.ui, patch);
    App.emit();
  };
  Actions.mut = function (fn, opts = {}) {
    if (!App.project) return;
    if (opts.undo !== false) pushUndo();
    fn(App.project);
    if (opts.terr) App.terrVersion++;
    if (opts.region) App.regionVersion++;
    scheduleSave();
    App.emit();
  };

  // ---------- toasts ----------
  let toastTimer = null;
  Actions.toast = function (msg) {
    App.ui.toast = msg;
    App.emit();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { App.ui.toast = null; App.emit(); }, 2600);
  };

  // ---------- states ----------
  Actions.addState = function (name) {
    let id = null;
    Actions.mut((p) => {
      id = uid();
      const i = p.stateOrder.length;
      p.states[id] = {
        id,
        name: name || (App.ui.lang === "ru" ? "Государство " + (i + 1) : "State " + (i + 1)),
        color: nextAutoColor(),
        flag: null,
        capital: "", capitalRegion: null, gov: "", ideology: "", religion: "", culture: "", language: "",
        population: "", economy: "", army: "", notes: "",
        vassalOf: null,
        labelOffset: null
      };
      p.stateOrder.push(id);
    });
    App.ui.activeState = id;
    App.ui.panel = "state";
    App.emit();
    return id;
  };

  Actions.setState = function (sid, patch, opts) {
    Actions.mut((p) => { if (p.states[sid]) Object.assign(p.states[sid], patch); }, opts);
  };

  Actions.deleteState = function (sid) {
    Actions.mut((p) => {
      delete p.states[sid];
      p.stateOrder = p.stateOrder.filter((x) => x !== sid);
      for (const rid in p.regions) {
        if (p.regions[rid].owner === sid) {
          p.regions[rid].owner = null;
          cleanupRegion(p, rid);
        }
      }
      for (const gid in p.groups || {}) {
        if (p.groups[gid].owner === sid) p.groups[gid].owner = null;
      }
    }, { terr: true });
    if (App.ui.activeState === sid) { App.ui.activeState = null; App.emit(); }
  };

  // ---------- regions ----------
  function regionEntry(p, rid) {
    if (!p.regions[rid]) p.regions[rid] = { owner: null, status: "core", color: null, name: null, population: "", culture: "", religion: "", language: "", notes: "" };
    return p.regions[rid];
  }
  function cleanupRegion(p, rid) {
    const r = p.regions[rid];
    if (!r) return;
    const empty = !r.owner && !r.color && !r.name && !r.group && !r.autonomyId && r.status === "core" &&
      !r.population && !r.culture && !r.religion && !r.language && !r.notes;
    if (empty) delete p.regions[rid];
  }
  window.regionEntry = regionEntry;

  // ---------- reusable culture / religion / language / government dictionaries ----------
  const CATALOG_FIELDS = ["culture", "religion", "language", "government"];
  const STATE_CATALOG_FIELD = { government: "gov", culture: "culture", religion: "religion", language: "language" };
  const STATE_META_FIELDS = ["culture", "religion", "language"]; // flow from a country to its provinces
  function normMeta(v) { return (v || "").trim(); }
  // where a value is used: country records, province / group / region-layer
  // records, and whether the base dataset itself carries it (undeletable).
  function metadataUsage(p, field, name) {
    name = normMeta(name);
    const sf = STATE_CATALOG_FIELD[field];
    let states = 0, regions = 0;
    if (sf) Object.keys(p.states || {}).forEach((sid) => { if (normMeta(p.states[sid][sf]) === name) states++; });
    if (field !== "government") {
      Object.keys(p.regions || {}).forEach((rid) => { if (normMeta(p.regions[rid][field]) === name) regions++; });
      Object.keys(p.groups || {}).forEach((gid) => { if (normMeta(p.groups[gid][field]) === name) regions++; });
      Object.keys(p.customRegions || {}).forEach((id) => { if (normMeta((p.customRegions[id].metadata || {})[field]) === name) regions++; });
      Object.keys(p.regionEdits || {}).forEach((id) => { if (normMeta(((p.regionEdits[id] || {}).metadata || {})[field]) === name) regions++; });
    }
    let dataset = false;
    if (field === "culture") dataset = (App.basemap.features || []).some((f) => normMeta(f.cultArea) === name);
    if (!dataset && field !== "government") {
      dataset = (App.regionData.regions || []).some((r) => normMeta((r.metadata || {})[field]) === name &&
        !(p.regionEdits && p.regionEdits[r.id] && normMeta((p.regionEdits[r.id].metadata || {})[field]) === name));
    }
    return { states, regions, dataset };
  }
  function metadataValue(p, field, record, feat) {
    const own = record && normMeta(record[field]);
    // Dataset cultural areas are useful defaults until the user assigns a value.
    if (own) return own;
    return field === "culture" && feat ? normMeta(feat.cultArea) : "";
  }
  function catalogEntry(p, field, name) {
    name = normMeta(name);
    return ((p.catalogs && p.catalogs[field]) || []).find((e) => normMeta(e.name) === name) || null;
  }
  let catalogValueCacheVersion = -1;
  let catalogValueCache = {};
  function metadataColor(p, field, name) {
    const e = catalogEntry(p, field, name);
    if (e && /^#[0-9a-f]{6}$/i.test(e.color || "")) return e.color;
    let h = 2166136261;
    const s = field + ":" + name;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h >>>= 0;
    return ColorUtil.hslToHex(h % 360, 42 + ((h >>> 9) % 16), 45 + ((h >>> 17) % 17));
  }
  function catalogValues(p, field) {
    if (catalogValueCacheVersion !== App.version) {
      catalogValueCacheVersion = App.version;
      catalogValueCache = {};
    }
    if (catalogValueCache[field]) return catalogValueCache[field];
    const values = new Set();
    const add = (v) => { v = normMeta(v); if (v) values.add(v); };
    ((p.catalogs && p.catalogs[field]) || []).forEach((e) => add(e.name));
    ((p.valueLists && p.valueLists[field]) || []).forEach(add);
    const sf = STATE_CATALOG_FIELD[field];
    if (sf) Object.keys(p.states || {}).forEach((sid) => add(p.states[sid][sf]));
    if (field !== "government") {
      Object.keys(p.regions || {}).forEach((rid) => add(p.regions[rid][field]));
      Object.keys(p.groups || {}).forEach((gid) => add(p.groups[gid][field]));
      Object.keys(p.customRegions || {}).forEach((id) => add((p.customRegions[id].metadata || {})[field]));
      Object.keys(p.regionEdits || {}).forEach((id) => add(((p.regionEdits[id] || {}).metadata || {})[field]));
      (App.regionData.regions || []).forEach((r) => add((r.metadata || {})[field]));
      if (field === "culture") (App.basemap.features || []).forEach((f) => add(f.cultArea));
    }
    const result = [...values].sort((a, b) => a.localeCompare(b));
    catalogValueCache[field] = result;
    return result;
  }
  // legend rows for a metadata display mode: every value on the map with its
  // province count and colour (shared by the on-screen legend and PNG export)
  function metadataLegend(p, field) {
    const found = new Map();
    (App.basemap.features || []).forEach((f) => {
      const value = metadataValue(p, field, window.effRegion(p, f.id), f);
      if (value) found.set(value, (found.get(value) || 0) + 1);
    });
    return [...found].map(([name, count]) => ({ name, count, color: metadataColor(p, field, name) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
  // suggested colour from an entry's parents: a mixed culture blends both, a
  // split-off one is a recognisable variation of its single parent
  function metadataParentColor(p, field, entry) {
    if (!entry) return null;
    const c1 = entry.parent ? metadataColor(p, field, entry.parent) : null;
    const c2 = entry.parent2 ? metadataColor(p, field, entry.parent2) : null;
    if (entry.kind === "mixed" && c1 && c2) return ColorUtil.mixHex(c1, c2, 0.5);
    if (c1) {
      const seed = metadataColor({ catalogs: {} }, field, entry.name || "x"); // hash colour of the name
      return ColorUtil.mixHex(c1, seed, 0.3);
    }
    return null;
  }
  window.Metadata = { fields: CATALOG_FIELDS, stateField: STATE_CATALOG_FIELD, value: metadataValue, color: metadataColor, entry: catalogEntry, values: catalogValues, usage: metadataUsage, legend: metadataLegend, parentColor: metadataParentColor };

  // effective data for a region: its merge-group entry (if any) wins
  window.effRegion = function (p, rid) {
    const r = p.regions[rid];
    if (r && r.group && p.groups && p.groups[r.group]) return p.groups[r.group];
    return r;
  };

  Actions.assign = function (rids, owner, opts = {}) {
    Actions.mut((p) => {
      const gids = new Set();
      // a province joining a country picks up its culture / religion / language
      // unless it already has its own value
      const st = owner ? p.states[owner] : null;
      const inherit = (rec) => {
        if (!st) return;
        STATE_META_FIELDS.forEach((f) => { if (normMeta(st[f]) && !normMeta(rec[f])) rec[f] = normMeta(st[f]); });
      };
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { gids.add(r0.group); return; }
        const r = regionEntry(p, rid);
        r.owner = owner;
        if (!owner) { r.status = "core"; r.autonomyId = null; }
        inherit(r);
        cleanupRegion(p, rid);
      });
      gids.forEach((gid) => {
        p.groups[gid].owner = owner;
        if (!owner) { p.groups[gid].status = "core"; p.groups[gid].autonomyId = null; }
        inherit(p.groups[gid]);
      });
      if (!owner) pruneAutonomies(p);
    }, Object.assign({ terr: true }, opts));
  };

  Actions.setRegion = function (rids, patch, opts) {
    Actions.mut((p) => {
      // leaving "autonomy" status detaches the region from its autonomy entity
      // so its outline/label stop covering it (and empty autonomies are pruned).
      const leaveAuto = patch.status && patch.status !== "autonomy";
      const gids = new Set();
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { gids.add(r0.group); return; }
        const r = regionEntry(p, rid);
        Object.assign(r, patch);
        if (leaveAuto) r.autonomyId = null;
        cleanupRegion(p, rid);
      });
      gids.forEach((gid) => { Object.assign(p.groups[gid], patch); if (leaveAuto) p.groups[gid].autonomyId = null; });
      if (leaveAuto) pruneAutonomies(p);
    }, opts);
  };

  Actions.selectByMetadata = function (field, value) {
    const p = App.project;
    const rids = [];
    App.basemap.features.forEach((f) => {
      if (metadataValue(p, field, window.effRegion(p, f.id), f) === value) rids.push(f.id);
    });
    Actions.select(rids, false);
  };

  // ---------- merge groups (custom geographic / cultural regions) ----------
  Actions.groupRegions = function (rids, name) {
    let gid = null;
    Actions.mut((p) => {
      p.groups = p.groups || {};
      gid = uid();
      rids.forEach((rid) => {
        const r = p.regions[rid];
        if (r && r.group && p.groups[r.group]) {
          const og = p.groups[r.group];
          og.members = og.members.filter((m) => m !== rid);
          if (!og.members.length) delete p.groups[r.group];
        }
      });
      let owner = null;
      for (const rid of rids) {
        const r = p.regions[rid];
        const e = r && r.group && p.groups[r.group] ? p.groups[r.group] : r;
        if (e && e.owner) { owner = e.owner; break; }
      }
      p.groups[gid] = {
        id: gid,
        name: name || (App.ui.lang === "ru" ? "Новый регион" : "New region"),
        members: rids.slice(), owner, status: "core", color: null,
        population: "", culture: "", language: "", religion: "", notes: ""
      };
      rids.forEach((rid) => { regionEntry(p, rid).group = gid; });
    }, { terr: true });
    return gid;
  };

  // ---------- named autonomies (a subset of a country's regions, own border + label) ----------
  function pluralOwner(p, rids) {
    const counts = {}; let best = null, bn = 0;
    rids.forEach((rid) => {
      const e = window.effRegion(p, rid); const o = e && e.owner;
      if (!o) return; counts[o] = (counts[o] || 0) + 1;
      if (counts[o] > bn) { bn = counts[o]; best = o; }
    });
    return best;
  }
  // drop autonomy entries no region/group still points at (keeps the picker clean
  // and the outline/label from lingering after members leave the autonomy).
  function pruneAutonomies(p) {
    if (!p.autonomies) return;
    const used = new Set();
    for (const rid in p.regions) { const a = p.regions[rid].autonomyId; if (a) used.add(a); }
    for (const gid in (p.groups || {})) { const a = p.groups[gid].autonomyId; if (a) used.add(a); }
    for (const id in p.autonomies) if (!used.has(id)) delete p.autonomies[id];
  }
  window.pruneAutonomies = pruneAutonomies;
  Actions.createAutonomy = function (rids, name) {
    let id = null;
    Actions.mut((p) => {
      p.autonomies = p.autonomies || {};
      id = uid();
      const owner = pluralOwner(p, rids);
      p.autonomies[id] = {
        id, owner,
        name: name || (App.ui.lang === "ru" ? "Автономия" : "Autonomy"),
        color: owner && p.states[owner] ? ColorUtil.lighten(p.states[owner].color, 0.45) : "#c8c8c8"
      };
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { p.groups[r0.group].autonomyId = id; return; }
        regionEntry(p, rid).autonomyId = id;
      });
    }, { terr: true });
    return id;
  };
  Actions.setRegionAutonomy = function (rids, autonomyId, opts) {
    Actions.mut((p) => {
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { p.groups[r0.group].autonomyId = autonomyId || null; return; }
        const r = regionEntry(p, rid); r.autonomyId = autonomyId || null; cleanupRegion(p, rid);
      });
      pruneAutonomies(p);
    }, Object.assign({ terr: true }, opts));
  };
  Actions.setAutonomy = function (id, patch, opts) {
    Actions.mut((p) => { if (p.autonomies && p.autonomies[id]) Object.assign(p.autonomies[id], patch); }, opts);
  };
  Actions.deleteAutonomy = function (id) {
    Actions.mut((p) => {
      if (p.autonomies) delete p.autonomies[id];
      for (const rid in p.regions) if (p.regions[rid].autonomyId === id) { p.regions[rid].autonomyId = null; cleanupRegion(p, rid); }
      for (const gid in (p.groups || {})) if (p.groups[gid].autonomyId === id) p.groups[gid].autonomyId = null;
    }, { terr: true });
  };

  Actions.ungroup = function (gid) {
    Actions.mut((p) => {
      const g = (p.groups || {})[gid];
      if (!g) return;
      g.members.forEach((rid) => {
        const r = p.regions[rid];
        if (r) {
          r.group = null;
          r.owner = g.owner;
          r.status = g.status;
          cleanupRegion(p, rid);
        }
      });
      delete p.groups[gid];
    }, { terr: true });
  };

  Actions.setGroup = function (gid, patch, opts) {
    Actions.mut((p) => {
      const g = (p.groups || {})[gid];
      if (g) Object.assign(g, patch);
    }, Object.assign({ terr: patch.owner !== undefined }, opts || {}));
  };

  // ---------- labels ----------
  Actions.addLabel = function (x, y) {
    let id = null;
    Actions.mut((p) => {
      id = uid();
      p.labels.push({ id, text: App.ui.lang === "ru" ? "Подпись" : "Label", x, y, size: 18, color: p.settings.labelColor, bold: false });
    });
    return id;
  };
  Actions.setLabel = function (id, patch, opts) {
    Actions.mut((p) => {
      const l = p.labels.find((l) => l.id === id);
      if (l) Object.assign(l, patch);
    }, opts);
  };
  Actions.deleteLabel = function (id) {
    Actions.mut((p) => { p.labels = p.labels.filter((l) => l.id !== id); });
  };

  // ---------- per-region name label overrides (move / rotate / size / hide) ----------
  Actions.setFeatLabel = function (id, patch, opts) {
    Actions.mut((p) => {
      if (!p.featLabels) p.featLabels = {};
      const cur = Object.assign({}, p.featLabels[id], patch);
      // drop keys that are back to default so the store stays sparse
      for (const k of Object.keys(cur)) if (cur[k] == null) delete cur[k];
      if (Object.keys(cur).length) p.featLabels[id] = cur; else delete p.featLabels[id];
    }, opts);
  };
  Actions.clearFeatLabel = function (id) {
    Actions.mut((p) => { if (p.featLabels) delete p.featLabels[id]; });
  };

  // ---------- settings / style ----------
  Actions.applyStyle = function (styleName) {
    Actions.mut((p) => {
      Object.assign(p.settings, window.MAP_STYLES[styleName] || {}, { style: styleName });
    });
  };
  Actions.setSettings = function (patch, opts) {
    Actions.mut((p) => Object.assign(p.settings, patch), opts);
  };
  // remember a custom country-field value (ideology/government/…) project-wide so
  // it becomes a reusable dropdown suggestion and isn't retyped every time.
  Actions.rememberValue = function (listKey, val) {
    val = (val || "").trim();
    if (!val) return;
    Actions.mut((p) => {
      p.valueLists = p.valueLists || {};
      const arr = (p.valueLists[listKey] = p.valueLists[listKey] || []);
      if (!arr.includes(val)) arr.push(val);
      if (CATALOG_FIELDS.includes(listKey)) {
        p.catalogs = p.catalogs || {};
        const list = (p.catalogs[listKey] = p.catalogs[listKey] || []);
        if (!list.some((e) => normMeta(e.name) === val)) list.push({ name: val, color: null, parent: "", description: "" });
      }
    }, { undo: false });
  };

  // Replace every use of a catalog value in one project (or snapshot) record set.
  function rewriteMetaValue(target, field, old, next) {
    const sf = STATE_CATALOG_FIELD[field];
    if (sf) Object.keys(target.states || {}).forEach((sid) => { if (target.states[sid][sf] === old) target.states[sid][sf] = next; });
    if (field !== "government") {
      Object.keys(target.regions || {}).forEach((rid) => { if (target.regions[rid][field] === old) target.regions[rid][field] = next; });
      Object.keys(target.groups || {}).forEach((gid) => { if (target.groups[gid][field] === old) target.groups[gid][field] = next; });
      Object.keys(target.customRegions || {}).forEach((id) => {
        const meta = target.customRegions[id].metadata || {};
        if (meta[field] === old) meta[field] = next;
      });
      Object.keys(target.regionEdits || {}).forEach((id) => {
        const meta = (target.regionEdits[id] || {}).metadata || {};
        if (meta[field] === old) meta[field] = next;
      });
    }
  }

  // Rename is intentionally global: current map, country records, merged regions,
  // remembered suggestions and every timeline snapshot move together.
  Actions.saveCatalogEntry = function (field, oldName, patch) {
    if (!CATALOG_FIELDS.includes(field)) return;
    const name = normMeta(patch && patch.name);
    if (!name) return;
    Actions.mut((p) => {
      p.catalogs = p.catalogs || {};
      let entries = (p.catalogs[field] = p.catalogs[field] || []);
      const old = normMeta(oldName);
      let entry = entries.find((e) => normMeta(e.name) === old) || entries.find((e) => normMeta(e.name) === name);
      if (!entry) { entry = { name, color: null, parent: "", description: "" }; entries.push(entry); }
      if (old && old !== name) {
        rewriteMetaValue(p, field, old, name);
        Object.keys(p.snapshots || {}).forEach((year) => rewriteMetaValue(p.snapshots[year], field, old, name));
        const vals = (p.valueLists && p.valueLists[field]) || [];
        p.valueLists[field] = [...new Set(vals.map((v) => v === old ? name : v))];
        entries.forEach((e) => { if (e.parent === old) e.parent = name; if (e.parent2 === old) e.parent2 = name; });
        entries = entries.filter((e) => e === entry || normMeta(e.name) !== name);
        p.catalogs[field] = entries;
      }
      // kind: "" plain | "derived" (one parent, split off) | "mixed" (two parents)
      const kind = patch.kind === "mixed" || patch.kind === "derived" ? patch.kind : "";
      Object.assign(entry, { name, color: patch.color || null, parent: patch.parent || "", parent2: kind === "mixed" ? (patch.parent2 || "") : "",
        kind, description: patch.description || "" });
      const values = (p.valueLists[field] = p.valueLists[field] || []);
      if (!values.includes(name)) values.push(name);
    });
  };

  // Deleting a value clears it everywhere it is used (and in every snapshot);
  // children lose their parent link. Dataset defaults (feat.cultArea) survive.
  Actions.deleteCatalogEntry = function (field, name) {
    if (!CATALOG_FIELDS.includes(field)) return;
    name = normMeta(name);
    if (!name) return;
    Actions.mut((p) => {
      p.catalogs = p.catalogs || {};
      p.catalogs[field] = (p.catalogs[field] || []).filter((e) => normMeta(e.name) !== name);
      p.catalogs[field].forEach((e) => { if (normMeta(e.parent) === name) e.parent = ""; if (normMeta(e.parent2) === name) e.parent2 = ""; });
      if (p.valueLists && p.valueLists[field]) p.valueLists[field] = p.valueLists[field].filter((v) => normMeta(v) !== name);
      rewriteMetaValue(p, field, name, "");
      Object.keys(p.snapshots || {}).forEach((year) => rewriteMetaValue(p.snapshots[year], field, name, ""));
      Object.keys(p.regions || {}).forEach((rid) => cleanupRegion(p, rid));
    }, { region: true });
  };

  // Merge `from` into `into`: every use is rewritten (snapshots too), children
  // of `from` re-parent to `into`, and the `from` entry disappears.
  Actions.mergeCatalogEntry = function (field, from, into) {
    if (!CATALOG_FIELDS.includes(field)) return;
    from = normMeta(from); into = normMeta(into);
    if (!from || !into || from === into) return;
    Actions.mut((p) => {
      p.catalogs = p.catalogs || {};
      const entries = (p.catalogs[field] = p.catalogs[field] || []);
      if (!entries.some((e) => normMeta(e.name) === into)) entries.push({ name: into, color: null, parent: "", parent2: "", kind: "", description: "" });
      p.catalogs[field] = entries.filter((e) => normMeta(e.name) !== from);
      p.catalogs[field].forEach((e) => {
        if (normMeta(e.parent) === from) e.parent = normMeta(e.name) === into ? "" : into;
        if (normMeta(e.parent2) === from) e.parent2 = normMeta(e.name) === into ? "" : into;
        if (e.parent2 && normMeta(e.parent2) === normMeta(e.parent)) { e.parent2 = ""; if (e.kind === "mixed") e.kind = "derived"; } // both parents collapsed into one
      });
      p.valueLists = p.valueLists || {};
      p.valueLists[field] = [...new Set(((p.valueLists[field] || []).filter((v) => normMeta(v) !== from)).concat([into]))];
      rewriteMetaValue(p, field, from, into);
      Object.keys(p.snapshots || {}).forEach((year) => rewriteMetaValue(p.snapshots[year], field, from, into));
    }, { region: true });
  };

  // Put the owner's culture / religion / language back on the selected provinces
  Actions.resetRegionMetaToState = function (rids) {
    let n = 0;
    Actions.mut((p) => {
      const done = new Set();
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        const rec = r0 && r0.group && p.groups && p.groups[r0.group] ? p.groups[r0.group] : r0;
        if (!rec || !rec.owner || done.has(rec)) return;
        done.add(rec);
        const st = p.states[rec.owner];
        if (!st) return;
        let changed = false;
        STATE_META_FIELDS.forEach((f) => { const v = normMeta(st[f]); if (v && normMeta(rec[f]) !== v) { rec[f] = v; changed = true; } });
        if (changed) n++;
      });
    });
    return n;
  };

  // Country-level culture / religion / language flow down to the provinces it
  // owns: provinces still carrying the previous country value (or none) follow
  // the change, hand-set ones keep theirs. `force` overwrites every province.
  Actions.setStateMeta = function (sid, field, value, opts = {}) {
    if (!STATE_META_FIELDS.includes(field)) return 0;
    value = normMeta(value);
    let n = 0;
    Actions.mut((p) => {
      const s = p.states[sid];
      if (!s) return;
      const old = normMeta(s[field]);
      s[field] = value;
      const follow = (rec) => {
        if (!rec || rec.owner !== sid) return false;
        const cur = normMeta(rec[field]);
        if (!opts.force && cur && cur !== old) return false;
        if (cur === value) return false;
        rec[field] = value;
        return true;
      };
      Object.keys(p.regions).forEach((rid) => {
        const r = p.regions[rid];
        if (r.group) return;
        if (follow(r)) { n++; cleanupRegion(p, rid); }
      });
      Object.keys(p.groups || {}).forEach((gid) => { if (follow(p.groups[gid])) n++; });
    });
    return n;
  };

  // ---------- reference image backdrop (for tracing) ----------
  Actions.setBackdrop = function (patch, opts) {
    Actions.mut((p) => { if (p.backdrop) Object.assign(p.backdrop, patch); }, Object.assign({ undo: false }, opts));
  };
  Actions.removeBackdrop = function () {
    Actions.mut((p) => { p.backdrop = null; p.backdropHref = null; });
  };
  Actions.loadBackdropImage = function (file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // fit the image inside the map frame, preserving aspect ratio, centred
        const W = window.MAP_W, H = window.MAP_H;
        const ar = img.width / img.height || 1;
        let w = W, h = W / ar;
        if (h > H) { h = H; w = H * ar; }
        // downscale very large images to keep the project JSON reasonable
        let href = reader.result;
        if (img.width > 2200) {
          const k = 2200 / img.width;
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          try { href = cv.toDataURL("image/jpeg", 0.82); } catch (e) {}
        }
        Actions.mut((p) => {
          p.backdropHref = href;
          p.backdrop = { x: (W - w) / 2, y: (H - h) / 2, w, h, opacity: 0.55, visible: true };
        });
        Actions.toast(t("backdrop.loaded"));
      };
      img.onerror = () => Actions.toast(t("toast.importError"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // ---------- timeline ----------
  function snapOf(p) {
    return JSON.parse(JSON.stringify({ states: p.states, stateOrder: p.stateOrder, regions: p.regions, groups: p.groups || {}, labels: p.labels }));
  }
  Actions.addYear = function (year) {
    Actions.mut((p) => {
      if (!p.years.includes(year)) {
        p.years.push(year);
        p.years.sort((a, b) => a - b);
      }
      p.snapshots[year] = snapOf(p);
      p.currentYear = year;
    });
  };
  Actions.gotoYear = function (year) {
    Actions.mut((p) => {
      if (p.currentYear != null && p.snapshots[p.currentYear]) p.snapshots[p.currentYear] = snapOf(p);
      const s = p.snapshots[year];
      if (s) {
        p.states = JSON.parse(JSON.stringify(s.states));
        p.stateOrder = s.stateOrder.slice();
        p.regions = JSON.parse(JSON.stringify(s.regions));
        p.groups = s.groups ? JSON.parse(JSON.stringify(s.groups)) : {};
        p.labels = JSON.parse(JSON.stringify(s.labels));
      }
      p.currentYear = year;
    }, { terr: true });
    App.ui.selection = [];
    App.emit();
  };
  Actions.deleteYear = function (year) {
    Actions.mut((p) => {
      p.years = p.years.filter((y) => y !== year);
      delete p.snapshots[year];
      if (p.currentYear === year) p.currentYear = p.years[0] ?? null;
    });
  };

  // ---------- selection helpers ----------
  function expandSelection(rids) {
    const p = App.project;
    if (!p || !p.groups) return rids;
    const out = new Set();
    rids.forEach((rid) => {
      const r = p.regions[rid];
      if (r && r.group && p.groups[r.group]) p.groups[r.group].members.forEach((m) => out.add(m));
      else out.add(rid);
    });
    return [...out];
  }
  Actions.select = function (rids, additive) {
    rids = expandSelection(rids);
    if (additive) {
      const set = new Set(App.ui.selection);
      rids.forEach((r) => (set.has(r) ? set.delete(r) : set.add(r)));
      App.ui.selection = [...set];
    } else {
      App.ui.selection = rids;
    }
    if (App.ui.selection.length) App.ui.panel = "region";
    App.emit();
  };

  Actions.selectByOwner = function (owner) {
    const p = App.project;
    const rids = [];
    if (owner) {
      for (const rid in p.regions) if ((window.effRegion(p, rid) || {}).owner === owner) rids.push(rid);
    } else {
      App.basemap.features.forEach((f) => { const e = window.effRegion(p, f.id); if (!e || !e.owner) rids.push(f.id); });
    }
    Actions.select(rids, false);
  };

  // ---------- bootstrap ----------
  Actions.newProject = function (basemapId, opts = {}) {
    App.project = newProjectData(basemapId);
    if (opts.customGeo) {
      // give every imported feature a stable id so geometry edits key off it
      try {
        (opts.customGeo.features || []).forEach((f, i) => {
          const p = f.properties || (f.properties = {});
          const id = String((f.id != null ? f.id : (p.id != null ? p.id : "")) || ("c" + (i + 1)));
          f.id = id; p.id = id;
        });
      } catch (e) {}
      App.project.customGeo = opts.customGeo;
    }
    App.undoStack.length = 0;
    App.redoStack.length = 0;
    App.ui.selection = [];
    App.ui.regionSelection = [];
    App.ui.selectMode = "province";
    App.ui.activeState = null;
    App.ui.modal = null;
    App.regionData = { status: "idle", regions: [], byId: {}, provinceToRegion: {} };
    App.physical = { status: "idle", rivers: [], lakes: [], relief: [], seas: [] };
    App.emit();
    scheduleSave();
    window.Geo.load(App.project).then(() => {
      if (opts.groupByCountry) Actions.groupByCountry();
      if (window.MapAPI) window.MapAPI.fit();
    });
  };

  Actions.groupByCountry = function () {
    const feats = App.basemap.features;
    const byCountry = {};
    feats.forEach((f) => {
      const c = f.country || f.name;
      if (!c) return;
      (byCountry[c] = byCountry[c] || []).push(f.id);
    });
    const names = Object.keys(byCountry).sort();
    Actions.mut((p) => {
      names.forEach((n, i) => {
        const id = uid();
        p.states[id] = {
          id, name: n, color: nextAutoColor(i), flag: null,
          capital: "", capitalRegion: null, gov: "", ideology: "", religion: "", culture: "", language: "",
          population: "", economy: "", army: "", notes: "", vassalOf: null, labelOffset: null
        };
        p.stateOrder.push(id);
        byCountry[n].forEach((rid) => { regionEntry(p, rid).owner = id; });
      });
    }, { undo: false });
    App.undoStack.length = 0;
  };

  Actions.loadSaved = function () {
    try {
      const ui = JSON.parse(localStorage.getItem(LS_UI) || "null");
      if (ui) Object.assign(App.ui, { lang: ui.lang || "ru", theme: ui.theme || "dark",
        propsWidth: Math.max(240, Math.min(600, +ui.propsWidth || 320)) });
    } catch (e) {}
    let p = null;
    try { p = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
    if (p && p.basemapId) {
      App.project = Object.assign(newProjectData(p.basemapId), p);
      normalizeStatuses(App.project);
      App.emit();
      window.Geo.load(App.project);
    } else {
      App.ui.modal = "templates";
      App.emit();
    }
  };

  Actions.setLang = function (lang) { App.ui.lang = lang; saveUiPrefs(); App.emit(); };
  Actions.setTheme = function (theme) { App.ui.theme = theme; saveUiPrefs(); App.emit(); };
  Actions.setPropsWidth = function (w) {
    App.ui.propsWidth = Math.max(240, Math.min(600, Math.round(+w || 320)));
    saveUiPrefs(); App.emit();
  };

  // ---------- derived stats ----------
  window.stateStats = function () {
    const p = App.project;
    const counts = {};
    if (!p) return counts;
    for (const rid in p.regions) {
      const e = window.effRegion(p, rid);
      const o = e ? e.owner : null;
      if (o) counts[o] = (counts[o] || 0) + 1;
    }
    return counts;
  };
})();
