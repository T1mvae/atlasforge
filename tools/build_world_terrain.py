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
from scipy.interpolate import RBFInterpolator
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

SRC = "World_helping_files/terrain.bmp"
RIVERS_NE = "tools/cache/rivers-50m.json"
OUT = "data/world_hoi4_physical.geojson"
DOWN = 2  # 5120x2560 -> 2560x1280 (matches world_hoi4_states frame)

# vanilla-HOI4 terrain palette (index groups -> type). See the palette dump:
# 15=ocean, 0/4/17=plains(base, untinted), 1/20=forest, 2/6/8/11/83=hills+mountain,
# 3/7/13/31=desert/arid, 9=lakes, 16=snow(skip -> keeps Greenland neutral).
CATS = [
    {"name": "mountain_range", "idx": [2, 6, 8, 11, 83], "close": 2, "open": 1, "min": 40,  "simp": 2.5, "major": 12000},
    {"name": "forest",         "idx": [1, 20],           "close": 2, "open": 1, "min": 140, "simp": 3.0, "major": 1e9},
    {"name": "desert",         "idx": [3, 7, 13, 31],    "close": 2, "open": 1, "min": 140, "simp": 3.0, "major": 1e9},
    {"name": "lake",           "idx": [9],               "close": 1, "open": 0, "min": 8,   "simp": 1.4, "major": 1600},
]

# WORLD georef control points: state pixel centroid (2560x1280 frame) -> (lon, lat).
# Used INVERTED (lon/lat -> pixel) to drape the Natural Earth river network on the
# HOI4 world projection. Compact states chosen for accuracy; global spread.
GEOREF_CP = [
    ((1071, 272), (-19, 65)), ((1149, 395), (-8, 53)), ((1277, 329), (9, 61)),
    ((1315, 303), (15, 62)), ((1346, 411), (19, 52)), ((1285, 496), (12, 42)),
    ((1300, 537), (14, 37)), ((1376, 556), (25, 35)), ((1437, 556), (33, 35)),
    ((1267, 548), (10, 34)), ((1233, 761), (8, 9)), ((1531, 952), (47, -19)),
    ((1426, 520), (35, 39)), ((802, 436), (-56, 48)), ((701, 367), (-72, 52)),
    ((493, 413), (-98, 55)), ((97, 213), (-152, 64)), ((358, 552), (-119, 37)),
    ((393, 613), (-113, 27)), ((524, 592), (-99, 31)), ((620, 612), (-81, 28)),
    ((567, 671), (-89, 20)), ((646, 662), (-79, 22)), ((931, 876), (-37, -8)),
    ((649, 887), (-75, -10)), ((718, 1104), (-69, -45)), ((765, 1085), (-64, -38)),
    ((1828, 574), (88, 31)), ((1979, 679), (109, 19)), ((2059, 642), (121, 23)),
    ((2132, 581), (131, 32)), ((2196, 532), (140, 38)), ((2062, 692), (121, 16)),
    ((1955, 448), (104, 46)), ((2262, 992), (146, -23)), ((2027, 1022), (122, -25)),
    ((2242, 1136), (146, -42)), ((2449, 1120), (172, -42)),
    # densification (confident compact states)
    ((1283, 375), (10, 56)), ((1365, 495), (25, 43)), ((1452, 569), (36, 34)),
    ((1264, 514), (9, 40)), ((1514, 502), (43, 42)), ((491, 672), (-102, 23)),
    ((681, 771), (-74, 4)), ((727, 745), (-66, 7)), ((696, 1062), (-71, -35)),
    ((1440, 600), (34, 29)), ((1324, 880), (18, -12)), ((792, 1066), (-56, -33)),
    ((2218, 486), (143, 43)), ((2086, 767), (125, 8)), ((2210, 878), (141, -5)),
    ((1650, 412), (68, 48)), ((1660, 499), (64, 41)), ((1570, 545), (53, 32)),
    ((1517, 571), (44, 33)),
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


def add_ne_rivers():
    if not os.path.exists(RIVERS_NE):
        print("  rivers: %s missing, skipped" % RIVERS_NE, flush=True); return 0
    ll = np.array([c[1] for c in GEOREF_CP], float)
    xy = np.array([c[0] for c in GEOREF_CP], float)
    rx = RBFInterpolator(ll, xy[:, 0], kernel="thin_plate_spline", smoothing=0.0)
    ry = RBFInterpolator(ll, xy[:, 1], kernel="thin_plate_spline", smoothing=0.0)
    riv = json.load(open(RIVERS_NE))
    JUMP = 90.0
    added = 0
    for f in riv.get("features", []):
        g = f.get("geometry")
        if not g:
            continue
        rank = (f.get("properties") or {}).get("scalerank", 8) or 8
        if rank > 8:
            continue
        imp = "major" if rank <= 4 else ("medium" if rank <= 6 else "minor")
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for ln in lines:
            a = np.asarray(ln, float)
            if a.ndim != 2 or len(a) < 2:
                continue
            px, py = rx(a), ry(a)
            seg, segs = [], []
            for j in range(len(px)):
                x, y = float(px[j]), float(py[j])
                ok = (0 <= x <= W and 0 <= y <= H)
                jump = seg and (abs(x - seg[-1][0]) + abs(y - seg[-1][1]) > JUMP)
                if not ok or jump:
                    if len(seg) >= 2:
                        segs.append(seg)
                    seg = []
                    if not ok:
                        continue
                seg.append([round(x, 1), round(y, 1)])
            if len(seg) >= 2:
                segs.append(seg)
            for s in segs:
                feats.append({"type": "Feature", "id": "riv%d" % added,
                              "geometry": {"type": "LineString", "coordinates": s},
                              "properties": {"id": "riv%d" % added, "type": "river", "importance": imp,
                                             "name": (f.get("properties") or {}).get("name") or "", "name_ru": None}})
                added += 1
    print("  river (NE)     -> %d segments (%.1fs)" % (added, time.time() - t0), flush=True)
    return added


add_ne_rivers()
os.makedirs("data", exist_ok=True)
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
print("wrote %s: %d features, %.2f MB (%.1fs)" %
      (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
