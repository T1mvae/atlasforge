// AtlasForge — installable app (PWA): service worker registration, update prompt,
// "add to Home Screen" hint for Safari, persistent storage request.
(function () {
  const App = window.App;

  const PWA = (window.PWA = {
    updateReady: false,
    standalone: !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true,
    iOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  });

  // Safari keeps a plain tab's storage only while the site is visited; an app added to
  // the Home Screen keeps it. Nudge iPad users to install (dismissable, remembered).
  PWA.showInstallHint = function () {
    if (PWA.standalone || !PWA.iOS) return false;
    try { return localStorage.getItem("af-install-hint") !== "hidden"; } catch (e) { return true; }
  };
  PWA.hideInstallHint = function () {
    try { localStorage.setItem("af-install-hint", "hidden"); } catch (e) {}
    App.emit();
  };

  PWA.applyUpdate = function () {
    const reg = PWA.registration;
    if (reg && reg.waiting) reg.waiting.postMessage("skipWaiting");
    else location.reload();
  };

  // ---- offline copies of the big basemaps (only on request: they total ~100 MB) ----
  PWA.templateUrls = function (basemapId) {
    const def = (window.BASEMAPS || {})[basemapId];
    if (!def) return [];
    const paths = [def.dataset, def.physicalDataset, def.provinceDataset, def.regionDataset]
      .concat(def.physical ? Object.values(def.physical) : []);
    return [...new Set(paths.filter(Boolean).map((p) => (p[0] === "/" ? p.slice(1) : p)))];
  };
  PWA.isTemplateOffline = async function (basemapId) {
    const urls = PWA.templateUrls(basemapId);
    if (!urls.length) return true; // nothing to download (blank canvas, custom world, CDN world maps)
    if (!window.caches) return false;
    try {
      const cache = await caches.open("af-data-v1");
      for (const u of urls) if (!(await cache.match(new URL(u, location.href).href))) return false;
      return true;
    } catch (e) { return false; }
  };
  PWA.downloadTemplate = async function (basemapId) {
    // plain fetches: the service worker stores data/*.geojson responses as they pass
    const urls = PWA.templateUrls(basemapId);
    for (const u of urls) {
      const res = await fetch(u);
      if (!res.ok) throw new Error("HTTP " + res.status + " " + u);
      await res.arrayBuffer();
    }
  };

  if (!("serviceWorker" in navigator)) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!secure) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      PWA.registration = reg;
      const markReady = () => { PWA.updateReady = true; App.emit(); };
      if (reg.waiting && navigator.serviceWorker.controller) markReady();
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          // a waiting worker while another controls the page = a new version is ready
          if (sw.state === "installed" && navigator.serviceWorker.controller) markReady();
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || !PWA.updateReady) return;
        reloading = true;
        location.reload();
      });
      // check for a new version when the app comes back to the foreground
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    } catch (e) {
      console.warn("service worker registration failed", e);
    }
    try { if (navigator.storage && navigator.storage.persist) PWA.persisted = await navigator.storage.persist(); } catch (e) {}
  });
})();
