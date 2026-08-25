#!/usr/bin/env python3
# AtlasForge — physical-geography layers for the A Game of Thrones map, in the
# SAME pixel frame as tools/build_agot_from_mod.py (so they overlay pixel-perfect)
# and off the SAME composited source (tools/agot_source.py: base mod + submod):
#   rivers  <- rivers.png (the real game river ribbons) + the `river_provinces`
#              from default.map (the wide, navigable rivers: Trident, Rhoyne…)
#   lakes   <- the `lakes` provinces (Gods Eye, the Ice Lakes…)
#   mountain_range <- the `impassable_mountains` provinces PLUS the high ground
#              read off heightmap.png (the Vale, the Red Mountains, the Bones…)
# Output: data/agot_physical.geojson
import json, os, sys, time
import numpy as np
from scipy import ndimage
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.affinity import scale as shp_scale
from shapely.geometry.polygon import orient
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agot_source import load as load_source, composite_image

SRC = sys.argv[1] if len(sys.argv) > 1 else "map_data_agot"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/agot_physical.geojson"
COORD_SCALE = 0.25
NDIG = 2
STRUCT8 = ndimage.generate_binary_structure(2, 2)

t0 = time.time()
def log(m): print(m, flush=True)

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon": return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], NDIG), round(o[1], NDIG)]
        return [round_coords(x) for x in o]
    return o

def mask_to_poly(mask, x0, y0, simp=0.0):
    boxes = []
    for r in range(mask.shape[0]):
        row = mask[r]
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        s = np.where(d == 1)[0]; e = np.where(d == -1)[0]
        for c0, c1 in zip(s, e):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes: return None
    poly = unary_union(boxes)
    if simp: poly = poly.simplify(simp, preserve_topology=True)
    if not poly.is_valid: poly = poly.buffer(0)
    return None if poly.is_empty else poly

feats = []
def emit(poly, kind, imp, name=""):
    poly = shp_scale(poly, xfact=COORD_SCALE, yfact=COORD_SCALE, origin=(0, 0))
    gm = mapping(orient_d3(poly)); gm["coordinates"] = round_coords(gm["coordinates"])
    fid = "%s%d" % (kind[:3], len(feats))
    feats.append({"type": "Feature", "id": fid, "geometry": gm,
                  "properties": {"id": fid, "type": kind, "importance": imp,
                                 "name": name, "name_ru": None}})

st = load_source(SRC, log)
pid_img, W, H, MAXPID = st["pid"], st["W"], st["H"], st["maxpid"]
pidc = np.clip(pid_img, 0, MAXPID + 1)
log("source raster ready (%.1fs)" % (time.time() - t0))

def province_mask(pids):
    lut = np.zeros(MAXPID + 2, bool)
    for p in pids:
        if 0 <= p <= MAXPID + 1: lut[p] = True
    return lut[pidc] & (pid_img >= 0)

def emit_components(mask, kind, min_px, major_px, medium_px, simp=1.2, close=0):
    if close: mask = ndimage.binary_closing(mask, STRUCT8, close)
    lab, n = ndimage.label(mask, STRUCT8)
    objs = ndimage.find_objects(lab)
    kept = 0
    for i, sl in enumerate(objs, start=1):
        if sl is None: continue
        sub = lab[sl] == i
        npx = int(sub.sum())
        if npx < min_px: continue
        poly = mask_to_poly(sub, sl[1].start, sl[0].start, simp)
        if poly is None: continue
        emit(poly, kind, "major" if npx >= major_px else ("medium" if npx >= medium_px else "minor"))
        kept += 1
    log("  %-14s -> %d (%.1fs)" % (kind, kept, time.time() - t0))
    return kept

emit_components(province_mask(st["lake"]),  "lake",  40, 40000, 6000, simp=1.4)
emit_components(province_mask(st["river"]), "river", 40, 60000, 12000, simp=1.2)

# ---------------------------------------------------------------- drawn rivers
ra = composite_image(st, "rivers.png")
rmask = ra < 16          # 0=source 1=merge 2=split 3..11 widths, 254=land 255=sea
del ra
# bridge 1px gaps orthogonally so dense parallel rivers don't fuse into blobs
rmask = ndimage.binary_dilation(rmask, ndimage.generate_binary_structure(2, 1), 1)
emit_components(rmask, "river", 60, 40000, 6000, simp=1.2)
del rmask

# ---------------------------------------------------------------- mountains
land = ~province_mask(st["water"]) & (pid_img >= 0)
hm = composite_image(st, "heightmap.png").astype(np.uint16)
lv = hm[land]
thr = float(np.percentile(lv, 88))
log("heightmap: land median %d, mountain threshold %d (top 12%% of land) (%.1fs)"
    % (int(np.median(lv)), int(thr), time.time() - t0))
high = ((hm >= thr) & land) | province_mask(st["mount"])
del hm, lv
high = ndimage.binary_opening(ndimage.binary_closing(high, STRUCT8, 3), STRUCT8, 2)
emit_components(high, "mountain_range", 900, 260000, 40000, simp=2.5)
del high, land

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
log("wrote %s: %d features, %.1f MB (%.1fs)" % (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
