// AtlasForge — project library in IndexedDB.
//
// localStorage (≈5 MB, one project) was the old autosave. The library keeps any
// number of projects: `projects` holds the full project object (structured clone —
// no JSON round-trip), `summaries` a small record per project for the library grid
// (name, map, dates, trash flag), `thumbs` a JPEG preview, `meta` the id of the
// project that was open last. Everything is keyed by the project id.
(function () {
  const DB_NAME = "atlasforge";
  const DB_VERSION = 1;
  const STORES = ["projects", "summaries", "thumbs", "meta"];

  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
        const rq = indexedDB.open(DB_NAME, DB_VERSION);
        rq.onupgradeneeded = () => {
          const d = rq.result;
          STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
        };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error);
        rq.onblocked = () => reject(new Error("IndexedDB blocked"));
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  // one transaction; `fn(stores)` issues requests synchronously, resolves on commit
  function run(names, mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const tx = d.transaction(names, mode);
      const stores = {};
      names.forEach((n) => { stores[n] = tx.objectStore(n); });
      let result;
      try { result = fn(stores); } catch (e) { reject(e); try { tx.abort(); } catch (e2) {} return; }
      tx.oncomplete = () => resolve(typeof result === "function" ? result() : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    }));
  }
  function capture(rq) { let v; rq.onsuccess = () => { v = rq.result; }; return () => v; }

  const ProjectStore = (window.ProjectStore = {
    available: !!window.indexedDB
  });

  function summaryOf(id, p, prev) {
    const now = Date.now();
    let owned = 0;
    for (const rid in (p.regions || {})) if (p.regions[rid] && p.regions[rid].owner) owned++;
    return {
      id,
      name: p.name || "",
      basemapId: p.basemapId,
      created: (prev && prev.created) || now,
      updated: now,
      trashed: (prev && prev.trashed) || null,
      states: (p.stateOrder || []).length,
      owned
    };
  }

  ProjectStore.list = function () {
    return run(["summaries"], "readonly", (s) => capture(s.summaries.getAll()))
      .then((all) => (all || []).sort((a, b) => b.updated - a.updated));
  };

  ProjectStore.load = function (id) {
    return run(["projects"], "readonly", (s) => capture(s.projects.get(id)));
  };

  ProjectStore.save = function (id, project) {
    return run(["summaries"], "readonly", (s) => capture(s.summaries.get(id))).then((prev) =>
      run(["projects", "summaries", "meta"], "readwrite", (s) => {
        s.projects.put(project, id);       // structured clone happens here, synchronously
        s.summaries.put(summaryOf(id, project, prev), id);
        s.meta.put(id, "current");
      }));
  };

  ProjectStore.getCurrent = function () {
    return run(["meta"], "readonly", (s) => capture(s.meta.get("current")));
  };
  ProjectStore.setCurrent = function (id) {
    return run(["meta"], "readwrite", (s) => { if (id) s.meta.put(id, "current"); else s.meta.delete("current"); });
  };

  ProjectStore.saveThumb = function (id, blob) {
    if (!blob) return Promise.resolve();
    return run(["thumbs"], "readwrite", (s) => { s.thumbs.put(blob, id); });
  };
  ProjectStore.thumb = function (id) {
    return run(["thumbs"], "readonly", (s) => capture(s.thumbs.get(id)));
  };

  function patchSummary(id, patch) {
    return run(["summaries"], "readwrite", (s) => {
      const rq = s.summaries.get(id);
      rq.onsuccess = () => { if (rq.result) s.summaries.put(Object.assign(rq.result, patch), id); };
    });
  }
  ProjectStore.trash = (id) => patchSummary(id, { trashed: Date.now() });
  ProjectStore.restore = (id) => patchSummary(id, { trashed: null });

  ProjectStore.rename = function (id, name) {
    return run(["projects", "summaries"], "readwrite", (s) => {
      const rq = s.projects.get(id);
      rq.onsuccess = () => { if (rq.result) { rq.result.name = name; s.projects.put(rq.result, id); } };
      const rs = s.summaries.get(id);
      rs.onsuccess = () => { if (rs.result) s.summaries.put(Object.assign(rs.result, { name }), id); };
    });
  };

  // permanent — only offered for projects already in the trash
  ProjectStore.purge = function (id) {
    return run(["projects", "summaries", "thumbs"], "readwrite", (s) => {
      s.projects.delete(id); s.summaries.delete(id); s.thumbs.delete(id);
    });
  };

  ProjectStore.duplicate = function (id, newId, suffix) {
    return Promise.all([ProjectStore.load(id), ProjectStore.thumb(id)]).then(([p, thumb]) => {
      if (!p) return null;
      // structured clone keeps binary data (custom-world rasters) intact
      const copy = typeof structuredClone === "function" ? structuredClone(p)
        : JSON.parse(JSON.stringify(window.World ? window.World.exportable(p) : p));
      copy.name = (copy.name || "") + suffix;
      return run(["projects", "summaries", "thumbs"], "readwrite", (s) => {
        s.projects.put(copy, newId);
        s.summaries.put(summaryOf(newId, copy, null), newId);
        if (thumb) s.thumbs.put(thumb, newId);
      }).then(() => newId);
    });
  };

  // one-time import of the single localStorage autosave from older versions
  // (the old key is left in place as a backup)
  ProjectStore.migrateLocalStorage = function (lsKey, newId) {
    return run(["meta"], "readonly", (s) => capture(s.meta.get("migratedLocalStorage"))).then((done) => {
      if (done) return null;
      let p = null;
      try { p = JSON.parse(localStorage.getItem(lsKey) || "null"); } catch (e) { p = null; }
      return run(["projects", "summaries", "meta"], "readwrite", (s) => {
        s.meta.put(true, "migratedLocalStorage");
        if (p && p.basemapId) {
          s.projects.put(p, newId);
          s.summaries.put(summaryOf(newId, p, null), newId);
          s.meta.put(newId, "current");
        }
      }).then(() => (p && p.basemapId ? newId : null));
    });
  };
})();
