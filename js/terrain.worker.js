// AtlasForge — terrain worker: climate, hydrology, smart provinces and the geography pass
// for custom worlds, off the main thread so painting on an iPad never stalls.
//
// The page passes the script URLs it loaded (with their ?v= cache stamps) in the first
// message, so the worker always runs the same versions as the page.
let ready = false;

self.onmessage = (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === "init") {
      importScripts(...msg.scripts);
      ready = true;
      self.postMessage({ type: "ready" });
      return;
    }
    if (!ready) throw new Error("worker not initialised");
    if (msg.type === "hydro") self.postMessage(hydro(msg), transferables(["temp", "prec", "biome", "lake", "basin", "down", "acc"], msg));
    else if (msg.type === "provinces") { const out = provinces(msg); self.postMessage(out, [out.labels, out.why]); }
    else if (msg.type === "geography") {
      const t0 = Date.now();
      const out = self.TerrainAlgos.geography(msg);
      self.postMessage({ type: "geography", rev: msg.rev, height: out.height, cover: out.cover, rivers: out.rivers,
        report: Object.assign(out.report, { ms: Date.now() - t0 }) }, [out.height, out.cover]);
    }
  } catch (e) {
    self.postMessage({ type: "error", job: msg.type, rev: msg.rev, message: String(e && e.stack || e) });
  }
};

let lastResult = null;
function transferables() {
  const r = lastResult;
  lastResult = null;
  return r ? r.buffers : [];
}

// climate + rivers + lakes + basins on the analysis grid
function hydro(msg) {
  const TA = self.TerrainAlgos;
  const { W, H } = msg;
  const h = new Float32Array(msg.heights);
  const clim = TA.climate(h, W, H, msg.climate || {});
  const hyd = TA.hydrology(h, W, H, { rain: clim.prec, riverThreshold: msg.riverThreshold || 60, minRiverCells: msg.minRiverCells || 6 });
  const N = W * H;
  // biomes (wetlands need water nearby and flat ground)
  const biome = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (h[i] <= 0) continue;
      let nearWater = hyd.lake[i] === 1 || hyd.isRiver[i] === 1, flat = true;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (h[j] <= 0 || hyd.lake[j] || hyd.isRiver[j]) nearWater = true;
          if (Math.abs(h[j] - h[i]) > 60) flat = false;
        }
      }
      // rivers and lakes moisten the land around them
      const p = Math.min(1, clim.prec[i] + (nearWater ? 0.12 : 0));
      biome[i] = hyd.lake[i] ? 0 : TA.biomeOf(clim.temp[i], p, h[i], nearWater, flat);
    }
  }
  const basin = TA.mergeBasins(hyd.basin, hyd.nBasins, h, W, H, msg.minBasinCells || 120);
  const rivers = hyd.rivers.map((r, id) => ({
    id,
    cells: Array.from(r.cells),
    flux: r.flux,
    order: r.order,
    mouth: r.mouth,
    mouthType: r.mouthType,
    into: r.into,
    sourceType: r.sourceType
  }));
  const out = {
    type: "hydro", rev: msg.rev, W, H,
    temp: clim.temp.buffer, prec: clim.prec.buffer, biome: biome.buffer,
    lake: hyd.lake.buffer, basin: basin.buffer, down: hyd.down.buffer, acc: hyd.acc.buffer,
    rivers
  };
  lastResult = { buffers: [out.temp, out.prec, out.biome, out.lake, out.basin, out.down, out.acc] };
  return out;
}

// smart provinces → smoothed polygons with exact shared borders, what each province is
// made of (meta) and what the borders follow (why)
function provinces(msg) {
  const TA = self.TerrainAlgos;
  const { W, H } = msg;
  const h = new Float32Array(msg.heights);
  const basin = new Int32Array(msg.basin);
  const landId = msg.landId ? new Int32Array(msg.landId) : null;
  const riverMask = msg.riverMask ? new Uint8Array(msg.riverMask) : null;
  const t0 = Date.now();
  const prov = TA.smartProvinces({ W, H, h, basin, landId, riverMask, target: msg.target, seed: msg.seed, seeds: msg.seeds, opts: msg.opts });
  const t1 = Date.now();
  const polys = TA.labelPolygons(prov.labels, W, H, prov.count);
  const topo = Object.assign({}, self.topojson || {});
  const geoms = TA.smoothProvinceTopology(polys, topo, { iterations: 2, epsilon: 0.12 });
  const t2 = Date.now();
  return { type: "provinces", rev: msg.rev, count: prov.count, geometries: geoms, labels: prov.labels.buffer,
    meta: prov.meta, why: prov.why.buffer, report: prov.report, timing: { cut: t1 - t0, polygons: t2 - t1 } };
}
