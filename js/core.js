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
      playing: false
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
      displayMode: "country",                       // country|province|stateRegion|historicalRegion|culturalRegion|geographicalRegion|politicalRegion|terrain
      activeSelectionMode: "province",              // province | region
      activeRegionLayerId: hasRegions ? "state" : null,
      regionLayers: [],                             // user/custom layers (default "state" layer ensured at runtime)
      customRegions: {},                            // id -> MapRegion (user-created, full geometry)
      regionEdits: {}                               // imported regionId -> { name?, type?, color?, notes?, metadata? }
    };
  }
  window.newProjectData = newProjectData;

  // ---------- undo / redo ----------
  function politicalSlice(p) {
    return JSON.stringify({
      name: p.name, settings: p.settings, states: p.states, stateOrder: p.stateOrder,
      regions: p.regions, groups: p.groups || {}, labels: p.labels, featLabels: p.featLabels || {}, years: p.years, snapshots: p.snapshots, currentYear: p.currentYear,
      displayMode: p.displayMode, activeSelectionMode: p.activeSelectionMode, activeRegionLayerId: p.activeRegionLayerId,
      regionLayers: p.regionLayers || [], customRegions: p.customRegions || {}, regionEdits: p.regionEdits || {},
      regionGeomEdits: p.regionGeomEdits || { removed: {}, features: {} }, backdrop: p.backdrop || null
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
      localStorage.setItem(LS_UI, JSON.stringify({ lang: App.ui.lang, theme: App.ui.theme }));
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
        capital: "", gov: "", ideology: "", religion: "", culture: "",
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
    const empty = !r.owner && !r.color && !r.name && !r.group && r.status === "core" &&
      !r.population && !r.culture && !r.religion && !r.language && !r.notes;
    if (empty) delete p.regions[rid];
  }
  window.regionEntry = regionEntry;

  // effective data for a region: its merge-group entry (if any) wins
  window.effRegion = function (p, rid) {
    const r = p.regions[rid];
    if (r && r.group && p.groups && p.groups[r.group]) return p.groups[r.group];
    return r;
  };

  Actions.assign = function (rids, owner, opts = {}) {
    Actions.mut((p) => {
      const gids = new Set();
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { gids.add(r0.group); return; }
        const r = regionEntry(p, rid);
        r.owner = owner;
        if (!owner) r.status = "core";
        cleanupRegion(p, rid);
      });
      gids.forEach((gid) => {
        p.groups[gid].owner = owner;
        if (!owner) p.groups[gid].status = "core";
      });
    }, Object.assign({ terr: true }, opts));
  };

  Actions.setRegion = function (rids, patch, opts) {
    Actions.mut((p) => {
      const gids = new Set();
      rids.forEach((rid) => {
        const r0 = p.regions[rid];
        if (r0 && r0.group && p.groups && p.groups[r0.group]) { gids.add(r0.group); return; }
        Object.assign(regionEntry(p, rid), patch);
        cleanupRegion(p, rid);
      });
      gids.forEach((gid) => Object.assign(p.groups[gid], patch));
    }, opts);
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
          capital: "", gov: "", ideology: "", religion: "", culture: "",
          population: "", economy: "", army: "", notes: "", labelOffset: null
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
      if (ui) Object.assign(App.ui, { lang: ui.lang || "ru", theme: ui.theme || "dark" });
    } catch (e) {}
    let p = null;
    try { p = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
    if (p && p.basemapId) {
      App.project = Object.assign(newProjectData(p.basemapId), p);
      App.emit();
      window.Geo.load(App.project);
    } else {
      App.ui.modal = "templates";
      App.emit();
    }
  };

  Actions.setLang = function (lang) { App.ui.lang = lang; saveUiPrefs(); App.emit(); };
  Actions.setTheme = function (theme) { App.ui.theme = theme; saveUiPrefs(); App.emit(); };

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
