#!/usr/bin/env python3
# Physical-geography layers for the real-world map (world_hoi4), from the HOI4
# real-world mod's terrain.bmp. Mirrors tools/build_owb_terrain.py but with the
# vanilla-HOI4 palette and a WORLD georef for rivers.
# Output coords match data/world_hoi4_states.geojson (terrain.bmp 5120x2560 /2 =
# 2560x1280, the same frame world_hoi4_states uses).
import json, os, time
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from shapely.affinity import scale as shp_scale

SRC = "World_helping_files/terrain.bmp"
RIVERS_BMP = "World_helping_files/rivers.bmp"  # REAL game rivers (same frame as provinces -> perfect alignment)
OUT = "data/world_hoi4_physical.geojson"
DOWN = 2          # terrain 5120x2560 -> 2560x1280 (matches world_hoi4_states frame)
COORD_SCALE = 0.5 # rivers.bmp is read at FULL res (so 1px rivers survive) then scaled to the /2 frame

# vanilla-HOI4 terrain palette (index groups -> type). See the palette dump:
# 15=ocean, 0/4/17=plains(base, untinted), 1/20=forest, 2/6/8/11/83=hills+mountain,
# 3/7/13/31=desert/arid, 9=lakes, 16=snow(skip -> keeps Greenland neutral).
CATS = [
    {"name": "mountain_range", "idx": [2, 6, 8, 11, 83], "close": 2, "open": 1, "min": 40,  "simp": 2.5, "major": 12000},
    {"name": "forest",         "idx": [1, 20],           "close": 2, "open": 1, "min": 140, "simp": 3.0, "major": 1e9},
    {"name": "desert",         "idx": [3, 7, 13, 31],    "close": 2, "open": 1, "min": 140, "simp": 3.0, "major": 1e9},
    {"name": "lake",           "idx": [9],               "close": 1, "open": 0, "min": 8,   "simp": 1.4, "major": 1600},
]

t0 = time.time()
im = Image.open(SRC)
assert im.mode == "P", "terrain.bmp must be palette, got %s" % im.mode
if DOWN > 1:
    im = im.resize((im.width // DOWN, im.height // DOWN), Image.NEAREST)
idx = np.asarray(im)
H, W = idx.shape
print("terrain %dx%d (%.1fs)" % (W, H, time.time() - t0), flush=True)
STRUCT8 = ndimage.generate_binary_structure(2, 2)


def mask_to_poly(mask, x0, y0, simp):
    boxes = []
    for r in range(mask.shape[0]):
        row = mask[r]
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        for c0, c1 in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes:
        return None
    poly = unary_union(boxes)
    if simp:
        poly = poly.simplify(simp, preserve_topology=True)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty else None


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


feats = []
for cat in CATS:
    mask = np.isin(idx, cat["idx"])
    raw_px = int(mask.sum())
    if cat["close"]:
        mask = ndimage.binary_closing(mask, STRUCT8, iterations=cat["close"])
    if cat["open"]:
        mask = ndimage.binary_opening(mask, STRUCT8, iterations=cat["open"])
    lab, n = ndimage.label(mask, STRUCT8)
    objs = ndimage.find_objects(lab)
    kept = 0
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        y0, x0 = sl[0].start, sl[1].start
        sub = lab[sl] == i
        if int(sub.sum()) < cat["min"]:
            continue
        poly = mask_to_poly(sub, x0, y0, cat["simp"])
        if poly is None or poly.area < cat["min"] * 0.5:
            continue
        imp = "major" if poly.area >= cat["major"] else ("medium" if poly.area >= cat["major"] * 0.3 else "minor")
        gm = mapping(orient_d3(poly))
        gm["coordinates"] = round_coords(gm["coordinates"])
        fid = "%s%d" % (cat["name"][:3], kept)
        feats.append({"type": "Feature", "id": fid, "geometry": gm,
                      "properties": {"id": fid, "type": cat["name"], "importance": imp, "name": "", "name_ru": None}})
        kept += 1
    print("  %-14s px=%-8d -> %d (%.1fs)" % (cat["name"], raw_px, kept, time.time() - t0), flush=True)


def add_game_rivers():
    # The REAL game rivers from rivers.bmp. Same image frame as provinces.bmp, so
    # scaling x0.5 lands them exactly on the world_hoi4 coastlines — no georef.
    if not os.path.exists(RIVERS_BMP):
        print("  rivers.bmp missing, skipped", flush=True); return 0
    rim = Image.open(RIVERS_BMP)
    assert rim.mode == "P", "rivers.bmp must be palette"
    ra = np.asarray(rim)                 # FULL res 5120x2560 (1px rivers must survive)
    rmask = ra < 12                      # river pixels = palette 0..11 (land=254, sea=255)
    # bridge 1px gaps with 4-connectivity (orthogonal only) so dense parallel
    # rivers don't merge into blobs the way 8-connectivity dilation does.
    rmask = ndimage.binary_dilation(rmask, ndimage.generate_binary_structure(2, 1), iterations=1)
    lab, n = ndimage.label(rmask, STRUCT8)
    objs = ndimage.find_objects(lab)
    added = 0
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        y0, x0 = sl[0].start, sl[1].start
        sub = lab[sl] == i
        npx = int(sub.sum())
        if npx < 8:
            continue
        poly = mask_to_poly(sub, x0, y0, 1.2)         # full-res ribbon
        if poly is None:
            continue
        poly = shp_scale(poly, xfact=COORD_SCALE, yfact=COORD_SCALE, origin=(0, 0))  # -> /2 frame
        imp = "major" if npx >= 9000 else ("medium" if npx >= 1200 else "minor")
        gm = mapping(orient_d3(poly))
        gm["coordinates"] = round_coords(gm["coordinates"])
        feats.append({"type": "Feature", "id": "riv%d" % added, "geometry": gm,
                      "properties": {"id": "riv%d" % added, "type": "river", "importance": imp, "name": "", "name_ru": None}})
        added += 1
    print("  river (game)   -> %d (%.1fs)" % (added, time.time() - t0), flush=True)
    return added


add_game_rivers()
os.makedirs("data", exist_ok=True)
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
print("wrote %s: %d features, %.2f MB (%.1fs)" %
      (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
