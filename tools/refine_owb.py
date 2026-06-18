#!/usr/bin/env python3
# AtlasForge — refine the vectorized OWB map: subdivide oversized regions into
# province-sized cells (Voronoi, Lloyd-relaxed) so granularity is even, keeping
# each piece's parent colour (subtle jitter so neighbours are distinguishable).
# Output is then run through mapshaper (-clean -simplify) for smooth SHARED
# borders. The source ids change (fresh sequential owbN).
import json, sys
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, Point
from shapely.geometry.polygon import orient
from scipy.spatial import Voronoi

IN = sys.argv[1] if len(sys.argv) > 1 else "data/owb_north_america.geojson"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/owb_tmp.geojson"
TARGET = 1500.0      # target sub-region area (px^2) — matches the western provinces
SPLIT_AT = 2600.0    # only subdivide parts bigger than this
MAXK = 40

rng = np.random.default_rng(7)

def far(minx, miny, maxx, maxy):
    dx, dy = (maxx - minx) * 5 + 10, (maxy - miny) * 5 + 10
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    return [[cx - dx, cy - dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]]

def cells_for(seeds, bbox, poly):
    pts = np.vstack([seeds, far(*bbox)])
    vor = Voronoi(pts)
    out = []
    for i in range(len(seeds)):
        reg = vor.regions[vor.point_region[i]]
        if not reg or -1 in reg:
            out.append(None); continue
        try:
            cell = Polygon([vor.vertices[v] for v in reg])
            cl = cell.intersection(poly)
        except Exception:
            cl = None
        out.append(cl if (cl and not cl.is_empty) else None)
    return out

def subdivide(poly, k):
    minx, miny, maxx, maxy = poly.bounds
    bbox = (minx, miny, maxx, maxy)
    seeds = []
    tries = 0
    while len(seeds) < k and tries < k * 400:
        tries += 1
        x = rng.uniform(minx, maxx); y = rng.uniform(miny, maxy)
        if poly.contains(Point(x, y)):
            seeds.append([x, y])
    if len(seeds) < 2:
        return [poly]
    seeds = np.array(seeds)
    for _ in range(3):  # Lloyd relaxation -> even cells
        cl = cells_for(seeds, bbox, poly)
        ns = []
        for i, c in enumerate(cl):
            if c is None:
                ns.append(seeds[i]); continue
            p = c.representative_point()
            ns.append([p.x, p.y])
        seeds = np.array(ns)
    cl = cells_for(seeds, bbox, poly)
    parts = []
    for c in cl:
        if c is None:
            continue
        if c.geom_type == "Polygon":
            parts.append(c)
        elif c.geom_type in ("MultiPolygon", "GeometryCollection"):
            for g in c.geoms:
                if g.geom_type == "Polygon" and g.area > 1:
                    parts.append(g)
    return parts if len(parts) >= 2 else [poly]

def jitter(hexc, idx):
    h = hexc.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    d = ((idx * 37) % 21) - 10
    cl = lambda v: max(0, min(255, v + d))
    return "#%02x%02x%02x" % (cl(r), cl(g), cl(b))

def orient_d3(g):
    if g.geom_type == "Polygon":
        return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon":
        return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], 1), round(o[1], 1)]
        return [round_coords(x) for x in o]
    return o

src = json.load(open(IN))
out, nid, nsplit = [], 0, 0
for f in src["features"]:
    geom = shape(f["geometry"])
    color = f["properties"].get("color") or "#888888"
    parts = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    pieces = []
    for part in parts:
        if part.area > SPLIT_AT:
            k = int(min(MAXK, max(2, round(part.area / TARGET))))
            subs = subdivide(part, k)
            if len(subs) >= 2:
                nsplit += 1
            pieces.extend(subs)
        else:
            pieces.append(part)
    for j, pc in enumerate(pieces):
        if pc.is_empty or pc.area < 1:
            continue
        if not pc.is_valid:
            pc = pc.buffer(0)
            if pc.is_empty:
                continue
        nid += 1
        gm = mapping(orient_d3(pc))
        gm["coordinates"] = round_coords(gm["coordinates"])
        out.append({"type": "Feature", "id": "owb%d" % nid, "geometry": gm,
                    "properties": {"id": "owb%d" % nid, "name": "Region %d" % nid,
                                   "color": jitter(color, j) if len(pieces) > 1 else color,
                                   "ownerCountryId": None, "notes": ""}})

json.dump({"type": "FeatureCollection", "features": out}, open(OUT, "w"), separators=(",", ":"))
import os
print("subdivided %d oversized parts -> %d regions total, %.1f MB" %
      (nsplit, len(out), os.path.getsize(OUT) / 1e6))
