#!/usr/bin/env python3
# AtlasForge — build the real OWB region map from the HOI4 mod source files:
#   provinces.bmp (each province a unique colour) + definition.csv (colour->id,
#   type, terrain) + states/*.txt (which provinces form each named state, owner).
# Output: state-level GeoJSON (pixel coords) with real names, owners, terrain.
import csv, glob, os, re, sys, time
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

SRC = "OWB_helping_files"
OUT = "data/owb_states_raw.geojson"
DOWN = 2          # downscale the bmp (5632x2304 -> 2816x1152)
MIN_AREA = 6      # drop sub-pixel state fragments (downscaled px)
SIMPLIFY = 1.0

t0 = time.time()
# ---- definition.csv: colour-key -> province id; province id -> terrain/type
defn_keys, defn_pid = [], []
prov_terr, prov_type = {}, {}
maxpid = 0
for row in csv.reader(open(os.path.join(SRC, "definition.csv")), delimiter=";"):
    if len(row) < 8:
        continue
    try:
        pid = int(row[0]); r, g, b = int(row[1]), int(row[2]), int(row[3])
    except ValueError:
        continue
    defn_keys.append((r << 16) | (g << 8) | b); defn_pid.append(pid)
    prov_terr[pid] = row[6]; prov_type[pid] = row[4]; maxpid = max(maxpid, pid)
defn_keys = np.array(defn_keys, np.uint32); defn_pid = np.array(defn_pid, np.int32)
order = np.argsort(defn_keys); defn_keys = defn_keys[order]; defn_pid = defn_pid[order]
print("definition: %d provinces" % len(defn_pid), flush=True)

# ---- localisation: STATE_KEY -> real name (HOI4 yml: ` STATE_1:0 "The Hub"`)
loc = {}
_loc_re = re.compile(r'(STATE_[A-Za-z0-9_]+)\s*:\s*\d*\s*"([^"]*)"')
for yf in glob.glob(os.path.join(SRC, "states", "*_l_english.yml")):
    for line in open(yf, encoding="utf-8-sig", errors="ignore"):
        lm = _loc_re.search(line)
        if lm and lm.group(2).strip():
            loc[lm.group(1)] = lm.group(2).strip()
print("localisation: %d state names" % len(loc), flush=True)

# ---- states: id, real name, owner, category, provinces
# Name source, best first: localisation[STATE_KEY] > filename "<id>-Name.txt" > "State <id>"
prov_state = {}; states = {}
for fp in glob.glob(os.path.join(SRC, "states", "*.txt")):
    txt = open(fp, encoding="utf-8", errors="ignore").read()
    txt = re.sub(r"#.*", "", txt)   # strip HOI4 comments
    m = re.search(r"\bid\s*=\s*(\d+)", txt)
    if not m:
        continue
    sid = int(m.group(1))
    base = os.path.basename(fp)[:-4]
    nm = base.split("-", 1)[1].strip() if "-" in base else base
    km = re.search(r'\bname\s*=\s*"(STATE_[A-Za-z0-9_]+)"', txt)
    if km and km.group(1) in loc:
        nm = loc[km.group(1)]
    elif nm.lower() == "state":
        nm = "State %d" % sid
    owner = (re.search(r"\bowner\s*=\s*(\w+)", txt) or [None, None])[1] if re.search(r"\bowner\s*=\s*(\w+)", txt) else None
    om = re.search(r"\bowner\s*=\s*(\w+)", txt); owner = om.group(1) if om else None
    cm = re.search(r"state_category\s*=\s*(\w+)", txt); cat = cm.group(1) if cm else None
    pm = re.search(r"provinces\s*=\s*\{([^}]*)\}", txt)
    pids = [int(x) for x in re.findall(r"\d+", pm.group(1))] if pm else []
    states[sid] = {"name": nm, "owner": owner, "cat": cat, "prov": pids}
    for p in pids:
        prov_state[p] = sid
print("states: %d, provinces referenced: %d (%.1fs)" % (len(states), len(prov_state), time.time() - t0), flush=True)

# ---- provinces.bmp -> province-id image -> state-id image
im = Image.open(os.path.join(SRC, "provinces.bmp")).convert("RGB")
if DOWN > 1:
    im = im.resize((im.width // DOWN, im.height // DOWN), Image.NEAREST)
arr = np.asarray(im).astype(np.uint32)
H, W = arr.shape[0], arr.shape[1]
keys = (arr[:, :, 0] << 16) | (arr[:, :, 1] << 8) | arr[:, :, 2]
pos = np.searchsorted(defn_keys, keys)
pos = np.clip(pos, 0, len(defn_keys) - 1)
pid_img = defn_pid[pos]
pid_img[defn_keys[pos] != keys] = -1
print("province image %dx%d (%.1fs)" % (W, H, time.time() - t0), flush=True)

pid2sid = np.full(maxpid + 2, 0, np.int32)
sid_list = sorted(states.keys())
sid_to_lab = {s: i + 1 for i, s in enumerate(sid_list)}   # contiguous labels for ndimage
for p, s in prov_state.items():
    if 0 <= p <= maxpid + 1:
        pid2sid[p] = sid_to_lab[s]
pidc = np.clip(pid_img, 0, maxpid + 1)
lab_img = np.where(pid_img >= 0, pid2sid[pidc], 0).astype(np.int32)
print("state-label image built (%.1fs)" % (time.time() - t0), flush=True)

# ---- vectorize each state (one bbox per state via find_objects)
objs = ndimage.find_objects(lab_img, max_label=len(sid_list))

def mask_to_poly(mask, x0, y0):
    boxes = []
    for r in range(mask.shape[0]):
        row = mask[r]
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        s = np.where(d == 1)[0]; e = np.where(d == -1)[0]
        for c0, c1 in zip(s, e):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes:
        return None
    poly = unary_union(boxes).simplify(SIMPLIFY, preserve_topology=True)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty else None

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon": return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], 1), round(o[1], 1)]
        return [round_coords(x) for x in o]
    return o

import json
from collections import Counter
feats = []
for s in sid_list:
    lab = sid_to_lab[s]
    sl = objs[lab - 1]
    if sl is None:
        continue
    y0, x0 = sl[0].start, sl[1].start
    mask = lab_img[sl] == lab
    if mask.sum() < MIN_AREA:
        continue
    poly = mask_to_poly(mask, x0, y0)
    if poly is None or poly.area < MIN_AREA * 0.5:
        continue
    info = states[s]
    terr = Counter(prov_terr.get(p) for p in info["prov"] if prov_terr.get(p)).most_common(1)
    gm = mapping(orient_d3(poly)); gm["coordinates"] = round_coords(gm["coordinates"])
    feats.append({"type": "Feature", "id": "s%d" % s, "geometry": gm,
        "properties": {"id": "s%d" % s, "name": info["name"], "owner": info["owner"],
                       "state_category": info["cat"], "terrain": terr[0][0] if terr else None,
                       "color": None, "ownerCountryId": None, "notes": ""}})

json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
xs = [c for f in feats for c in [f["geometry"]]]
print("wrote %s: %d states, %.1f MB (%.1fs)" % (OUT, len(feats), os.path.getsize(OUT) / 1e6, time.time() - t0))
# extent + a few named samples
allx = []; ally = []
def walk(c, ax, ay):
    if isinstance(c[0], (int, float)): ax.append(c[0]); ay.append(c[1])
    else: [walk(x, ax, ay) for x in c]
for f in feats[:0]: pass
named = [f["properties"]["name"] for f in feats if not f["properties"]["name"].startswith("State ")][:12]
print("sample named states:", named)
owners = Counter(f["properties"]["owner"] for f in feats)
print("distinct owners:", len(owners), "top:", owners.most_common(5))
