#!/usr/bin/env python3
# AtlasForge — extract physical-geography layers from the OWB terrain.bmp so the
# game-projection map gets real mountains / water / forest / desert (like the
# real-world atlas maps). Output coords match owb_states/owb_provinces exactly
# (terrain.bmp 5632x2304 downscaled /2 -> 2816x1152, NEAREST), so the layers
# overlay the state map pixel-perfect.
#
# terrain.bmp is a PALETTE image; palette indices map to terrain types:
#   ocean=1(8,31,130)  plains/grass=3,4,5,6,7(greens)  forest=8,9(dark green)
#   water(lakes+rivers)=10(75,147,174)  urban=11,12,19,20  desert/arid=13,14,17,18(yellows)
#   mountains/hills=2,15,16(greys/white)
# Output: data/owb_physical.geojson  (combined; type = mountain_range|lake|forest|desert)
import json, os, time
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import RBFInterpolator
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

SRC = "OWB_helping_files/terrain.bmp"
RIVERS_NE = "tools/cache/rivers-50m.json"   # Natural Earth 50m rivers (lon/lat)
OUT = "data/owb_physical.geojson"
DOWN = 2  # match owb_states frame (provinces.bmp/2)

# Same hand-read pixel<->lon/lat control points as tools/owb_states_georef.py,
# used here INVERTED (lon/lat -> pixel) to drape the real river network onto the
# game projection. terrain.bmp has lakes + a few drawn rivers but no full network.
GEOREF_CP = [
    ((615, 75), (-124.7, 48.4)), ((625, 300), (-124.0, 40.0)), ((685, 405), (-120.5, 34.4)),
    ((715, 435), (-117.1, 32.7)), ((835, 625), (-109.9, 22.9)), ((1340, 720), (-87.0, 21.6)),
    ((1300, 770), (-91.0, 18.6)), ((1440, 1120), (-80.2, 8.5)), ((1535, 565), (-80.9, 25.1)),
    ((1560, 470), (-81.5, 30.3)), ((1660, 375), (-75.5, 35.2)), ((1700, 320), (-76.0, 38.0)),
    ((1735, 235), (-70.0, 41.7)), ((2060, 245), (-63.6, 44.6)), ((2290, 175), (-52.6, 47.5)),
    ((1490, 655), (-82.4, 23.1)), ((1650, 690), (-75.0, 20.0)), ((1770, 725), (-69.9, 18.5)),
    ((1860, 735), (-66.5, 18.2)), ((1375, 300), (-87.6, 41.9)), ((1300, 215), (-92.1, 46.8)),
    ((1180, 150), (-97.1, 49.9)), ((1430, 60), (-80.5, 51.5)), ((620, 30), (-130.0, 60.0)),
    ((900, 10), (-118.0, 66.0)), ((1200, 5), (-105.0, 68.0)), ((1500, 10), (-88.0, 66.0)),
    ((1800, 20), (-72.0, 62.0)), ((2100, 30), (-58.0, 60.0)),
]

# palette-index groups -> (geojson type, importance-area threshold, morphology, min area, simplify)
# keep_thin=True skips the "opening" erosion so narrow river ribbons survive.
CATS = [
    {"name": "mountain_range", "idx": [2, 15, 16],          "close": 2, "open": 1, "min": 36,  "simp": 2.5, "thin": False, "major": 9000},
    {"name": "forest",         "idx": [8, 9],               "close": 2, "open": 1, "min": 110, "simp": 3.0, "thin": False, "major": 1e9},
    {"name": "desert",         "idx": [13, 14, 17, 18],     "close": 2, "open": 1, "min": 110, "simp": 3.0, "thin": False, "major": 1e9},
    {"name": "lake",           "idx": [10],                 "close": 1, "open": 0, "min": 8,   "simp": 1.4, "thin": True,  "major": 1400},
]

t0 = time.time()
im = Image.open(SRC)
assert im.mode == "P", "terrain.bmp must be a palette image, got %s" % im.mode
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
        s = np.where(d == 1)[0]
        e = np.where(d == -1)[0]
        for c0, c1 in zip(s, e):
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
        area = poly.area
        imp = "major" if area >= cat["major"] else ("medium" if area >= cat["major"] * 0.3 else "minor")
        gm = mapping(orient_d3(poly))
        gm["coordinates"] = round_coords(gm["coordinates"])
        fid = "%s%d" % (cat["name"][:3], kept)
        feats.append({
            "type": "Feature",
            "id": fid,
            "geometry": gm,
            "properties": {"id": fid, "type": cat["name"], "importance": imp, "name": "", "name_ru": None},
        })
        kept += 1
    print("  %-14s px=%-7d -> %d features (%.1fs)" % (cat["name"], raw_px, kept, time.time() - t0), flush=True)


# ---- real river network: Natural Earth rivers draped onto the game projection
def add_ne_rivers():
    if not os.path.exists(RIVERS_NE):
        print("  rivers: %s missing, skipped" % RIVERS_NE, flush=True)
        return 0
    ll = np.array([c[1] for c in GEOREF_CP], float)
    xy = np.array([c[0] for c in GEOREF_CP], float)
    rx = RBFInterpolator(ll, xy[:, 0], kernel="thin_plate_spline")
    ry = RBFInterpolator(ll, xy[:, 1], kernel="thin_plate_spline")
    riv = json.load(open(RIVERS_NE))
    JUMP, TOPCROP = 110.0, 24      # split extrapolation streaks; drop unreliable top crop
    added = 0
    for f in riv.get("features", []):
        g = f.get("geometry")
        if not g:
            continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        rank = (f.get("properties") or {}).get("scalerank", 8) or 8
        if rank > 8:
            continue
        imp = "major" if rank <= 5 else ("medium" if rank <= 7 else "minor")
        for ln in lines:
            a = np.asarray(ln, float)
            if a.ndim != 2 or len(a) < 2:
                continue
            if not (-170 < a[:, 0].mean() < -52 and 7 < a[:, 1].mean() < 73):
                continue   # outside North America
            px, py = rx(a), ry(a)
            seg = []
            segs = []
            for j in range(len(px)):
                x, y = float(px[j]), float(py[j])
                ok = (0 <= x <= W and TOPCROP <= y <= H)
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
                feats.append({
                    "type": "Feature", "id": "riv%d" % added,
                    "geometry": {"type": "LineString", "coordinates": s},
                    "properties": {"id": "riv%d" % added, "type": "river", "importance": imp,
                                   "name": (f.get("properties") or {}).get("name") or "", "name_ru": None},
                })
                added += 1
    print("  river (NE)     -> %d segments (%.1fs)" % (added, time.time() - t0), flush=True)
    return added


add_ne_rivers()

os.makedirs("data", exist_ok=True)
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
print("wrote %s: %d features, %.2f MB (%.1fs)" %
      (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
