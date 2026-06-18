#!/usr/bin/env python3
# AtlasForge — repair a region GeoJSON for clean rendering:
#   1) drop degenerate "needle" parts and micro-rings (the dash/sliver artifacts);
#   2) snap each region's vertices onto its neighbours (closes the blue gap
#      wedges left by per-feature simplification);
#   3) fix validity, normalize d3 winding, round coordinates.
# The source file is never modified. Usage:
#   python3 tools/repair_region_dataset.py IN.geojson OUT.geojson
import json, math, sys
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, snap
from shapely.strtree import STRtree

IN = sys.argv[1] if len(sys.argv) > 1 else "data/best_regions_world_simplified.geojson"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/best_regions_world_repaired.geojson"

SNAP_TOL = 0.025        # ° — close gaps up to ~2.5 km
MIN_RING_AREA = 1e-5    # sq° — micro rings/holes (~0.1 km²)
NEEDLE_AREA = 0.006     # sq° — sliver candidates below this size...
NEEDLE_THIN = 0.07      # ...with isoperimetric ratio 4πA/P² below this are needles

def is_needle(p):
    a = p.area
    if a <= MIN_RING_AREA: return True
    per = p.length
    return a < NEEDLE_AREA and per > 0 and (4 * math.pi * a) / (per * per) < NEEDLE_THIN

def clean_parts(geom):
    if geom is None or geom.is_empty: return None
    parts = [geom] if geom.geom_type == "Polygon" else \
            list(geom.geoms) if geom.geom_type == "MultiPolygon" else []
    out = []
    for p in parts:
        if is_needle(p): continue
        # drop micro holes AND needle holes (thin slivers inside the region —
        # they render as scattered dash artifacts)
        holes = [h for h in p.interiors if not is_needle(Polygon(h))]
        out.append(Polygon(p.exterior, holes))
    if not out: return None
    return out[0] if len(out) == 1 else MultiPolygon(out)

def orient_d3(geom):
    if geom.geom_type == "Polygon": return orient(geom, sign=-1.0)
    if geom.geom_type == "MultiPolygon":
        return MultiPolygon([orient(g, sign=-1.0) for g in geom.geoms])
    return geom

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], 4), round(o[1], 4)]
        return [round_coords(x) for x in o]
    return o

print("loading", IN, flush=True)
gj = json.load(open(IN))
feats = gj["features"]

geoms, props, dropped_feats = [], [], 0
for f in feats:
    if not f.get("geometry"):
        dropped_feats += 1; continue
    try:
        g = shape(f["geometry"])
        if not g.is_valid: g = g.buffer(0)
        g = clean_parts(g)
    except Exception:
        g = None
    if g is None or g.is_empty:
        dropped_feats += 1; continue
    geoms.append(g)
    props.append(f.get("properties") or {})
print(f"features kept: {len(geoms)}  (dropped sliver-only/broken: {dropped_feats})", flush=True)

# neighbour snapping (sequential: later features snap onto already-snapped ones)
tree = STRtree(geoms)
snapped = list(geoms)
report_moved = 0
for i, g in enumerate(geoms):
    try:
        idx = [int(j) for j in tree.query(g.buffer(SNAP_TOL))]
    except Exception:
        idx = []
    neigh = [snapped[j] for j in idx if j != i]
    if not neigh: continue
    try:
        target = unary_union(neigh)
        g2 = snap(g, target, SNAP_TOL)
        if not g2.is_valid: g2 = g2.buffer(0)
        g2 = clean_parts(g2)
        if g2 is not None and not g2.is_empty:
            if g2 is not g: report_moved += 1
            snapped[i] = g2
    except Exception:
        continue
    if i and i % 500 == 0: print(f"  snapped {i}/{len(geoms)}", flush=True)
print(f"snapped features: {report_moved}", flush=True)

out_feats = []
for g, p in zip(snapped, props):
    gm = mapping(orient_d3(g))
    gm["coordinates"] = round_coords(gm["coordinates"])
    fid = p.get("id")
    out_feats.append({"type": "Feature", "id": fid, "geometry": gm, "properties": p})

json.dump({"type": "FeatureCollection", "features": out_feats},
          open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
import os
print(f"wrote {OUT}: {len(out_feats)} features, {os.path.getsize(OUT)/1e6:.1f} MB")
