#!/usr/bin/env python3
# AtlasForge — province-level OWB map: every province in provinces.bmp becomes its
# own region (nothing merged), tagged with per-province terrain + parent state
# name + owner. This is the finest level the mod data offers.
import csv, glob, os, re, sys, time, json, hashlib
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

SRC = "OWB_helping_files"
OUT = "data/owb_provinces_raw.geojson"
DOWN = 2
MIN_AREA = 4
SIMPLIFY = 0.8

t0 = time.time()
# definition: colour-key -> pid ; pid -> terrain/type
dk, dv = [], []
prov_terr, prov_type = {}, {}
maxpid = 0
for row in csv.reader(open(os.path.join(SRC, "definition.csv")), delimiter=";"):
    if len(row) < 8:
        continue
    try:
        pid = int(row[0]); r, g, b = int(row[1]), int(row[2]), int(row[3])
    except ValueError:
        continue
    dk.append((r << 16) | (g << 8) | b); dv.append(pid)
    prov_terr[pid] = row[6]; prov_type[pid] = row[4]; maxpid = max(maxpid, pid)
dk = np.array(dk, np.uint32); dv = np.array(dv, np.int32)
o = np.argsort(dk); dk = dk[o]; dv = dv[o]

# states: province -> (state name, owner)
prov_state, prov_owner = {}, {}
for fp in glob.glob(os.path.join(SRC, "states", "*.txt")):
    txt = re.sub(r"#.*", "", open(fp, encoding="utf-8", errors="ignore").read())
    m = re.search(r"\bid\s*=\s*(\d+)", txt)
    if not m:
        continue
    sid = int(m.group(1))
    base = os.path.basename(fp)[:-4]
    nm = base.split("-", 1)[1].strip() if "-" in base else base
    if nm.lower() == "state":
        nm = "State %d" % sid
    om = re.search(r"\bowner\s*=\s*(\w+)", txt); owner = om.group(1) if om else None
    pm = re.search(r"provinces\s*=\s*\{([^}]*)\}", txt)
    for p in (re.findall(r"\d+", pm.group(1)) if pm else []):
        prov_state[int(p)] = nm; prov_owner[int(p)] = owner
print("definition %d, provinces in states %d (%.1fs)" % (len(dv), len(prov_state), time.time() - t0), flush=True)

# provinces.bmp -> province-id image
im = Image.open(os.path.join(SRC, "provinces.bmp")).convert("RGB")
if DOWN > 1:
    im = im.resize((im.width // DOWN, im.height // DOWN), Image.NEAREST)
arr = np.asarray(im).astype(np.uint32)
keys = (arr[:, :, 0] << 16) | (arr[:, :, 1] << 8) | arr[:, :, 2]
pos = np.clip(np.searchsorted(dk, keys), 0, len(dk) - 1)
pid_img = dv[pos]
pid_img[dk[pos] != keys] = -1
# keep only provinces that belong to a state (the OWB land set)
in_state = np.zeros(maxpid + 2, bool)
for p in prov_state:
    if p <= maxpid + 1:
        in_state[p] = True
keep = (pid_img >= 0) & in_state[np.clip(pid_img, 0, maxpid + 1)]
# contiguous labels for ndimage: map pid -> 1..K
pids_present = sorted(set(int(x) for x in np.unique(pid_img[keep])))
pid_to_lab = {p: i + 1 for i, p in enumerate(pids_present)}
lab_lut = np.zeros(maxpid + 2, np.int32)
for p, l in pid_to_lab.items():
    lab_lut[p] = l
lab_img = np.where(keep, lab_lut[np.clip(pid_img, 0, maxpid + 1)], 0).astype(np.int32)
print("provinces present in image: %d (%.1fs)" % (len(pids_present), time.time() - t0), flush=True)

objs = ndimage.find_objects(lab_img, max_label=len(pids_present))

def mask_to_poly(mask, x0, y0):
    boxes = []
    for r in range(mask.shape[0]):
        d = np.diff(np.concatenate(([0], mask[r].view(np.int8), [0])))
        s = np.where(d == 1)[0]; e = np.where(d == -1)[0]
        for c0, c1 in zip(s, e):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes:
        return None
    p = unary_union(boxes).simplify(SIMPLIFY, preserve_topology=True)
    return p.buffer(0) if not p.is_valid else (p if not p.is_empty else None)

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon": return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def rc(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], 1), round(o[1], 1)]
        return [rc(x) for x in o]
    return o

feats = []
for p in pids_present:
    sl = objs[pid_to_lab[p] - 1]
    if sl is None:
        continue
    y0, x0 = sl[0].start, sl[1].start
    mask = lab_img[sl] == pid_to_lab[p]
    if mask.sum() < MIN_AREA:
        continue
    poly = mask_to_poly(mask, x0, y0)
    if poly is None or poly.area < MIN_AREA * 0.5:
        continue
    gm = mapping(orient_d3(poly)); gm["coordinates"] = rc(gm["coordinates"])
    feats.append({"type": "Feature", "id": "p%d" % p, "geometry": gm,
        "properties": {"id": "p%d" % p, "name": "Province %d" % p,
                       "state": prov_state.get(p), "owner": prov_owner.get(p),
                       "terrain": prov_terr.get(p), "color": None, "ownerCountryId": None, "notes": ""}})

json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("wrote %s: %d provinces, %.1f MB (%.1fs)" % (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
