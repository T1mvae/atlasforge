// AtlasForge — export / import (PNG, SVG, JSON, GeoJSON)
(function () {
  // On iPad a download link opens a preview; the share sheet has "Save to Files", "Save
  // Image", AirDrop, Mail… Sharing needs a fresh user gesture: long exports (PNG) finish
  // first and then offer a button whose tap shares the file.
  function download(blob, filename) {
    if (!blob) { window.Actions.toast(window.t("toast.exportError")); return; }
    const touch = window.PWA && window.PWA.iOS;
    if (touch && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: filename }).catch((e) => {
            if (!e || e.name !== "AbortError") linkDownload(blob, filename);
          });
          return;
        }
      } catch (e) { /* fall through to the link */ }
    }
    linkDownload(blob, filename);
  }
  function linkDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Safari may fetch the file only after the user confirms: keep it alive a while
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
  }
  window.downloadBlob = download;

  const SVGNS = "http://www.w3.org/2000/svg", XLINK = "http://www.w3.org/1999/xlink";

  // Class-based map styling lives in editor.css, which is NOT present in a standalone
  // export — embed the rules the map needs: country labels, places (icons, their names)
  // and the borders drawn in screen pixels.
  function embeddedStyle() {
    const fontUi = (getComputedStyle(document.documentElement).getPropertyValue("--font-ui") || "").trim()
      || '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
    return ":root{--font-ui:" + fontUi + ";}"
      + '.country-label{font-family:Georgia,"Times New Roman","Noto Serif","Liberation Serif",serif;'
      + "font-weight:700;text-transform:uppercase;fill:#f1f3f2;stroke:#26323a;paint-order:stroke fill;"
      + "filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.45));}"
      + ".country-label.plain{font-family:var(--font-ui);text-transform:none;font-weight:600;}"
      + ".mapregion,.region{stroke-linejoin:round;}"
      + ".region,.mapregion,.borders path{vector-effect:non-scaling-stroke;}"
      + ".obj-sym{fill:#f6efe0;stroke:#2e2418;stroke-width:1.1;stroke-linejoin:round;stroke-linecap:round;paint-order:stroke;}"
      + ".obj-sym .obj-accent{fill:#d6a93a;stroke:#2e2418;}.obj-sym .obj-magic{fill:#9b6fd0;stroke:#2e2418;}"
      + ".obj-sym .obj-danger{fill:#c9483b;stroke:#2e2418;}.obj-sym .obj-hole{fill:#2e2418;}.obj-sym .obj-line{fill:none;}"
      + '.map-object-label{font-family:Georgia,"Times New Roman",serif;font-size:7px;fill:#1f1a14;stroke:#f6efe0;'
      + "stroke-width:2.2px;paint-order:stroke;}.map-object-label.big{font-size:9px;font-weight:700;}";
  }

  // ---------- the picture ----------
  // An exported picture is the map as it would look on a "virtual screen": at the normal
  // size the whole map fitted to a screen, drawn 4× sharper; the big sizes as if zoomed
  // in, so borders and rivers stay fine lines while names and places show every detail.
  //   ppu: output pixels per map unit · kv: the virtual zoom · q: pixel density of the
  //   virtual screen (lines drawn in screen pixels grow by it)
  const FIT_PPU = 0.5; // screen px per map unit of a map fitted to a typical screen
  const SIZES = { normal: { ppu: 2, kv: 1 }, large: { ppu: 4, kv: 4 }, huge: { ppu: 8, kv: 8 } };
  const densityOf = (sz) => sz.ppu / (FIT_PPU * sz.kv);

  // lines drawn in screen pixels (vector-effect) — borders, river banks, roads — keep
  // their look on the virtual screen: q times as many image pixels
  function scaleScreenStrokes(root, q) {
    if (q === 1) return;
    root.querySelectorAll("*").forEach((el) => {
      const cls = el.getAttribute("class") || "";
      const nonScaling = el.getAttribute("vector-effect") === "non-scaling-stroke" ||
        /(^|\s)(region|mapregion)(\s|$)/.test(cls) || (el.tagName === "path" && el.parentNode && /(^|\s)borders(\s|$)/.test(el.parentNode.getAttribute("class") || ""));
      if (!nonScaling) return;
      el.setAttribute("vector-effect", "non-scaling-stroke");
      const sw = parseFloat(el.getAttribute("stroke-width"));
      if (sw > 0) el.setAttribute("stroke-width", +(sw * q).toFixed(3));
      const da = el.getAttribute("stroke-dasharray");
      if (da && da !== "none") el.setAttribute("stroke-dasharray", da.split(/[\s,]+/).filter(Boolean).map((v) => +(parseFloat(v) * q).toFixed(3)).join(" "));
    });
  }

  // a detached copy of the live map, ready to be drawn: no editing aids, no selection, no
  // zoom; places sized for the virtual screen; the stylesheet inside
  function prepareClone(sz, forSvg) {
    const live = document.getElementById("map-svg");
    if (!live) return null;
    const App = window.App;
    const clone = live.cloneNode(true);
    clone.removeAttribute("class");
    clone.setAttribute("xmlns", SVGNS);
    clone.setAttribute("xmlns:xlink", XLINK);
    clone.querySelectorAll("[data-export-skip]").forEach((n) => n.remove());
    clone.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel"));
    clone.querySelectorAll("text").forEach((n) => { if (n.style && n.style.outline) n.style.outline = ""; });
    const g = clone.querySelector("#zoom-root");
    if (g) g.setAttribute("transform", "translate(0,0) scale(1)");
    const objs = (App.project && App.project.objects) || {};
    if (window.objectTransform) {
      clone.querySelectorAll("#objects [data-object]").forEach((el) => {
        const ob = objs[el.getAttribute("data-object")];
        if (ob) el.setAttribute("transform", window.objectTransform(ob, sz.kv, FIT_PPU));
      });
    }
    // a hairline on screen is softened by antialiasing; drawn sharp it may be a touch thinner
    scaleScreenStrokes(clone, Math.pow(densityOf(sz), 0.85));
    if (forSvg) {
      // SVG 1.1 readers (Illustrator, older Inkscape) only know xlink:href
      clone.querySelectorAll("use, image").forEach((n) => {
        const h = n.getAttribute("href");
        if (h) { n.removeAttribute("href"); n.setAttributeNS(XLINK, "xlink:href", h); }
      });
    }
    const styleEl = document.createElementNS(SVGNS, "style");
    styleEl.textContent = embeddedStyle();
    clone.insertBefore(styleEl, clone.firstChild);
    return clone;
  }

  function buildSVGString() {
    const clone = prepareClone(SIZES.normal, true);
    if (!clone) return null;
    const W = window.MAP_W, H = window.MAP_H;
    clone.setAttribute("width", W);
    clone.setAttribute("height", H);
    // custom world: the painted terrain is an HTML canvas under the SVG — embed it
    const g = clone.querySelector("#zoom-root");
    if (g && window.World && window.World.active() && window.World.canvas && window.App.basemap.proj) {
      const proj = window.App.basemap.proj;
      const p0 = proj([0, 0]), p1 = proj([window.World.GW, window.World.GH]);
      const img = document.createElementNS(SVGNS, "image");
      img.setAttributeNS(XLINK, "xlink:href", window.World.canvas.toDataURL("image/png"));
      img.setAttribute("x", p0[0]); img.setAttribute("y", p0[1]);
      img.setAttribute("width", p1[0] - p0[0]); img.setAttribute("height", p1[1] - p0[1]);
      img.setAttribute("preserveAspectRatio", "none");
      g.insertBefore(img, g.firstChild);
    }
    // sea background so the standalone SVG isn't transparent (after the stylesheet)
    const sea = (window.App && window.App.project && window.App.project.settings.sea) || "#b7cfdf";
    const bg = document.createElementNS(SVGNS, "rect");
    bg.setAttribute("x", 0); bg.setAttribute("y", 0);
    bg.setAttribute("width", W); bg.setAttribute("height", H);
    bg.setAttribute("fill", sea);
    clone.insertBefore(bg, clone.firstChild.nextSibling);
    return new XMLSerializer().serializeToString(clone);
  }

  // legend in the bottom-left corner of the whole picture (fullH tall), drawn at scale
  function drawLegendOnCanvas(ctx, scale, fullH) {
    const App = window.App;
    const p = App.project;
    const counts = window.stateStats();
    // culture / religion / language modes export their own legend, coloured
    // from the catalogs exactly like the on-screen one
    const metaField = ["culture", "religion", "language"].includes(p.displayMode) && window.Metadata ? p.displayMode : null;
    let rows = metaField
      ? window.Metadata.legend(p, metaField).map((r) => ({ id: r.name, name: r.name, color: r.color, count: r.count }))
      : p.stateOrder.map((id) => p.states[id]).filter(Boolean).map((s) => ({ id: s.id, name: s.name, color: s.color, count: counts[s.id] || 0 }));
    if (!rows.length) return;
    // a long list stops at the biggest ones
    const MAXROWS = 32;
    let more = 0;
    if (rows.length > MAXROWS) {
      rows = rows.slice().sort((a, b) => b.count - a.count);
      more = rows.length - MAXROWS;
      rows = rows.slice(0, MAXROWS);
    }
    const pad = 12 * scale, rowH = 20 * scale, sw = 14 * scale;
    const font = `${12 * scale}px Helvetica, Arial, sans-serif`;
    ctx.font = font;
    let w = 0;
    rows.forEach((s) => { w = Math.max(w, ctx.measureText(`${s.name}  (${s.count})`).width); });
    const boxW = pad * 2 + sw + 8 * scale + w + 8 * scale;
    const boxH = pad * 2 + (rows.length + (more ? 1 : 0)) * rowH + 18 * scale;
    const x = 14 * scale, y = fullH - boxH - 14 * scale;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = scale;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8 * scale);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.font = `bold ${12 * scale}px Helvetica, Arial, sans-serif`;
    ctx.fillText(window.t(metaField ? "legend." + metaField : "legend.title"), x + pad, y + pad + 10 * scale);
    ctx.font = font;
    rows.forEach((s, i) => {
      const ry = y + pad + 18 * scale + i * rowH;
      ctx.fillStyle = s.color;
      ctx.fillRect(x + pad, ry, sw, sw);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.strokeRect(x + pad, ry, sw, sw);
      ctx.fillStyle = "#222";
      ctx.fillText(`${s.name}  (${s.count})`, x + pad + sw + 8 * scale, ry + sw - 3 * scale);
    });
    if (more) {
      ctx.fillStyle = "#555";
      ctx.fillText(window.t("export.legendMore").replace("{n}", more), x + pad, y + pad + 18 * scale + rows.length * rowH + sw - 3 * scale);
    }
  }

  // ---------- PNG written band by band ----------
  // Rows are filtered and pushed through the browser's zlib (CompressionStream
  // "deflate") as they come, so a picture far bigger than any canvas iOS allows is saved
  // without ever holding it whole.
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(c, a) {
    for (let i = 0; i < a.length; i++) c = CRC_TABLE[(c ^ a[i]) & 255] ^ (c >>> 8);
    return c;
  }
  // a PNG chunk as blob parts (the data itself is not copied)
  function chunkParts(type, data) {
    const head = new Uint8Array(8), tail = new Uint8Array(4);
    new DataView(head.buffer).setUint32(0, data.length);
    for (let k = 0; k < 4; k++) head[4 + k] = type.charCodeAt(k);
    const crc = crc32(crc32(0xffffffff, head.subarray(4)), data) ^ 0xffffffff;
    new DataView(tail.buffer).setUint32(0, crc >>> 0);
    return [head, data, tail];
  }
  function createPngWriter(width, height) {
    if (typeof CompressionStream === "undefined") return null;
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    const out = [];
    const pump = (async () => { for (;;) { const r = await reader.read(); if (r.done) return; out.push(r.value); } })();
    const stride = width * 3;
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    return {
      async add(rgba, rows) {
        const buf = new Uint8Array((stride + 1) * rows);
        for (let y = 0; y < rows; y++) {
          for (let x = 0, s0 = y * width * 4, j = 0; x < width; x++, s0 += 4) { cur[j++] = rgba[s0]; cur[j++] = rgba[s0 + 1]; cur[j++] = rgba[s0 + 2]; }
          // filter "Sub" or "Up", whichever leaves smaller numbers
          let sumSub = 0, sumUp = 0;
          for (let j = 0; j < stride; j++) {
            const a = (cur[j] - (j >= 3 ? cur[j - 3] : 0)) & 255, u = (cur[j] - prev[j]) & 255;
            sumSub += a < 128 ? a : 256 - a; sumUp += u < 128 ? u : 256 - u;
          }
          const o = y * (stride + 1) + 1;
          if (sumUp <= sumSub) { buf[o - 1] = 2; for (let j = 0; j < stride; j++) buf[o + j] = cur[j] - prev[j]; }
          else { buf[o - 1] = 1; for (let j = 0; j < stride; j++) buf[o + j] = cur[j] - (j >= 3 ? cur[j - 3] : 0); }
          const tmp = prev; prev = cur; cur = tmp;
        }
        await writer.write(buf);
      },
      async finish() {
        await writer.close();
        await pump;
        const ihdr = new Uint8Array(13);
        const dv = new DataView(ihdr.buffer);
        dv.setUint32(0, width); dv.setUint32(4, height);
        ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
        const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])].concat(chunkParts("IHDR", ihdr));
        out.forEach((piece) => { parts.push.apply(parts, chunkParts("IDAT", piece)); });
        parts.push.apply(parts, chunkParts("IEND", new Uint8Array(0)));
        return new Blob(parts, { type: "image/png" });
      }
    };
  }

  const nextFrame = () => new Promise((r) => setTimeout(r, 0));
  function svgImage(str) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("svg")); };
      img.src = url;
    });
  }

  // the picture as a PNG blob: horizontal bands of at most ~8 megapixels, each the
  // terrain drawn at full resolution and the map's vectors drawn for just that band
  async function renderPng(sizeKey, withLegend, onProgress, cancelled) {
    const App = window.App, World = window.World;
    const sz = SIZES[sizeKey] || SIZES.normal;
    const q = densityOf(sz);
    const W = Math.round(window.MAP_W * sz.ppu), H = Math.round(window.MAP_H * sz.ppu);
    const clone = prepareClone(sz, false);
    if (!clone) throw new Error("no map");
    // numeric stand-ins (valid attributes), swapped for each band in the serialized text
    clone.setAttribute("width", "987654.25");
    clone.setAttribute("height", "876543.75");
    clone.setAttribute("viewBox", "0 0 987654.25 876543.75");
    clone.setAttribute("preserveAspectRatio", "none");
    const str = new XMLSerializer().serializeToString(clone);
    const nested = str.indexOf("<image") >= 0; // flags: give their pictures a moment
    const bandRows = Math.max(1, Math.min(H, Math.floor(8.0e6 / W)));
    const bands = Math.ceil(H / bandRows);
    const writer = bands > 1 ? createPngWriter(W, H) : null;
    if (bands > 1 && !writer) throw new Error("compression");
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = Math.min(bandRows, H);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const seaHex = App.project.settings.sea || "#b7cfdf";
    const seaRGB = [parseInt(seaHex.slice(1, 3), 16), parseInt(seaHex.slice(3, 5), 16), parseInt(seaHex.slice(5, 7), 16)];
    const world = World && World.active() && App.basemap && App.basemap.proj;
    try {
      for (let b = 0; b < bands; b++) {
        if (cancelled()) throw new Error("cancelled");
        const y0 = b * bandRows, rows = Math.min(bandRows, H - y0);
        if (canvas.height !== rows) canvas.height = rows;
        ctx.fillStyle = seaHex;
        ctx.fillRect(0, 0, W, rows);
        if (world) World.renderTerrain(ctx, W, rows, 0, y0 / sz.ppu, sz.ppu, seaRGB);
        await nextFrame();
        const svg = str.replace('viewBox="0 0 987654.25 876543.75"', `viewBox="0 ${y0 / sz.ppu} ${window.MAP_W} ${rows / sz.ppu}"`)
          .replace('width="987654.25"', `width="${W}"`).replace('height="876543.75"', `height="${rows}"`);
        const img = await svgImage(svg);
        if (img.decode) { try { await img.decode(); } catch (e) { /* drawn anyway */ } }
        if (nested) await new Promise((r) => setTimeout(r, 60));
        ctx.drawImage(img, 0, 0, W, rows);
        if (withLegend) { ctx.save(); ctx.translate(0, -y0); drawLegendOnCanvas(ctx, q * 0.8, H); ctx.restore(); }
        if (writer) await writer.add(ctx.getImageData(0, 0, W, rows).data, rows);
        onProgress((b + 1) / bands);
        await nextFrame();
      }
      let blob;
      if (writer) blob = await writer.finish();
      else blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("encode");
      return { blob, w: W, h: H };
    } finally {
      canvas.width = canvas.height = 0; // give the memory back at once (iPad)
      if (World && World.releaseHiRes) World.releaseHiRes();
    }
  }

  const Exports = (window.Exports = {});
  Exports.SIZES = SIZES;
  // the running or finished picture export: { size, running, progress, blob, name, w, h, error }
  Exports.job = null;
  const setJob = (patch) => { Exports.job = patch ? Object.assign({}, Exports.job, patch) : null; window.App.emit(); };

  Exports.startPng = async function (sizeKey, withLegend) {
    const App = window.App, World = window.World;
    if (World && (World.preview || World.cutPreview)) { window.Actions.toast(window.t("export.previewOpen")); return; }
    if (Exports.job && Exports.job.running) return;
    let stop = false;
    setJob({ size: sizeKey, running: true, progress: 0, blob: null, error: null, cancel: () => { stop = true; } });
    try {
      const res = await renderPng(sizeKey, withLegend && App.project.stateOrder.length > 0, (pr) => setJob({ progress: pr }), () => stop);
      const name = fileBase() + (sizeKey === "normal" ? "" : "-" + sizeKey) + ".png";
      setJob({ running: false, progress: 1, blob: res.blob, name, w: res.w, h: res.h });
      // desktop browsers save straight away; the iPad waits for a tap on "Save / Share"
      if (!(window.PWA && window.PWA.iOS)) linkDownload(res.blob, name);
    } catch (e) {
      console.error("image export failed", e);
      const msg = String(e && e.message);
      setJob({ running: false, error: stop || msg === "cancelled" ? null : msg === "compression" ? "compression" : "failed" });
    }
  };
  // inside the tap on the "Save / Share" button, so the share sheet may open
  Exports.saveResult = function () {
    const j = Exports.job;
    if (j && j.blob) download(j.blob, j.name);
  };
  Exports.clearJob = function () {
    if (Exports.job && Exports.job.running && Exports.job.cancel) Exports.job.cancel();
    setJob(null);
  };

  Exports.svgString = buildSVGString;
  Exports.svg = function () {
    const str = buildSVGString();
    if (!str) return;
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + str;
    download(new Blob([doc], { type: "image/svg+xml;charset=utf-8" }), fileBase() + ".svg");
  };

  // small preview for the project library: terrain (custom worlds) or land, plus
  // state colours; drawn synchronously so it always shows the project it was called for
  Exports.thumbnail = function () {
    const App = window.App, p = App.project, bm = App.basemap;
    if (!p || !bm || bm.status !== "ready") return null;
    const W = 480, H = Math.round(480 * window.MAP_H / window.MAP_W);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = p.settings.sea;
    ctx.fillRect(0, 0, W, H);
    ctx.scale(W / window.MAP_W, H / window.MAP_H);
    const world = window.World && window.World.active() && window.World.canvas && bm.proj;
    if (world) {
      const p0 = bm.proj([0, 0]), p1 = bm.proj([window.World.GW, window.World.GH]);
      ctx.drawImage(window.World.canvas, p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
    } else if (bm.landPath) {
      ctx.fillStyle = p.settings.land;
      try { ctx.fill(new Path2D(bm.landPath)); } catch (e) {}
    }
    ctx.globalAlpha = world ? (p.settings.worldFillOpacity != null ? p.settings.worldFillOpacity : 0.62) : 1;
    bm.features.forEach((f) => {
      const e = window.effRegion(p, f.id);
      const col = e && (e.color || (e.owner && p.states[e.owner] && p.states[e.owner].color));
      if (!col && world) return;
      ctx.fillStyle = col || p.settings.land;
      try { ctx.fill(f._p2d || (f._p2d = new Path2D(f.d))); } catch (e2) {}
    });
    return cv;
  };
  Exports.saveThumbnail = function () {
    const App = window.App;
    if (!window.ProjectStore || !window.ProjectStore.available || !App.projectId) return Promise.resolve();
    const id = App.projectId;
    let cv = null;
    try { cv = Exports.thumbnail(); } catch (e) { cv = null; }
    if (!cv) return Promise.resolve();
    return new Promise((resolve) => {
      cv.toBlob((blob) => { window.ProjectStore.saveThumb(id, blob).then(resolve, resolve); }, "image/jpeg", 0.82);
    });
  };

  Exports.json = function () {
    const App = window.App;
    if (!App.project) return;
    const data = window.World ? window.World.exportable(App.project) : App.project;
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
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
      // an imported file becomes a new project in the library (never overwrites the open one)
      if (window.App.project) { if (Exports.saveThumbnail) Exports.saveThumbnail(); await window.Actions.saveNow(); }
      window.Actions.openProjectData(data, null);
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
        const maxW = 320; // sharp enough for the big picture exports
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
