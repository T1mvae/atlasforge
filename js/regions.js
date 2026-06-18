// AtlasForge — mid-level region layer: model, layers, region tools
// Provinces stay the detailed base layer (App.basemap). The regular HOI4-style
// state regions are loaded on top as the default "state" region layer. Users can
// build further historical / cultural / geographical / political / custom region
// layers over the SAME province grid. Strategic regions are never involved.
(function () {
  const App = window.App;
  const Actions = window.Actions;
  const uid = window.uid;

  const REGION_TYPES = ["state", "historical", "cultural", "geographical", "political", "administrative", "custom"];

  // display mode -> region layer type it visualises
  const MODE_TYPE = {
    stateRegion: "state",
    historicalRegion: "historical",
    culturalRegion: "cultural",
    geographicalRegion: "geographical",
    politicalRegion: "political"
  };

  // base hue per region type, used to tint regions that have no explicit color
  const TYPE_HUE = { state: 212, historical: 36, cultural: 140, geographical: 184, political: 280, administrative: 8, custom: 320 };

  function hashNum(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // distinct-but-on-theme color: hue spreads around the layer type's base hue so
  // neighbouring regions are distinguishable, while each layer type keeps its feel
  // (state = blue, cultural = green, …). Cartographic saturation/lightness, not neon.
  function autoRegionColor(type, id) {
    const baseH = TYPE_HUE[type] != null ? TYPE_HUE[type] : 320;
    const hsh = hashNum(String(id));
    const h = (baseH + ((hsh % 76) - 38) + 360) % 360;        // ±38° around the type hue
    const s = 34 + ((hsh >> 7) % 16);                          // 34–50%
    const l = 50 + ((hsh >> 11) % 16);                         // 50–66%
    return window.ColorUtil.hslToHex(h, s, l);
  }

  // ---------- model ----------
  const RegionModel = (window.RegionModel = {
    types: REGION_TYPES,
    modeType: MODE_TYPE,

    supportsRegions() {
      const p = App.project;
      if (!p) return false;
      const def = window.BASEMAPS[p.basemapId];
      return !!(def && def.supportsRegionLayers);
    },

    // ensure the builtin, locked default state layer exists once regions are loaded
    ensureStateLayer() {
      const p = App.project;
      if (!p) return;
      p.regionLayers = p.regionLayers || [];
      if (!p.regionLayers.some((l) => l.builtin)) {
        p.regionLayers.unshift({
          id: "state", name: window.t ? window.t("rlayer.state") : "Default State Regions",
          type: "state", builtin: true, locked: true, visible: true, regionIds: null
        });
      }
      if (!p.activeRegionLayerId) p.activeRegionLayerId = "state";
    },

    layers() {
      const p = App.project;
      return (p && p.regionLayers) || [];
    },
    layerById(id) {
      return RegionModel.layers().find((l) => l.id === id) || null;
    },
    activeLayer() {
      const p = App.project;
      if (!p) return null;
      return RegionModel.layerById(p.activeRegionLayerId) || RegionModel.layers()[0] || null;
    },

    // resolved MapRegion (imported region + user edits, or a custom region)
    resolve(id) {
      const p = App.project;
      if (!p) return null;
      if (p.customRegions && p.customRegions[id]) return p.customRegions[id];
      const base = App.regionData.byId[id];
      if (!base) return null;
      const ed = (p.regionEdits || {})[id];
      if (!ed) return base;
      return Object.assign({}, base, ed, { metadata: Object.assign({}, base.metadata, ed.metadata) });
    },

    // resolved regions belonging to a layer
    regionsOfLayer(layer) {
      if (!layer) return [];
      if (layer.builtin && layer.type === "state") {
        return (App.regionData.regions || []).map((r) => RegionModel.resolve(r.id)).filter(Boolean);
      }
      return (layer.regionIds || []).map((id) => RegionModel.resolve(id)).filter(Boolean);
    },

    // province feature ids of a region that actually exist on the base map
    provinceFeatureIds(region) {
      if (!region) return [];
      if (region.provinceFeatureIds) return region.provinceFeatureIds.filter((fid) => App.basemap.byId[fid]);
      return (region.provinceIds || []).map((pid) => "p" + pid).filter((fid) => App.basemap.byId[fid]);
    },

    provinceCount(region) {
      return RegionModel.provinceFeatureIds(region).length;
    },

    // localized display name: RU name when the UI is Russian, else the base name.
    // A user rename (editRegion sets both name and nameRu) wins in both languages.
    displayName(region) {
      if (!region) return "";
      if (App.ui.lang === "ru" && region.nameRu) return region.nameRu;
      return region.name;
    },

    // display fill for a region (explicit color, else a stable per-region tint)
    regionColor(region) {
      if (!region) return "#888888";
      if (region.color) return region.color;
      return autoRegionColor(region.type || "custom", region.id);
    },

    // is a region editable? (custom regions and regions in unlocked layers)
    isEditable(region) {
      if (!region) return false;
      return !region.builtin;
    }
  });

  // ---------- selection / mode ----------
  Actions.setSelectMode = function (mode) {
    App.ui.selectMode = mode;
    if (mode === "region" && !RegionModel.supportsRegions()) App.ui.selectMode = "province";
    App.emit();
  };
  Actions.setDisplayMode = function (mode) {
    Actions.mut((p) => {
      p.displayMode = mode;
      const wantType = MODE_TYPE[mode];
      if (wantType) {
        const layer = RegionModel.layers().find((l) => l.type === wantType);
        if (layer) p.activeRegionLayerId = layer.id;
      }
    }, { undo: false, region: true });
  };
  Actions.setActiveRegionLayer = function (id) {
    Actions.mut((p) => { p.activeRegionLayerId = id; }, { undo: false, region: true });
  };

  Actions.selectRegions = function (ids, additive) {
    if (additive) {
      const set = new Set(App.ui.regionSelection);
      ids.forEach((id) => (set.has(id) ? set.delete(id) : set.add(id)));
      App.ui.regionSelection = [...set];
    } else {
      App.ui.regionSelection = ids.slice();
    }
    if (App.ui.regionSelection.length) App.ui.panel = "region";
    App.emit();
  };
  Actions.clearRegionSelection = function () {
    App.ui.regionSelection = [];
    App.emit();
  };

  // gather province feature ids covered by a set of region ids
  function provincesOfRegions(regionIds) {
    const set = new Set();
    regionIds.forEach((rid) => {
      const r = RegionModel.resolve(rid);
      RegionModel.provinceFeatureIds(r).forEach((fid) => set.add(fid));
    });
    return [...set];
  }
  RegionModel.provincesOfRegions = provincesOfRegions;

  // ---------- assign regions to a country ----------
  Actions.assignRegions = function (regionIds, owner) {
    const prov = provincesOfRegions(regionIds);
    if (!prov.length) { Actions.toast(window.t("toast.regionNoProv")); return; }
    Actions.assign(prov, owner);
  };

  Actions.createCountryFromRegions = function (regionIds, name) {
    const prov = provincesOfRegions(regionIds);
    if (!prov.length) { Actions.toast(window.t("toast.regionNoProv")); return; }
    let label = name;
    if (!label) {
      const first = RegionModel.resolve(regionIds[0]);
      label = first ? RegionModel.displayName(first) : null;
    }
    const sid = Actions.addState(label);
    Actions.assign(prov, sid);
    return sid;
  };

  // ---------- create custom regions ----------
  function pickLayerForType(p, type) {
    // prefer the active layer if it is an editable layer of this type
    const active = RegionModel.layerById(p.activeRegionLayerId);
    if (active && !active.builtin && active.type === type) return active;
    let layer = (p.regionLayers || []).find((l) => !l.builtin && l.type === type);
    if (!layer) {
      layer = { id: "L" + uid(), name: window.t("rtype." + type), type, regionIds: [], visible: true, locked: false, builtin: false };
      p.regionLayers.push(layer);
    }
    return layer;
  }

  function makeRegion(geom, provinceFeatureIds, opts) {
    const id = "r" + uid();
    const nm = opts.name || window.t("region.untitled");
    return {
      id, regionId: id, name: nm, nameRu: nm,
      type: opts.type || "custom", builtin: false,
      d: geom.d, c: geom.c, b: geom.b, area: geom.area,
      provinceIds: provinceFeatureIds.map((fid) => +String(fid).replace(/^p/, "")),
      provinceFeatureIds: provinceFeatureIds.slice(),
      color: opts.color || null, notes: opts.notes || "",
      parentRegionId: opts.parentRegionId || null,
      metadata: opts.metadata || {}
    };
  }

  // from selected provinces (App.ui.selection)
  Actions.createRegionFromProvinces = function (provFeatureIds, opts = {}) {
    if (!provFeatureIds || !provFeatureIds.length) { Actions.toast(window.t("toast.noProvSel")); return; }
    const geom = window.Geo.buildRegionGeometry(provFeatureIds);
    if (!geom) { Actions.toast(window.t("toast.regionGeomFail")); return; }
    let newId = null;
    Actions.mut((p) => {
      const region = makeRegion(geom, provFeatureIds, opts);
      newId = region.id;
      p.customRegions[region.id] = region;
      const layer = pickLayerForType(p, region.type);
      layer.regionIds.push(region.id);
      p.activeRegionLayerId = layer.id;
    }, { region: true });
    App.ui.selectMode = "region";
    App.ui.selection = [];
    Actions.selectRegions([newId], false);
    return newId;
  };

  // from selected existing regions (union of their provinces)
  Actions.createRegionFromRegions = function (regionIds, opts = {}) {
    if (!regionIds || !regionIds.length) { Actions.toast(window.t("toast.noRegionSel")); return; }
    const prov = provincesOfRegions(regionIds);
    if (!prov.length) { Actions.toast(window.t("toast.regionNoProv")); return; }
    const geom = window.Geo.buildRegionGeometry(prov);
    if (!geom) { Actions.toast(window.t("toast.regionGeomFail")); return; }
    let newId = null;
    Actions.mut((p) => {
      const region = makeRegion(geom, prov, opts);
      newId = region.id;
      p.customRegions[region.id] = region;
      const layer = pickLayerForType(p, region.type);
      layer.regionIds.push(region.id);
      p.activeRegionLayerId = layer.id;
    }, { region: true });
    Actions.selectRegions([newId], false);
    return newId;
  };

  // ---------- edit regions ----------
  function editRegion(p, id, patch) {
    if (p.customRegions[id]) {
      Object.assign(p.customRegions[id], patch);
      if (patch.metadata) p.customRegions[id].metadata = Object.assign({}, p.customRegions[id].metadata, patch.metadata);
      return;
    }
    // imported region: store as an override diff so the base GeoJSON stays untouched
    p.regionEdits = p.regionEdits || {};
    const ed = p.regionEdits[id] || (p.regionEdits[id] = {});
    Object.assign(ed, patch);
    if (patch.metadata) ed.metadata = Object.assign({}, ed.metadata, patch.metadata);
  }
  Actions.editRegion = function (id, patch, opts) {
    Actions.mut((p) => editRegion(p, id, patch), Object.assign({ undo: false, region: true }, opts));
  };
  Actions.renameRegion = function (id, name) { Actions.editRegion(id, { name, nameRu: name }); };
  Actions.setRegionType = function (id, type) {
    Actions.mut((p) => {
      editRegion(p, id, { type });
      // move a custom region into a layer matching its new type
      if (p.customRegions[id]) {
        (p.regionLayers || []).forEach((l) => { if (!l.builtin && l.regionIds) l.regionIds = l.regionIds.filter((x) => x !== id); });
        const layer = pickLayerForType(p, type);
        if (!layer.regionIds.includes(id)) layer.regionIds.push(id);
      }
    }, { region: true });
  };
  Actions.setRegionColor = function (id, color) { Actions.editRegion(id, { color }); };
  Actions.setRegionNotes = function (id, notes) { Actions.editRegion(id, { notes }); };
  Actions.setRegionMeta = function (id, patch) { Actions.editRegion(id, { metadata: patch }); };

  Actions.deleteRegion = function (id) {
    Actions.mut((p) => {
      delete p.customRegions[id];
      (p.regionLayers || []).forEach((l) => { if (l.regionIds) l.regionIds = l.regionIds.filter((x) => x !== id); });
    }, { region: true });
    App.ui.regionSelection = App.ui.regionSelection.filter((x) => x !== id);
    App.emit();
  };

  // ---------- region layers ----------
  Actions.addRegionLayer = function (name, type) {
    let id = null;
    Actions.mut((p) => {
      id = "L" + uid();
      p.regionLayers.push({ id, name: name || window.t("rtype." + (type || "custom")), type: type || "custom", regionIds: [], visible: true, locked: false, builtin: false });
      p.activeRegionLayerId = id;
    }, { region: true });
    return id;
  };
  Actions.setRegionLayer = function (id, patch) {
    Actions.mut((p) => {
      const l = (p.regionLayers || []).find((x) => x.id === id);
      if (l && !l.builtin) Object.assign(l, patch);
      else if (l && l.builtin) { // builtin: only visibility / name are mutable
        if (patch.visible !== undefined) l.visible = patch.visible;
        if (patch.name !== undefined) l.name = patch.name;
      }
    }, { undo: false, region: true });
  };
  Actions.toggleLayerVisible = function (id) {
    const l = RegionModel.layerById(id);
    if (l) Actions.setRegionLayer(id, { visible: !l.visible });
  };
  Actions.toggleLayerLock = function (id) {
    const l = RegionModel.layerById(id);
    if (l && !l.builtin) Actions.setRegionLayer(id, { locked: !l.locked });
  };
  Actions.deleteRegionLayer = function (id) {
    const l = RegionModel.layerById(id);
    if (!l || l.builtin) { Actions.toast(window.t("toast.layerLocked")); return; }
    Actions.mut((p) => {
      (l.regionIds || []).forEach((rid) => { delete p.customRegions[rid]; });
      p.regionLayers = p.regionLayers.filter((x) => x.id !== id);
      if (p.activeRegionLayerId === id) p.activeRegionLayerId = (p.regionLayers[0] || {}).id || "state";
    }, { region: true });
    App.emit();
  };

  // duplicate a layer (e.g. the default state layer) into an editable copy
  Actions.duplicateLayer = function (layerId, name) {
    const src = RegionModel.layerById(layerId);
    if (!src) return null;
    const srcRegions = RegionModel.regionsOfLayer(src);
    let newLayerId = null;
    Actions.mut((p) => {
      newLayerId = "L" + uid();
      const ids = [];
      srcRegions.forEach((r) => {
        const nid = "r" + uid();
        p.customRegions[nid] = {
          id: nid, regionId: nid, name: r.name, nameRu: r.nameRu || null,
          type: r.type === "state" ? src.type : r.type,
          builtin: false, d: r.d, c: r.c ? r.c.slice() : null, b: r.b ? [r.b[0].slice(), r.b[1].slice()] : null, area: r.area,
          provinceIds: (r.provinceIds || []).slice(), provinceFeatureIds: (r.provinceFeatureIds || []).slice(),
          color: r.color || null, notes: r.notes || "", parentRegionId: null,
          metadata: Object.assign({}, r.metadata)
        };
        ids.push(nid);
      });
      p.regionLayers.push({ id: newLayerId, name: name || (src.name + " (copy)"), type: src.type, regionIds: ids, visible: true, locked: false, builtin: false });
      p.activeRegionLayerId = newLayerId;
    }, { region: true });
    return newLayerId;
  };

  // ---------- stats ----------
  // region ownership readout (most common owner of its provinces)
  RegionModel.regionOwner = function (region) {
    const p = App.project;
    if (!p) return null;
    const fids = RegionModel.provinceFeatureIds(region);
    const counts = {};
    let best = null, bestN = 0;
    fids.forEach((fid) => {
      const e = window.effRegion(p, fid);
      const o = e ? e.owner : null;
      if (!o) return;
      counts[o] = (counts[o] || 0) + 1;
      if (counts[o] > bestN) { bestN = counts[o]; best = o; }
    });
    return best;
  };
})();
