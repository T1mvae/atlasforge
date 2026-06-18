// AtlasForge — base map loading & geometry processing
(function () {
  const W = 2000, H = 1020;
  window.MAP_W = W; window.MAP_H = H;

  const BASEMAPS = (window.BASEMAPS = {
    "world-110": {
      kind: "topo", object: "countries", approx: "~177",
      urls: ["https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json",
             "https://unpkg.com/world-atlas@2.0.2/countries-110m.json"]
    },
    "world-50": {
      kind: "topo", object: "countries", approx: "~241",
      urls: ["https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json",
             "https://unpkg.com/world-atlas@2.0.2/countries-50m.json"]
    },
    // THE primary map: every real admin-1 unit, max detail. Served locally
    // (built by mapshaper with TOPOLOGICAL simplification from NE 10m, so
    // neighbours share borders exactly) and loaded through the localgeo
    // pipeline: client topology -> separate border layers + full geometry
    // editing (merge/split/draw/vertex edit/delete, snapping, export).
    // `urls` kept: getAdmin1Topo() still feeds the legacy generated basemaps.
    "admin1": {
      kind: "localgeo", approx: "~4600",
      name: "World — raw provinces",
      dataset: "/data/world_admin1.geojson",
      physical: {
        rivers: "/data/world_rivers.geojson",
        lakes: "/data/world_lakes.geojson",
        mountains: "/data/world_mountains.geojson"
      },
      type: "region-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true,
      urls: [
        "https://cdn.jsdelivr.net/gh/mtraynham/natural-earth-topo@master/topojson/ne_10m_admin_1_states_provinces.json",
        "https://raw.githubusercontent.com/mtraynham/natural-earth-topo/master/topojson/ne_10m_admin_1_states_provinces.json"
      ]
    },
    // Old World Blues: the real OWB state-and-nation map of North America,
    // vectorized from the reference image by tools/extract_owb.py (~1450 regions,
    // each keeps its source colour). Fully editable; pixel coordinates.
    "owb": {
      kind: "localgeo", approx: "~1800",
      name: "Old World Blues (game projection)",
      dataset: "/data/owb_north_america.geojson",
      type: "region-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    // Same OWB regions georeferenced to real lon/lat (tools/owb_georef.py, thin-
    // plate spline from ~37 control points) so the continent sits at its true
    // world position and lines up with real rivers/lakes. Approximate.
    "owb_geo": {
      kind: "localgeo", approx: "~1800",
      name: "Old World Blues (geo-referenced)",
      dataset: "/data/owb_north_america_geo.geojson",
      physical: {
        rivers: "/data/world_rivers.geojson",
        lakes: "/data/world_lakes.geojson",
        mountains: "/data/world_mountains.geojson"
      },
      type: "region-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    // Blank canvas: empty editable map. Load a reference image as a backdrop and
    // trace a brand-new world (e.g. Westeros & Essos) with the draw tool.
    "blank": {
      kind: "blank", approx: "0",
      name: "Blank canvas",
      type: "region-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    "hybrid": { kind: "hybrid", approx: "~1100", urls: [] },
    "strategic": { kind: "strategic", approx: "~1300", urls: [] },
    "provinces": {
      kind: "provgrid", approx: "~6500",
      name: "Detailed Province World Map",
      type: "province-grid", coordinateSystem: "geo",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    "best_regions_world": {
      kind: "localgeo", approx: "~2550",
      name: "Best Regions World Map",
      description: "A custom atlas-style world region map combining geographical, historical, cultural, and political logic.",
      dataset: "/data/best_regions_world_repaired.geojson",
      fullDataset: "/data/best_regions_world.geojson",
      physical: {
        rivers: "/data/world_rivers.geojson",
        lakes: "/data/world_lakes.geojson",
        mountains: "/data/world_mountains.geojson"
      },
      type: "region-grid",
      supportsCountries: true,
      supportsCustomOwnership: true,
      supportsLabels: true,
      supportsFlags: true
    },
    // AtlasForge ORIGINAL atlas grid: ~1950 provinces generated from scratch over
    // real physical geography (Natural Earth) by tools/generate_world.py —
    // borders follow rivers/ridges, ~920 named historical region groups on top,
    // plus toggleable physical layers (rivers, lakes, ranges, deserts, seas).
    // (renamed from a duplicate "atlas_world" key — the localgeo entry below was
    // already winning at runtime; kept here so the dataset stays loadable)
    "atlas_world_provinces": {
      kind: "pixelgeo", approx: "~1950",
      name: "Atlas World Map",
      provinceDataset: "/data/world_provinces.geojson",
      provinceFallbackDataset: "/data/world_provinces.geojson",
      regionDataset: "/data/world_region_groups.geojson",
      regionFallbackDataset: "/data/world_region_groups.geojson",
      physicalDataset: "/data/world_physical.geojson",
      mapWidth: 4096, mapHeight: 2115, coordinateSystem: "pixel", origin: "top-left",
      type: "province-grid-with-regions",
      supportsCountries: true, supportsProvinceGroups: true,
      supportsRegionLayers: true, supportsCustomOwnership: true
    },
    // AtlasForge original world region grid (one flat editable level, built from
    // scratch over Natural Earth by tools/build_world_regions.py: real coastlines,
    // big wilderness cut along real rivers, ~800 authored geo/historical/cultural
    // seeds). Includes toggleable physical display layers (rivers/lakes/mountains).
    "atlas_world": {
      kind: "localgeo", approx: "~1250",
      name: "AtlasForge World Regions",
      dataset: "/data/atlasforge_world_regions.geojson",
      physical: {
        rivers: "/data/world_rivers.geojson",
        lakes: "/data/world_lakes.geojson",
        mountains: "/data/world_mountains.geojson"
      },
      type: "region-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    // AtlasForge's own state-based world map: the editable units ARE the states
    // (~1050 HoI4-scale shapes, improved names, no game data) — built by
    // tools/build_state_basemap.py. This is the primary map.
    "world_states": {
      kind: "pixelgeo", approx: "~1050",
      name: "State World Map",
      provinceDataset: "/data/atlasforge_world_states_075px.geojson",
      provinceFallbackDataset: "/data/atlasforge_world_states_075px.geojson",
      mapWidth: 5632, mapHeight: 2048, coordinateSystem: "pixel", origin: "top-left",
      type: "state-grid",
      supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    // Province grid (pixel GeoJSON) with the HOI4-style state regions as the base
    // region layer, completed to a clean full-world map by
    // tools/complete_state_regions.py: real states untouched, placeholder states
    // ("China 7", "TS 11", "Siberia 3"…) renamed/split into proper named regions,
    // obvious typos fixed. (tools/generate_regions.py can build a fully original
    // alternative layer instead.)
    "detailed_province_world": {
      kind: "pixelgeo", approx: "~10000",
      name: "Detailed Province World Map",
      provinceDataset: "/data/hoi4_provinces_simplified_075px.geojson",
      provinceFallbackDataset: "/data/hoi4_provinces_simplified_15px.geojson",
      regionDataset: "/data/hoi4_state_regions_completed_0_75px.geojson",
      regionFallbackDataset: "/data/hoi4_state_regions_completed_0_75px.geojson",
      mapWidth: 5632, mapHeight: 2048, coordinateSystem: "pixel", origin: "top-left",
      type: "province-grid-with-regions",
      supportsCountries: true, supportsProvinceGroups: true,
      supportsRegionLayers: true, supportsCustomOwnership: true
    },
    "hoi4": {
      kind: "voronoi", approx: "~4200",
      name: "Detailed Province World Map",
      provinceCount: 4200, landDataKey: "land50",
      type: "province-grid", supportsCountries: true, supportsProvinceGroups: true, supportsCustomOwnership: true
    },
    "custom": { kind: "custom", approx: "?" , urls: [] }
  });

  // Countries that get first-level subdivisions on the hybrid basemap
  const HYBRID_BIG = new Set([
    "Russia", "United States of America", "China", "India", "Brazil", "Canada",
    "Australia", "Kazakhstan", "Mexico", "Indonesia", "Argentina", "Iran",
    "Turkey", "Japan", "Germany", "France", "Spain", "Italy", "United Kingdom",
    "Poland", "Ukraine", "Sweden", "Norway", "Finland", "Egypt", "South Africa",
    "Nigeria", "Algeria", "Libya", "Sudan", "Ethiopia", "Saudi Arabia",
    "Pakistan", "Mongolia", "Peru", "Colombia", "Venezuela", "Chile", "Bolivia"
  ]);

  async function fetchFirst(urls) {
    let lastErr = null;
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("no urls");
  }

  // Local dataset paths may be authored as "/data/x.geojson"; try a few resolutions
  // so the same project works whether served from the site root or a subfolder.
  function localCandidates(path) {
    if (!path) return [];
    const out = [path];
    if (path[0] === "/") out.push(path.slice(1));
    const base = path.split("/").pop();
    out.push("data/" + base, base, "./data/" + base);
    return [...new Set(out)];
  }

  function buildProjection(geojson) {
    const proj = d3.geoNaturalEarth1();
    proj.fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" });
    return proj;
  }

  // d3.geoPath uses spherical winding: exterior rings must be CLOCKWISE in planar
  // lon/lat (reverse of RFC 7946). Datasets with the wrong winding render as
  // "the whole world minus the shape" and cover everything drawn before them
  // (e.g. a broken Maldives polygon hiding half the map). Normalize on load.
  function rewindForD3(geom) {
    if (!geom) return geom;
    const ringArea2 = (ring) => {
      let s = 0;
      // edge goes prev(j) -> cur(i): sum (x2-x1)(y2+y1); > 0 => clockwise (y-up)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
        s += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
      return s;
    };
    const fixPoly = (rings) => rings.map((ring, ri) => {
      const cw = ringArea2(ring) > 0;
      return cw === (ri === 0) ? ring : ring.slice().reverse();
    });
    if (geom.type === "Polygon") return { type: "Polygon", coordinates: fixPoly(geom.coordinates) };
    if (geom.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: geom.coordinates.map(fixPoly) };
    return geom;
  }

  // Original dense province grid generated from real coastlines: organic Voronoi cells
  // seeded evenly across land and clipped to the landmass. Not a copy of any game's map.
  const LAND50 = [
    "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json",
    "https://unpkg.com/world-atlas@2.0.2/land-50m.json"
  ];
  async function buildVoronoiProvinces(targetCount) {
    if (Geo.cache.voronoi) return Geo.cache.voronoi;
    const raw = Geo.cache.land50 || (Geo.cache.land50 = await fetchFirst(LAND50));
    const landGeo = topojson.feature(raw, raw.objects.land);
    const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" });
    const path = d3.geoPath(proj);
    const landPath = path(landGeo);
    // rasterize a land mask so we can scatter seeds on land only (even area density)
    const RW = 760, RH = Math.round(RW * H / W);
    const cv = document.createElement("canvas"); cv.width = RW; cv.height = RH;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, RW, RH);
    ctx.save(); ctx.scale(RW / W, RH / H);
    ctx.beginPath(); d3.geoPath(proj, ctx)(landGeo); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
    const mask = ctx.getImageData(0, 0, RW, RH).data;
    const onLand = (x, y) => {
      const ix = Math.floor(x * RW / W), iy = Math.floor(y * RH / H);
      if (ix < 0 || iy < 0 || ix >= RW || iy >= RH) return false;
      return mask[(iy * RW + ix) * 4] > 128;
    };
    // jittered grid → even-density seeds on land
    const landFrac = 0.29;
    const s = Math.max(6, Math.sqrt(W * H * landFrac / targetCount));
    const seeds = [];
    let rng = 1234567;
    const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let y = s / 2; y < H; y += s) {
      for (let x = s / 2; x < W; x += s) {
        const px = x + (rand() - 0.5) * s * 0.85, py = y + (rand() - 0.5) * s * 0.85;
        if (onLand(px, py)) seeds.push([px, py]);
      }
    }
    const delaunay = d3.Delaunay.from(seeds);
    const voro = delaunay.voronoi([0, 0, W, H]);
    const features = [], byId = {};
    seeds.forEach((seed, i) => {
      const poly = voro.cellPolygon(i);
      if (!poly || poly.length < 4) return;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      let d = "M";
      for (let k = 0; k < poly.length; k++) {
        const pt = poly[k];
        d += (k ? "L" : "") + pt[0].toFixed(1) + "," + pt[1].toFixed(1);
        if (pt[0] < minx) minx = pt[0]; if (pt[0] > maxx) maxx = pt[0];
        if (pt[1] < miny) miny = pt[1]; if (pt[1] > maxy) maxy = pt[1];
      }
      d += "Z";
      const area = Math.abs(d3.polygonArea(poly));
      const id = "v" + i;
      const feat = { id, name: "Province " + (i + 1), country: null, d, c: seed, b: [[minx, miny], [maxx, maxy]], area };
      features.push(feat); byId[id] = feat;
    });
    return {
      features, byId, landPath, clipLand: true,
      sphere: path({ type: "Sphere" }), graticule: path(d3.geoGraticule10()),
      path, proj, pixel: false
    };
  }
  const _origVoro = buildVoronoiProvinces;
  buildVoronoiProvinces = async function (n) { const r = await _origVoro(n); Geo.cache.voronoi = r; return r; };

  // Build the shared pixel-space projection. When mapW/mapH are known we fit a
  // synthetic bbox of the FULL map so that the province layer and the region layer
  // (two separate GeoJSON files in the same pixel coordinate system) align exactly,
  // regardless of which features each file happens to contain.
  function pixelProjection(geojson, mapW, mapH) {
    if (mapW && mapH) {
      const bbox = { type: "Polygon", coordinates: [[[0, 0], [mapW, 0], [mapW, mapH], [0, mapH], [0, 0]]] };
      return d3.geoIdentity().fitExtent([[6, 6], [W - 6, H - 6]], bbox);
    }
    return d3.geoIdentity().fitExtent([[6, 6], [W - 6, H - 6]], geojson);
  }

  // Planar pixel-coordinate GeoJSON loader (HOI4 province grid + custom pixel maps).
  function processPixelGeo(geojson, opts = {}) {
    const proj = opts.proj || pixelProjection(geojson, opts.mapWidth, opts.mapHeight);
    const path = d3.geoPath(proj);
    const features = [], byId = {};
    geojson.features.forEach((f, i) => {
      const p = f.properties || {};
      const ptype = p.type;
      if (ptype === "sea" || ptype === "lake" || p.terrain === "ocean" || p.terrain === "lakes") return;
      const d = path(f);
      if (!d) return;
      const pid = p.provinceId != null ? p.provinceId : (p.id != null ? p.id : i);
      const id = "p" + pid;
      let c, b;
      try { c = path.centroid(f); b = path.bounds(f); } catch (e) { c = [0, 0]; b = [[0, 0], [0, 0]]; }
      const area = Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
      const feat = { id, pid, name: p.name || ("Province " + pid), nameRu: p.name_ru || null,
        country: null, d, c, b, area,
        terrain: p.terrain || null, ptype: ptype || null, coastal: !!p.coastal, continent: p.continent,
        defaultRegionId: null };
      features.push(feat); byId[id] = feat;
    });
    return { features, byId, sphere: "", graticule: "", path, proj, pixel: true };
  }

  // ---------- physical geography layers (rivers, lakes, ranges, deserts, seas) ----------
  // Projects the physical GeoJSON through the same pixel projection as the
  // provinces; returns render-ready path strings grouped by kind.
  function processPhysical(geojson, proj) {
    const path = d3.geoPath(proj);
    // geoIdentity isn't callable; recover the affine transform for label points
    const k = proj.scale ? proj.scale() : 1;
    const tr = proj.translate ? proj.translate() : [0, 0];
    const toScreen = (x, y) => [x * k + tr[0], y * k + tr[1]];
    const out = { rivers: [], lakes: [], relief: [], seas: [], landPath: null };
    (geojson.features || []).forEach((f) => {
      const p = f.properties || {};
      const typ = p.type;
      const imp = p.importance || "minor";
      const base = { id: p.id, name: p.name || "", nameRu: p.name_ru || null, importance: imp };
      if (typ === "land") {
        out.landPath = path(f);
        return;
      }
      if (typ === "sea" || typ === "strait") {
        const c = f.geometry && f.geometry.type === "Point"
          ? toScreen(f.geometry.coordinates[0], f.geometry.coordinates[1])
          : (p.labelX != null ? toScreen(p.labelX, p.labelY) : null);
        if (c) out.seas.push(Object.assign(base, { typ, c }));
        return;
      }
      const d = path(f);
      if (!d) return;
      const lbl = p.labelX != null ? toScreen(p.labelX, p.labelY) : null;
      if (typ === "river") out.rivers.push(Object.assign(base, { d }));
      else if (typ === "lake") out.lakes.push(Object.assign(base, { d, c: lbl }));
      else if (typ === "mountain_range" || typ === "desert") out.relief.push(Object.assign(base, { typ, d, c: lbl }));
    });
    return out;
  }

  // ---------- regular state-region layer (mid-level regions above provinces) ----------
  // Project the HOI4 state-region GeoJSON through the SAME pixel projection as the
  // provinces and turn every feature into a MapRegion (type "state"). Strategic
  // regions are intentionally never loaded here.
  function processRegions(geojson, proj, byProvId) {
    const path = d3.geoPath(proj);
    const regions = [], byId = {}, provinceToRegion = {};
    (geojson.features || []).forEach((f, i) => {
      const p = f.properties || {};
      const d = path(f);
      if (!d) return;
      const rawId = p.regionId != null ? p.regionId : (p.stateId != null ? p.stateId : (p.id != null ? p.id : i));
      const id = "s" + rawId;
      let c, b;
      try { c = path.centroid(f); b = path.bounds(f); } catch (e) { c = [0, 0]; b = [[0, 0], [0, 0]]; }
      const area = Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
      const provinceIds = Array.isArray(p.provinceIds) ? p.provinceIds.slice() : [];
      const provinceFeatureIds = [];
      provinceIds.forEach((pid) => {
        const fid = "p" + pid;
        provinceToRegion[fid] = id;
        if (!byProvId || byProvId[fid]) provinceFeatureIds.push(fid);
      });
      const region = {
        id, regionId: rawId, name: p.name || ("Region " + rawId), nameRu: p.name_ru || null,
        type: "state",
        d, c, b, area, builtin: true,
        provinceIds, provinceFeatureIds,
        owner: p.owner || null, cores: p.cores || [],
        category: p.stateCategory || null, manpower: p.manpower != null ? p.manpower : null,
        resources: p.resources || {}, localisationKey: p.localisationKey || null
      };
      regions.push(region); byId[id] = region;
    });
    return { regions, byId, provinceToRegion };
  }

  // ---------- geometry: union member provinces into one custom-region shape ----------
  // Parse a d3-geoIdentity SVG path ("M x,y L x,y … Z" subpaths, straight segments only)
  // back into coordinate rings so polygon-clipping can union them.
  function parsePathRings(d) {
    if (!d) return [];
    const rings = [];
    d.split("Z").forEach((sub) => {
      sub = sub.trim();
      if (!sub) return;
      const ring = [];
      // pull all numbers in order, pair them into [x,y] points
      const nums = sub.match(/-?\d+(?:\.\d+)?/g);
      if (!nums) return;
      for (let i = 0; i + 1 < nums.length; i += 2) ring.push([+nums[i], +nums[i + 1]]);
      if (ring.length >= 3) rings.push(ring);
    });
    return rings;
  }
  function ringsBounds(mp) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    mp.forEach((poly) => poly.forEach((ring) => ring.forEach((pt) => {
      if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
      if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
    })));
    if (!isFinite(x0)) return [[0, 0], [0, 0]];
    return [[x0, y0], [x1, y1]];
  }
  function mpToPath(mp) {
    let d = "";
    mp.forEach((poly) => poly.forEach((ring) => {
      if (ring.length < 3) return;
      d += "M" + ring.map((pt) => pt[0].toFixed(1) + "," + pt[1].toFixed(1)).join("L") + "Z";
    }));
    return d;
  }
  // Build one merged MapRegion geometry from a set of province feature ids.
  // (assigned to Geo after the Geo object is declared, below)
  function buildRegionGeometry(provinceFeatureIds) {
    const bm = window.App.basemap;
    const polys = [];
    provinceFeatureIds.forEach((fid) => {
      const f = bm.byId[fid];
      if (!f) return;
      parsePathRings(f.d).forEach((ring) => polys.push([[ring]]));
    });
    if (!polys.length) return null;
    let merged = null, d = null;
    if (typeof polygonClipping !== "undefined") {
      try { merged = polygonClipping.union.apply(polygonClipping, polys); } catch (e) { merged = null; }
    }
    if (merged && merged.length) {
      d = mpToPath(merged);
    } else {
      // fallback: just concatenate the member province paths
      d = provinceFeatureIds.map((fid) => (bm.byId[fid] || {}).d || "").join("");
      merged = polys.map((p) => p[0]);
    }
    const b = ringsBounds(merged);
    const c = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    const area = Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
    return { d, c, b, area };
  }

  function processGeo(geojson, kind, opts) {
    opts = opts || {};
    const proj = opts.proj || buildProjection(geojson);
    const path = d3.geoPath(proj);
    const features = [];
    const byId = {};
    geojson.features.forEach((f, i) => {
      const d = path(f);
      if (!d) return;
      const props = f.properties || {};
      let id = String(f.id ?? props.adm1_code ?? props.ne_id ?? props.id ?? "r" + i);
      if (byId[id]) id = id + "_" + i; // de-dup colliding Natural Earth ids (e.g. Australia + Ashmore both "036")
      const name = props.name || props.NAME || props.NAME_EN || props.name_en || props.title || "Region " + (i + 1);
      const country = props.admin || props.ADMIN || props.geounit || null;
      let c, b;
      try { c = path.centroid(f); b = path.bounds(f); } catch (e) { c = [0, 0]; b = [[0, 0], [0, 0]]; }
      const area = Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
      const feat = { id, name, country, d, c, b, area,
        nameRu: props.name_ru || null, terrain: props.terrain || null,
        histArea: props.historicalArea || null, cultArea: props.culturalArea || null,
        baseColor: (typeof props.color === "string" && props.color[0] === "#") ? props.color : null };
      features.push(feat);
      byId[id] = feat;
    });
    const sphere = opts.geographic === false ? "" : path({ type: "Sphere" });
    const graticule = opts.geographic === false ? "" : path(d3.geoGraticule10());
    return { features, byId, sphere, graticule, path, proj };
  }

  // Pick a projection for an arbitrary local GeoJSON: real lon/lat -> Natural
  // Earth; fantasy / pixel-coordinate data -> planar identity fit to the data.
  function pickLocalProjection(gj) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, n = 0;
    const scan = (c) => {
      if (typeof c[0] === "number") { n++; if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; }
      else for (let i = 0; i < c.length; i++) scan(c[i]);
    };
    (gj.features || []).forEach((f) => { if (f.geometry && f.geometry.coordinates) scan(f.geometry.coordinates); });
    const lonlat = n === 0 || (minx >= -180.5 && maxx <= 180.5 && miny >= -90.5 && maxy <= 90.5);
    if (lonlat) return { proj: buildProjection(gj), geographic: true };
    return { proj: d3.geoIdentity().reflectY(false).fitExtent([[12, 12], [W - 12, H - 12]], gj), geographic: false };
  }
  function identityFrame() {
    const bw = 1000, bh = Math.round(1000 * H / W);
    const bbox = { type: "FeatureCollection", features: [{ type: "Feature", properties: {},
      geometry: { type: "Polygon", coordinates: [[[0, 0], [bw, 0], [bw, bh], [0, bh], [0, 0]]] } }] };
    return { proj: d3.geoIdentity().reflectY(false).fitExtent([[12, 12], [W - 12, H - 12]], bbox), geographic: false, frame: [bw, bh] };
  }

  // Shared builder for fully-editable region maps (localgeo / custom import /
  // blank canvas): apply user geometry edits over the base collection, build a
  // client topology (so region / coast / country borders are separate layers)
  // and return a result with `raw` (lon-lat collection for editing & export).
  function buildEditableResult(baseGj, project, def, projInfo, cacheKey) {
    const edits = project.regionGeomEdits || null;
    let eff = (window.GeomEdit && edits)
      ? window.GeomEdit.applyToCollection(baseGj, edits)
      : { type: "FeatureCollection", features: (baseGj.features || []).map((f, i) => ({
          type: "Feature", id: String((f.id != null ? f.id : (f.properties || {}).id) || ("r" + i)),
          geometry: f.geometry, properties: f.properties })) };
    eff = { type: "FeatureCollection", features: eff.features.map((f) => ({
      type: "Feature", id: f.id, geometry: rewindForD3(f.geometry), properties: f.properties })) };
    let topo = null, topoObj = null;
    if (topojson.topology && eff.features.length) {
      const q = projInfo.geographic ? 1e6 : 1e5;
      const build = () => topojson.topology({ regions: eff }, q);
      const tk = cacheKey ? ("topo:" + cacheKey + ":" + (window.GeomEdit ? window.GeomEdit.editsKey(project) : "0")) : null;
      try {
        topo = tk ? (Geo.cache[tk] || (Geo.cache[tk] = build())) : build();
        topoObj = topo.objects.regions;
      } catch (e) { console.warn("editable topology failed", e); topo = null; topoObj = null; }
    }
    const result = processGeo(topo ? topojson.feature(topo, topoObj) : eff, "geo",
      { proj: projInfo.proj, geographic: projInfo.geographic });
    result.features.sort((a, b) => b.area - a.area);
    result.raw = eff;
    result.physicalDefs = def.physical || null;
    return { result, topo, topoObj };
  }

  const Geo = (window.Geo = {});
  Geo.cache = {};
  Geo.buildRegionGeometry = buildRegionGeometry;

  // ---------- province grid: organic provinces nested inside REAL states ----------
  // Each state (real admin regions, merged) is subdivided into a few Voronoi cells;
  // every cell is clipped to its state's real boundary, so province borders follow
  // real coastlines and real state borders — only the internal splits are synthetic.
  // ---------- province grid: REAL admin-1 provinces, large ones subdivided ----------
  // Every province keeps its real border (coast + admin lines, which the user liked).
  // Oversized / crooked provinces are split into organic sub-provinces clipped to the
  // real province, giving fine units so non-administrative historical borders (empires,
  // partitions) can be drawn — without merging anything down (Poland stays detailed).
  async function buildProvinceGrid() {
    if (Geo.cache.provGrid) return Geo.cache.provGrid;
    const admTopo = await getAdmin1Topo();
    const objName = Object.keys(admTopo.objects)[0];
    const obj = admTopo.objects[objName];
    const gj = topojson.feature(admTopo, obj);
    const proj = d3.geoNaturalEarth1().fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" });
    const path = d3.geoPath(proj);
    const provs = gj.features.map((f, i) => {
      const pr = f.properties || {};
      const d = path(f);
      let area = 0, b;
      try { area = Math.abs(path.area(f)); } catch (e) {}
      try { b = path.bounds(f); } catch (e) { b = [[0, 0], [0, 0]]; }
      return { i, d, area, b,
        name: pr.name || pr.name_en || pr.gn_name || pr.admin || ("Region " + i),
        country: pr.admin || pr.geonunit || null };
    }).filter((p) => p.d);
    // rasterize province-index mask (r,g = index+1, b=255 marker)
    const RW = 1700, RH = Math.round(RW * H / W);
    const cv = document.createElement("canvas"); cv.width = RW; cv.height = RH;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, RW, RH);
    ctx.save(); ctx.scale(RW / W, RH / H);
    provs.forEach((p, idx) => {
      const n = idx + 1;
      ctx.fillStyle = "rgb(" + (n & 255) + "," + ((n >> 8) & 255) + ",255)";
      try { ctx.fill(new Path2D(p.d)); } catch (e) {}
    });
    ctx.restore();
    const mask = ctx.getImageData(0, 0, RW, RH).data;
    const provAt = (x, y) => {
      const ix = Math.max(0, Math.min(RW - 1, Math.floor(x * RW / W)));
      const iy = Math.max(0, Math.min(RH - 1, Math.floor(y * RH / H)));
      const o = (iy * RW + ix) * 4;
      if (mask[o + 2] < 250) return -1;
      return (mask[o] | (mask[o + 1] << 8)) - 1;
    };
    const T = 280; // projected-area threshold: provinces bigger than this get split
    const features = [], byId = {}, clips = [];
    const whole = (p) => {
      const id = "r" + p.i;
      const feat = { id, name: p.name, country: p.country, d: p.d,
        c: [(p.b[0][0] + p.b[1][0]) / 2, (p.b[0][1] + p.b[1][1]) / 2], b: p.b, area: p.area };
      features.push(feat); byId[id] = feat;
    };
    provs.forEach((p, idx) => {
      const parts = p.area > T ? Math.min(60, Math.max(2, Math.round(p.area / T))) : 1;
      if (parts <= 1) { whole(p); return; }
      // sample seeds inside the province via the mask
      const seeds = [];
      let tries = 0;
      const bw = p.b[1][0] - p.b[0][0], bh = p.b[1][1] - p.b[0][1];
      while (seeds.length < parts && tries < parts * 240) {
        tries++;
        const x = p.b[0][0] + Math.random() * bw, y = p.b[0][1] + Math.random() * bh;
        if (provAt(x, y) === idx) seeds.push([x, y]);
      }
      if (seeds.length < 2) { whole(p); return; }
      const ext = [p.b[0][0] - 4, p.b[0][1] - 4, p.b[1][0] + 4, p.b[1][1] + 4];
      let vor = d3.Delaunay.from(seeds).voronoi(ext);
      const relaxed = seeds.map((sd, k) => {
        const cell = vor.cellPolygon(k);
        if (!cell) return sd;
        const ct = d3.polygonCentroid(cell);
        return provAt(ct[0], ct[1]) === idx ? ct : sd;
      });
      vor = d3.Delaunay.from(relaxed).voronoi(ext);
      const clipId = "pc" + p.i;
      clips.push({ id: clipId, d: p.d });
      relaxed.forEach((sd, k) => {
        const poly = vor.cellPolygon(k);
        if (!poly || poly.length < 4) return;
        let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, d = "M";
        for (let q = 0; q < poly.length; q++) {
          const pt = poly[q];
          d += (q ? "L" : "") + pt[0].toFixed(1) + "," + pt[1].toFixed(1);
          if (pt[0] < minx) minx = pt[0]; if (pt[0] > maxx) maxx = pt[0];
          if (pt[1] < miny) miny = pt[1]; if (pt[1] > maxy) maxy = pt[1];
        }
        d += "Z";
        const id = "r" + p.i + "_" + k;
        const feat = { id, name: p.name + " " + (k + 1), country: p.country, d, clipId,
          c: [sd[0], sd[1]],
          b: [[Math.max(minx, p.b[0][0]), Math.max(miny, p.b[0][1])], [Math.min(maxx, p.b[1][0]), Math.min(maxy, p.b[1][1])]],
          area: p.area / relaxed.length };
        features.push(feat); byId[id] = feat;
      });
    });
    // real borders from the topology: province lines (thin) + coast (bold)
    const coast = path(topojson.mesh(admTopo, obj, (a, b) => a === b));
    const provMesh = path(topojson.mesh(admTopo, obj, (a, b) => a !== b));
    let landPath = null;
    try { landPath = path(topojson.merge(admTopo, obj.geometries)); } catch (e) {}
    Geo.cache.provGrid = {
      features, byId,
      clips,
      staticBorders: { coast, prov: provMesh },
      landPath,
      sphere: path({ type: "Sphere" }), graticule: path(d3.geoGraticule10()),
      path, proj
    };
    return Geo.cache.provGrid;
  }

  function geomIdOf(g) {
    const pr = g.properties || {};
    return String(g.id ?? pr.adm1_code ?? pr.ne_id ?? pr.id ?? "");
  }

  // ---------- strategic regions (game-style cultural/geographic blocks) ----------
  function kmeansGroups(provs, k) {
    k = Math.max(1, Math.min(k, provs.length));
    if (k === 1) {
      const big = provs.slice().sort((a, b) => b.area - a.area)[0];
      return [{ name: big.name, members: provs }];
    }
    // farthest-point seeding
    const seeds = [provs.slice().sort((a, b) => b.area - a.area)[0]];
    while (seeds.length < k) {
      let best = null, bd = -1;
      provs.forEach((p) => {
        let d = Infinity;
        seeds.forEach((s) => { d = Math.min(d, (p.c[0] - s.c[0]) ** 2 + (p.c[1] - s.c[1]) ** 2); });
        if (d > bd) { bd = d; best = p; }
      });
      seeds.push(best);
    }
    let cents = seeds.map((s) => [s.c[0], s.c[1]]);
    let assign = new Array(provs.length).fill(0);
    for (let it = 0; it < 12; it++) {
      let changed = false;
      provs.forEach((p, i) => {
        let bi = 0, bd = Infinity;
        cents.forEach((c, j) => {
          const d = (p.c[0] - c[0]) ** 2 + (p.c[1] - c[1]) ** 2;
          if (d < bd) { bd = d; bi = j; }
        });
        if (assign[i] !== bi) { assign[i] = bi; changed = true; }
      });
      cents = cents.map((c, j) => {
        const mem = provs.filter((p, i) => assign[i] === j);
        if (!mem.length) return c;
        let sw = 0, sx = 0, sy = 0;
        mem.forEach((p) => { const w = Math.max(1, p.area); sw += w; sx += p.c[0] * w; sy += p.c[1] * w; });
        return [sx / sw, sy / sw];
      });
      if (!changed) break;
    }
    const groups = [];
    for (let j = 0; j < k; j++) {
      const mem = provs.filter((p, i) => assign[i] === j);
      if (!mem.length) continue;
      const big = mem.slice().sort((a, b) => b.area - a.area)[0];
      groups.push({ name: big.name, members: mem });
    }
    return groups;
  }

  function semanticGroups(provs, k) {
    for (const key of ["region_sub", "region"]) {
      const m = {};
      const missing = [];
      provs.forEach((p) => {
        const v = (p.g.properties || {})[key];
        if (v) (m[v] = m[v] || []).push(p);
        else missing.push(p);
      });
      const names = Object.keys(m);
      if (names.length < 2) continue;
      if (missing.length > provs.length * 0.25) continue;
      if (names.length < k * 0.5 || names.length > k * 1.9) continue;
      missing.forEach((p) => {
        let best = names[0], bd = Infinity;
        names.forEach((nm) => {
          const g = m[nm];
          const cx = g.reduce((s, q) => s + q.c[0], 0) / g.length;
          const cy = g.reduce((s, q) => s + q.c[1], 0) / g.length;
          const d = (cx - p.c[0]) ** 2 + (cy - p.c[1]) ** 2;
          if (d < bd) { bd = d; best = nm; }
        });
        m[best].push(p);
      });
      return names.map((nm) => ({ name: nm, members: m[nm] }));
    }
    return null;
  }

  // ---------- geometry helpers for the clean states pipeline ----------
  function decimateRing(ring, eps) {
    if (ring.length < 5) return ring;
    const out = [ring[0]];
    let last = ring[0];
    for (let i = 1; i < ring.length - 1; i++) {
      const p = ring[i];
      if ((p[0] - last[0]) ** 2 + (p[1] - last[1]) ** 2 >= eps * eps) { out.push(p); last = p; }
    }
    out.push(ring[ring.length - 1]);
    return out.length >= 4 ? out : ring;
  }
  // geographic Polygon/MultiPolygon -> projected, decimated MultiPolygon [[ring,...],...]
  // splits rings at the antimeridian (big x-jumps) so dateline-crossing regions don't streak
  function geoToScreenMP(geo, proj, eps) {
    const polys = geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates;
    const SPLIT = W * 0.5;
    const mp = [];
    for (const rings of polys) {
      const outRings = [];
      for (const ring of rings) {
        let seg = [];
        let prev = null;
        for (const c of ring) {
          const p = proj(c);
          if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
          if (prev && Math.abs(p[0] - prev[0]) > SPLIT) {
            if (seg.length >= 4) outRings.push(decimateRing(seg, eps));
            seg = [];
          }
          seg.push(p);
          prev = p;
        }
        if (seg.length >= 4) outRings.push(decimateRing(seg, eps));
      }
      if (outRings.length) mp.push(outRings);
    }
    return mp;
  }
  function mpBounds(mp) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    mp.forEach((poly) => poly.forEach((ring) => ring.forEach((p) => {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    })));
    return [[x0, y0], [x1, y1]];
  }
  function mpCentroid(mp) {
    let best = null, bestA = -1;
    mp.forEach((poly) => { if (poly[0]) { const a = Math.abs(d3.polygonArea(poly[0])); if (a > bestA) { bestA = a; best = poly[0]; } } });
    if (!best) { const b = mpBounds(mp); return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; }
    const c = d3.polygonCentroid(best);
    return (c && isFinite(c[0])) ? c : best[0];
  }
  function pathFromMP(mp) {
    let d = "";
    mp.forEach((poly) => poly.forEach((ring) => {
      d += "M" + ring.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
    }));
    return d;
  }
  function pointInMP(x, y, mp) {
    let inside = false;
    for (const poly of mp) for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
      }
    }
    return inside;
  }
  // split an oversized region's screen MultiPolygon into ~k natural cells (Voronoi + clip)
  function subdivideRegion(screenMP, areaKm) {
    if (typeof polygonClipping === "undefined" || !d3.Delaunay) return null;
    const k = Math.max(2, Math.min(16, Math.round(areaKm / 200000)));
    const b = mpBounds(screenMP);
    const [minx, miny] = b[0], [maxx, maxy] = b[1];
    if (!isFinite(minx) || maxx - minx < 4 || maxy - miny < 4) return null;
    let seeds = [];
    let attempts = 0;
    while (seeds.length < k && attempts < 6000) {
      attempts++;
      const x = minx + Math.random() * (maxx - minx);
      const y = miny + Math.random() * (maxy - miny);
      if (pointInMP(x, y, screenMP)) seeds.push([x, y]);
    }
    if (seeds.length < 2) return null;
    const ext = [minx - 20, miny - 20, maxx + 20, maxy + 20];
    let vor;
    for (let it = 0; it < 2; it++) {
      vor = d3.Delaunay.from(seeds).voronoi(ext);
      seeds = seeds.map((s, i) => {
        const cell = vor.cellPolygon(i);
        if (!cell) return s;
        const ct = d3.polygonCentroid(cell);
        return (ct && pointInMP(ct[0], ct[1], screenMP)) ? ct : s;
      });
    }
    vor = d3.Delaunay.from(seeds).voronoi(ext);
    const feats = [];
    for (let i = 0; i < seeds.length; i++) {
      const cell = vor.cellPolygon(i);
      if (!cell) continue;
      let res;
      try { res = polygonClipping.intersection(screenMP, [[cell]]); } catch (e) { continue; }
      if (!res || !res.length) continue;
      feats.push(res);
    }
    return feats.length >= 2 ? feats : null;
  }

  async function buildStrategic() {
    if (Geo.cache.strategicV3) return Geo.cache.strategicV3;
    const admTopo = await getAdmin1Topo();
    const objName = Object.keys(admTopo.objects)[0];
    const obj = admTopo.objects[objName];
    const proj = d3.geoNaturalEarth1().fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" });
    const path = d3.geoPath(proj);
    const byCountry = {};
    obj.geometries.forEach((g) => {
      const pr = g.properties || {};
      const key = pr.admin || pr.geonunit || "?";
      (byCountry[key] = byCountry[key] || []).push(g);
    });
    const clusters = [];
    for (const country in byCountry) {
      const geoms = byCountry[country];
      const provs = geoms.map((g) => {
        const pr = g.properties || {};
        let c, areaKm = +pr.area_sqkm || 0;
        try {
          const f = topojson.feature(admTopo, g);
          c = path.centroid(f);
          if (!areaKm) areaKm = d3.geoArea(f) * 6371 * 6371;
        } catch (e) { c = [0, 0]; }
        return { g, c, area: areaKm || 1, name: pr.name || pr.name_local || pr.gn_name || pr.postal || country };
      });
      const totalArea = provs.reduce((s, p) => s + p.area, 0);
      const n = provs.length;
      // HoI4-state-scale target: real-region granularity, even across countries.
      let target = Math.round(Math.sqrt(totalArea) / 42);
      const floor = totalArea < 3000 ? 1 : totalArea < 40000 ? 2 : totalArea < 150000 ? 3 : 5;
      target = Math.max(floor, Math.min(80, target));
      let groups;
      if (n <= 1) {
        groups = [{ name: country, members: provs }];
      } else if (n <= target * 1.25) {
        // already a sensible number of real divisions — keep them (real names)
        groups = provs.map((p) => ({ name: p.name, members: [p] }));
      } else {
        // over-granular (municipality-level data) — merge adjacent units down to
        // area-appropriate states, preserving real outer boundaries
        groups = kmeansGroups(provs, Math.min(target, n));
      }
      groups.forEach((gr) => {
        const areaKm = gr.members.reduce((s, p) => s + p.area, 0);
        clusters.push({ name: gr.name, country, members: gr.members.map((p) => p.g), areaKm });
      });
    }
    Geo.cache.strategicV3 = { admTopo, clusters };
    return Geo.cache.strategicV3;
  }
  async function getAdmin1Topo() {
    if (Geo.cache.admin1topo) return Geo.cache.admin1topo;
    let raw = await fetchFirst(BASEMAPS.admin1.urls);
    try {
      if (topojson.presimplify && topojson.simplify) {
        raw = topojson.presimplify(raw);
        // gentle simplification: keep ~80% of points — preserves coastline detail
        // and keeps adjacent provinces sharing arcs so they tile without gaps
        const w = topojson.quantile(raw, 0.2);
        raw = topojson.simplify(raw, w);
      }
    } catch (e) { console.warn("simplify failed", e); }
    Geo.cache.admin1topo = raw;
    return raw;
  }

  Geo.load = async function (project) {
    const App = window.App;
    const id = project.basemapId;
    App.basemap = { status: "loading", features: [], byId: {}, sphere: "", graticule: "", count: 0, error: null, topo: null, topoObj: null, proj: null };
    App.emit();
    try {
      let result, topo = null, topoObj = null;
      const def = BASEMAPS[id];
      if (id === "custom" || !def || def.kind === "custom") {
        const gj = project.customGeo;
        if (!gj) throw new Error("no custom geo");
        // imported GeoJSON is now a fully editable region map (topology + edits)
        const built = buildEditableResult(gj, project, def || {}, pickLocalProjection(gj), null);
        result = built.result; topo = built.topo; topoObj = built.topoObj;
      } else if (def.kind === "blank") {
        // empty editable canvas for tracing a brand-new world over a backdrop
        const frame = identityFrame();
        const built = buildEditableResult({ type: "FeatureCollection", features: [] },
          project, def, frame, null);
        result = built.result; topo = built.topo; topoObj = built.topoObj;
        result.blankFrame = frame.frame;
      } else if (def.kind === "provgrid") {
        result = await buildProvinceGrid();
      } else if (def.kind === "voronoi") {
        result = await buildVoronoiProvinces(def.provinceCount || 4000);
      } else if (def.kind === "localgeo") {
        // local geographic GeoJSON (lon/lat): real admin units & region grids.
        // Edits are applied over the base; a client topology makes region /
        // coast / country borders render as SEPARATE layers, with full editing.
        const ck = "localgeo:" + def.dataset;
        const gj = Geo.cache[ck] || (Geo.cache[ck] = await fetchFirst(localCandidates(def.dataset)));
        // auto-detect lon/lat (Natural Earth) vs pixel coords (vectorized images)
        const built = buildEditableResult(gj, project, def, pickLocalProjection(gj), def.dataset);
        result = built.result; topo = built.topo; topoObj = built.topoObj;
      } else if (def.kind === "pixelgeo") {
        const provPath = project.provinceDataset || def.provinceDataset || project.baseMapDataset || def.dataset;
        const provCandidates = localCandidates(provPath)
          .concat(localCandidates(def.provinceFallbackDataset || def.fallbackDataset));
        const ck = "pixel:" + provPath;
        const gj = Geo.cache[ck] || (Geo.cache[ck] = await fetchFirst(provCandidates.filter(Boolean)));
        result = processPixelGeo(gj, { mapWidth: def.mapWidth, mapHeight: def.mapHeight });
        // remember how to load the matching region layer once the basemap is ready
        result.regionDatasets = localCandidates(project.regionDataset || def.regionDataset)
          .concat(localCandidates(def.regionFallbackDataset));
        result.regionProj = result.proj;
        result.physicalDatasets = localCandidates(def.physicalDataset);
      } else if (def.kind === "topo") {
        const raw = Geo.cache[id] || (Geo.cache[id] = await fetchFirst(def.urls));
        topoObj = raw.objects[def.object];
        const gj = topojson.feature(raw, topoObj);
        result = processGeo(gj, "topo");
        topo = raw;
      } else if (def.kind === "admin1") {
        const raw = await getAdmin1Topo();
        const objName = Object.keys(raw.objects)[0];
        topoObj = raw.objects[objName];
        const gj = topojson.feature(raw, topoObj);
        result = processGeo(gj, "topo");
        topo = raw;
      } else if (def.kind === "strategic") {
        const { admTopo, clusters } = await buildStrategic();
        const proj = d3.geoNaturalEarth1().fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" });
        const path = d3.geoPath(proj);
        const features = [], byId = {};
        const EPS = 0.9;          // border-cleaning decimation (px)
        const BIG = 320000;       // km² above which a region is synthetically subdivided
        let idx = 0;
        clusters.forEach((cl) => {
          let merged;
          try { merged = topojson.merge(admTopo, cl.members); } catch (e) { return; }
          const screenMP = geoToScreenMP(merged, proj, EPS);
          if (!screenMP.length) return;
          const pushFeat = (mp, name) => {
            const d = pathFromMP(mp);
            if (!d) return;
            const b = mpBounds(mp);
            const area = Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
            const id = "sr" + (idx++);
            const feat = { id, name, country: cl.country, d, c: mpCentroid(mp), b, area };
            features.push(feat); byId[id] = feat;
          };
          let cells = null;
          if (cl.areaKm > BIG) {
            try { cells = subdivideRegion(screenMP, cl.areaKm); } catch (e) { cells = null; }
          }
          if (cells) cells.forEach((mp) => pushFeat(mp, cl.name));
          else pushFeat(screenMP, cl.name);
        });
        result = {
          features, byId,
          sphere: path({ type: "Sphere" }),
          graticule: path(d3.geoGraticule10()),
          path, proj
        };
        // strategic uses per-region strokes (no topo mesh) so synthetic borders render
        topo = null; topoObj = null;
      } else if (def.kind === "hybrid") {
        const d110 = BASEMAPS["world-110"];
        const raw110 = Geo.cache["world-110"] || (Geo.cache["world-110"] = await fetchFirst(d110.urls));
        const admTopo = await getAdmin1Topo();
        const admObj = admTopo.objects[Object.keys(admTopo.objects)[0]];
        const countries = topojson.feature(raw110, raw110.objects[d110.object]).features
          .filter((f) => !HYBRID_BIG.has((f.properties || {}).name))
          .map((f) => ({ ...f, id: String(f.id), properties: { ...f.properties, admin: (f.properties || {}).name } }));
        const provinces = topojson.feature(admTopo, admObj).features
          .filter((f) => HYBRID_BIG.has((f.properties || {}).admin))
          .map((f) => ({ ...f, id: String(f.id ?? (f.properties || {}).adm1_code ?? "") }));
        let merged = { type: "FeatureCollection", features: countries.concat(provinces) };
        // build a client-side topology so the hybrid map gets crisp meshed borders + merge support
        if (Geo.cache.hybridTopo) {
          topo = Geo.cache.hybridTopo;
        } else if (topojson.topology) {
          try { topo = Geo.cache.hybridTopo = topojson.topology({ regions: merged }, 1e5); } catch (e) { console.warn("hybrid topology failed", e); }
        }
        if (topo) {
          topoObj = topo.objects.regions;
          result = processGeo(topojson.feature(topo, topoObj), "topo");
        } else {
          result = processGeo(merged, "geo");
        }
      } else {
        const raw = Geo.cache[id] || (Geo.cache[id] = await fetchFirst(def.urls));
        result = processGeo(raw, "geo");
      }
      // Land underlay: one merged landmass path drawn behind all regions so any
      // sub-pixel sliver between adjacent province fills shows land, never sea.
      let landPath = result.landPath || null;
      try {
        if (!landPath && topo && topoObj && topoObj.geometries) {
          landPath = result.path(topojson.merge(topo, topoObj.geometries));
        }
      } catch (e) { /* non-fatal */ }
      // Coastline stroke for region-grid maps: the merged land contains thousands
      // of microscopic sliver holes where neighbours' borders do not coincide —
      // stroking them paints dash artifacts all over the map. Keep only rings
      // that are big and compact enough to be real coast (continents, islands).
      let coastPath = null;
      if (landPath && result.raw) {
        try {
          let d = "";
          parsePathRings(landPath).forEach((ring) => {
            let area = 0, per = 0;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
              per += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
            }
            area = Math.abs(area / 2);
            if (area < 3) return;                                    // speck / pinhole
            if (per > 0 && (4 * Math.PI * area) / (per * per) < 0.06 && area < 80) return; // thin sliver
            d += "M" + ring.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z";
          });
          coastPath = d || null;
        } catch (e) { coastPath = null; }
      }

      App.basemap = {
        status: "ready",
        features: result.features,
        byId: result.byId,
        clusterOf: result.clusterOf || null,
        landPath,
        coastPath,
        clipLand: !!result.clipLand,
        clips: result.clips || null,
        staticBorders: result.staticBorders || null,
        sphere: result.sphere,
        graticule: result.graticule,
        count: result.features.length,
        error: null,
        topo, topoObj,
        path: result.path,
        proj: result.proj,
        raw: result.raw || null,
        rawById: null,
        physicalRaw: null
      };
      if (result.raw) {
        const m = {};
        result.raw.features.forEach((f) => {
          const fid = String((f.id != null ? f.id : (f.properties || {}).id) || "");
          if (fid) m[fid] = f;
        });
        App.basemap.rawById = m;
        if (window.GeomEdit) { GeomEdit.invalidateSnap(); GeomEdit.invalidateHit(); }
      }
      App.emit();

      // ----- physical geography layers (atlas maps) -----
      App.physical = { status: "idle", rivers: [], lakes: [], relief: [], seas: [] };
      if (result.physicalDatasets && result.physicalDatasets.length) {
        App.physical.status = "loading";
        try {
          const pck = "phys:" + result.physicalDatasets[0];
          const pgj = Geo.cache[pck] || (Geo.cache[pck] = await fetchFirst(result.physicalDatasets.filter(Boolean)));
          const ph = processPhysical(pgj, result.proj);
          App.physical = { status: "ready", rivers: ph.rivers, lakes: ph.lakes, relief: ph.relief, seas: ph.seas };
          if (ph.landPath && !App.basemap.landPath) App.basemap.landPath = ph.landPath;
          App.emit();
        } catch (e) {
          console.warn("physical layer load failed", e);
          App.physical = { status: "error", rivers: [], lakes: [], relief: [], seas: [] };
        }
      }

      // ----- physical display layers (rivers / lakes / mountains) -----
      App.basemap.physical = null;
      if (result.physicalDefs) {
        try {
          const pdefs = result.physicalDefs;
          const keys = ["rivers", "lakes", "mountains"];
          const loaded = await Promise.all(keys.map(async (k) => {
            if (!pdefs[k]) return null;
            const ck = "phys:" + pdefs[k];
            return Geo.cache[ck] || (Geo.cache[ck] = await fetchFirst(localCandidates(pdefs[k])));
          }));
          const phys = {}, physRaw = {};
          keys.forEach((k, i) => {
            const gj = loaded[i];
            if (!gj) return;
            let d = "";
            gj.features.forEach((f) => {
              if (!f.geometry) return;
              try { const p = result.path(f); if (p) d += p; } catch (e) {}
            });
            phys[k] = d;
            physRaw[k] = gj;
          });
          App.basemap.physical = phys;
          App.basemap.physicalRaw = physRaw;
          if (window.GeomEdit) GeomEdit.invalidateSnap();
          App.emit();
        } catch (e) { console.warn("physical layers failed", e); }
      }

      // ----- regular state-region layer (loaded above provinces) -----
      App.regionData = { status: "idle", regions: [], byId: {}, provinceToRegion: {} };
      if (result.regionDatasets && result.regionDatasets.length) {
        App.regionData.status = "loading";
        App.emit();
        try {
          const rck = "regions:" + result.regionDatasets[0];
          const rgj = Geo.cache[rck] || (Geo.cache[rck] = await fetchFirst(result.regionDatasets.filter(Boolean)));
          const rd = processRegions(rgj, result.regionProj || result.proj, App.basemap.byId);
          // each province learns its default state region id
          for (const fid in rd.provinceToRegion) {
            const f = App.basemap.byId[fid];
            if (f) f.defaultRegionId = rd.provinceToRegion[fid];
          }
          App.regionData = { status: "ready", regions: rd.regions, byId: rd.byId, provinceToRegion: rd.provinceToRegion };
          if (window.RegionModel) window.RegionModel.ensureStateLayer();
          App.regionVersion = (App.regionVersion || 0) + 1;
          App.emit();
        } catch (e) {
          console.warn("region layer load failed", e);
          App.regionData = { status: "error", regions: [], byId: {}, provinceToRegion: {}, error: String(e) };
          App.emit();
        }
      }
    } catch (e) {
      console.error("basemap load failed", e);
      App.basemap.status = "error";
      App.basemap.error = String(e);
      App.emit();
    }
  };

  // Border meshes for topo basemaps (crisp cartographic borders)
  function geomId(g) {
    const pr = g.properties || {};
    return String(g.id ?? pr.adm1_code ?? pr.ne_id ?? pr.id ?? "");
  }
  Geo.coastMesh = function () {
    const { topo, topoObj, path } = window.App.basemap;
    if (!topo) return null;
    return path(topojson.mesh(topo, topoObj, (a, b) => a === b));
  };
  Geo.innerMesh = function (unitOf) {
    const { topo, topoObj, path } = window.App.basemap;
    if (!topo) return null;
    if (!unitOf) return path(topojson.mesh(topo, topoObj, (a, b) => a !== b));
    return path(topojson.mesh(topo, topoObj, (a, b) => a !== b && unitOf(geomId(a)) !== unitOf(geomId(b))));
  };
  Geo.stateMesh = function (ownerOf) {
    const { topo, topoObj, path } = window.App.basemap;
    if (!topo) return null;
    return path(topojson.mesh(topo, topoObj, (a, b) => a !== b && ownerOf(geomId(a)) !== ownerOf(geomId(b))));
  };
})();
