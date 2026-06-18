#!/usr/bin/env python3
# AtlasForge — vectorize the flat colour-coded Old World Blues region map into an
# editable GeoJSON region layer. Each connected colour blob becomes one polygon
# region that keeps its original colour. White is treated as background (sea/gaps).
import json, sys, time
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

SRC = sys.argv[1] if len(sys.argv) > 1 else "owb-state-and-nation-map-for-easier-map-making-v0-aj8gu21bbgb91.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/owb_north_america.geojson"
DOWN = 2          # downscale factor (4367x2304 -> ~2183x1152)
QSTEP = 14        # colour quantization step (region grouping tolerance)
MIN_AREA = 24     # min component area in downscaled pixels (drop noise/slivers)
SIMPLIFY = 1.2    # polygon simplification (downscaled px)

t0 = time.time()
print("loading", SRC, flush=True)
im = Image.open(SRC).convert("RGBA")
if DOWN > 1:
    im = im.resize((im.width // DOWN, im.height // DOWN), Image.NEAREST)
arr = np.asarray(im)
H, Wd = arr.shape[0], arr.shape[1]
rgb = arr[:, :, :3].astype(np.int32)
alpha = arr[:, :, 3]
print("size", Wd, "x", H, flush=True)

# background = transparent or near-white
mn = rgb.min(axis=2)
bg = (alpha < 128) | (mn > 228)

# quantize colours to group flat fills (anti-aliasing collapses onto the fill)
q = (rgb // QSTEP)
qid = (q[:, :, 0] * 4096 + q[:, :, 1] * 64 + q[:, :, 2]).astype(np.int32)
qid[bg] = -1

struct = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=np.int8)  # 4-connectivity
labels = np.zeros((H, Wd), np.int32)
meta = {}   # gid -> color(hex)
gid = 0
vals = np.unique(qid)
print("distinct quantized colours:", len(vals), flush=True)
for v in vals:
    if v < 0:
        continue
    m = qid == v
    lab, n = ndimage.label(m, structure=struct)
    if n == 0:
        continue
    areas = np.bincount(lab.ravel())
    for ci in range(1, n + 1):
        if areas[ci] < MIN_AREA:
            continue
        gid += 1
        sel = lab == ci
        labels[sel] = gid
        # representative flat colour = median of original pixels in the blob
        px = rgb[sel]
        col = np.median(px, axis=0).astype(int)
        meta[gid] = "#%02x%02x%02x" % (int(col[0]), int(col[1]), int(col[2]))
print("regions found:", gid, "(%.1fs)" % (time.time() - t0), flush=True)

# component bounding boxes for fast cropping
objs = ndimage.find_objects(labels)

def mask_to_poly(mask, x0, y0):
    boxes = []
    Hh = mask.shape[0]
    for r in range(Hh):
        row = mask[r]
        # run-length of True spans on this row -> unit-height rectangles
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        starts = np.where(d == 1)[0]
        ends = np.where(d == -1)[0]
        for c0, c1 in zip(starts, ends):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes:
        return None
    poly = unary_union(boxes)
    poly = poly.simplify(SIMPLIFY, preserve_topology=True)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty else None

def orient_d3(g):
    if g.geom_type == "Polygon":
        return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon":
        from shapely.geometry import MultiPolygon
        return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], 1), round(o[1], 1)]
        return [round_coords(x) for x in o]
    return o

feats = []
for g in range(1, gid + 1):
    sl = objs[g - 1]
    if sl is None:
        continue
    y0, x0 = sl[0].start, sl[1].start
    mask = labels[sl] == g
    poly = mask_to_poly(mask, x0, y0)
    if poly is None or poly.area < MIN_AREA * 0.5:
        continue
    geom = mapping(orient_d3(poly))
    geom["coordinates"] = round_coords(geom["coordinates"])
    feats.append({
        "type": "Feature", "id": "owb%d" % g,
        "geometry": geom,
        "properties": {"id": "owb%d" % g, "name": "Region %d" % g, "color": meta[g],
                       "ownerCountryId": None, "notes": ""}
    })

json.dump({"type": "FeatureCollection", "features": feats},
          open(OUT, "w"), separators=(",", ":"))
import os
print("wrote %s: %d regions, %.1f MB (%.1fs)" %
      (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
