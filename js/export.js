// AtlasForge — export / import (PNG, SVG, JSON, GeoJSON)
(function () {
  function download(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  window.downloadBlob = download;

  function buildSVGString() {
    const live = document.getElementById("map-svg");
    if (!live) return null;
    const clone = live.cloneNode(true);
    clone.removeAttribute("class");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", window.MAP_W);
    clone.setAttribute("height", window.MAP_H);
    // strip selection highlights & hover-only ui
    clone.querySelectorAll(".region").forEach((p) => p.classList.remove("sel"));
    clone.querySelectorAll(".mapregion").forEach((p) => p.classList.remove("sel"));
    clone.querySelectorAll("[data-export-skip]").forEach((n) => n.remove());
    // reset zoom transform so the full map exports
    const g = clone.querySelector("#zoom-root");
    if (g) g.setAttribute("transform", "translate(0,0) scale(1)");
    const ser = new XMLSerializer();
    return ser.serializeToString(clone);
  }

  function drawLegendOnCanvas(ctx, scale) {
    const App = window.App;
    const p = App.project;
    const counts = window.stateStats();
    const rows = p.stateOrder.map((id) => p.states[id]).filter(Boolean);
    if (!rows.length) return;
    const pad = 12 * scale, rowH = 20 * scale, sw = 14 * scale;
    const font = `${12 * scale}px Helvetica, Arial, sans-serif`;
    ctx.font = font;
    let w = 0;
    rows.forEach((s) => { w = Math.max(w, ctx.measureText(s.name).width); });
    const boxW = pad * 2 + sw + 8 * scale + w + 40 * scale;
    const boxH = pad * 2 + rows.length * rowH + 18 * scale;
    const x = 14 * scale, y = ctx.canvas.height - boxH - 14 * scale;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = scale;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8 * scale);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.font = `bold ${12 * scale}px Helvetica, Arial, sans-serif`;
    ctx.fillText(window.t("legend.title"), x + pad, y + pad + 10 * scale);
    ctx.font = font;
    rows.forEach((s, i) => {
      const ry = y + pad + 18 * scale + i * rowH;
      ctx.fillStyle = s.color;
      ctx.fillRect(x + pad, ry, sw, sw);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(x + pad, ry, sw, sw);
      ctx.fillStyle = "#222";
      ctx.fillText(`${s.name}  (${counts[s.id] || 0})`, x + pad + sw + 8 * scale, ry + sw - 3 * scale);
    });
  }

  const Exports = (window.Exports = {});

  Exports.svg = function () {
    const str = buildSVGString();
    if (!str) return;
    download(new Blob([str], { type: "image/svg+xml" }), fileBase() + ".svg");
  };

  Exports.png = function (scale = 2, withLegend = true) {
    const str = buildSVGString();
    if (!str) return;
    const App = window.App;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml" }));
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = window.MAP_W * scale;
      canvas.height = window.MAP_H * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = App.project.settings.sea;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (withLegend && App.ui.showLegend) drawLegendOnCanvas(ctx, scale);
      canvas.toBlob((blob) => download(blob, fileBase() + ".png"), "image/png");
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { window.Actions.toast(window.t("toast.exportError")); URL.revokeObjectURL(url); };
    img.src = url;
  };

  Exports.json = function () {
    const App = window.App;
    if (!App.project) return;
    const blob = new Blob([JSON.stringify(App.project, null, 1)], { type: "application/json" });
    download(blob, fileBase() + ".atlasforge.json");
  };

  function fileBase() {
    const App = window.App;
    return (App.project && App.project.name ? App.project.name : "map").replace(/[^\w\u0400-\u04FF -]+/g, "").trim() || "map";
  }

  // ---------- imports ----------
  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = accept;
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  }

  Exports.importProject = async function () {
    const f = await pickFile(".json,application/json");
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.basemapId) throw new Error("not a project");
      const App = window.App;
      App.project = Object.assign(window.newProjectData(data.basemapId), data);
      App.undoStack.length = 0; App.redoStack.length = 0;
      App.ui.selection = []; App.ui.activeState = null; App.ui.modal = null;
      App.emit();
      window.scheduleSave();
      window.Geo.load(App.project);
    } catch (e) {
      window.Actions.toast(window.t("toast.importError"));
    }
  };

  Exports.importGeoJSON = async function () {
    const f = await pickFile(".json,.geojson,application/geo+json,application/json");
    if (!f) return;
    try {
      const gj = JSON.parse(await f.text());
      if (gj.type !== "FeatureCollection" || !Array.isArray(gj.features)) throw new Error("not geojson");
      window.Actions.newProject("custom", { customGeo: gj });
    } catch (e) {
      window.Actions.toast(window.t("toast.importError"));
    }
  };

  Exports.uploadFlag = async function (sid) {
    const f = await pickFile("image/*");
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      // downscale to keep project small
      const img = new Image();
      img.onload = () => {
        const maxW = 160;
        const k = Math.min(1, maxW / img.width);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        window.Actions.setState(sid, { flag: cv.toDataURL("image/png") });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
})();
