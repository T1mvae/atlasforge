#!/usr/bin/env python3
# AtlasForge — complete the HOI4 state-region file into a clean full-world map.
#
# The HOI4 file is the BASE: every properly named state keeps its geometry,
# provinceIds, stateId and name untouched. This script only:
#   1) renames placeholder states ("China 7", "TS 11", "Siberia 3", "Deep
#      Amazonas", "Sov state 5"…) to real regional names (EN+RU), using the
#      seed list from tools/generate_regions.py and the same pixel<->lat/lon
#      calibration;
#   2) splits oversized placeholder states (>26 provinces) into sensible parts
#      (real-named states are NEVER split);
#   3) fixes obvious typos ("Austraila", "Saol Paulo", "Nizhny Novogrod"…).
# Renamed/fixed features keep their original name in `sourceName`.
import json, math, re, sys
from collections import Counter, defaultdict
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

PROV = "data/hoi4_provinces_simplified_075px.geojson"
BASE = "data/hoi4_state_regions_simplified_0_75px.geojson"
OUT  = "data/hoi4_state_regions_completed_0_75px.geojson"
W, H = 5632.0, 2048.0
MAXN, TARGET = 26, 15

# ---- reuse ANCHORS + SEEDS from the generator (exec the declarations only)
src = open("tools/generate_regions.py").read()
prefix = src.split("# ---------------------------------------------------------------- helpers")[0]
ns = {}
exec(prefix, ns)
ANCHORS, SEEDS = ns["ANCHORS"], ns["SEEDS"]

PLACEHOLDER = re.compile(
    r"^(China \d+|TS ?\d+|Ts \d+|Siberia \d+|[Ss]ov state \d+|[Ss]tate \d+|"
    r"Below Zero|Soviet Lakes|Some Mountains|Border state|Southern plain|"
    r"Central islands|Arab UK \d+|Arabian UK \d+|Deep Amazonas|Champagne2)$")

TYPO_FIX = {
    "Austraila": "Australia", "Tennesse": "Tennessee",
    "Alcase": "Alsace", "Alcase Lorraine": "Alsace-Lorraine",
    "Rio de Janerio": "Rio de Janeiro", "Saol Paulo": "Sao Paulo",
    "Gibralter": "Gibraltar", "Chukchi Peninsulay": "Chukchi Peninsula",
    "Veliky Novogrod": "Veliky Novgorod", "Nizhny Novogrod": "Nizhny Novgorod",
    "Stravropol": "Stavropol", "Krasodar": "Krasnodar",
    "Wuttemberg": "Wurttemberg", "Falkand Islands": "Falkland Islands",
    "Bocovina": "Bukovina", "Borisoglbsk": "Borisoglebsk",
    "Pitcarin Island": "Pitcairn Island", "Guanxi": "Guangxi",
    "Jiansu": "Jiangsu", "Roussillion": "Roussillon",
    "Lesser  Sunda Islands": "Lesser Sunda Islands",
    "Schleswig - Holstein": "Schleswig-Holstein", "Ost - Hannover": "Ost-Hannover",
    "baku": "Baku", "bolivia": "Bolivia", "crisana": "Crisana",
    "ethiopia": "Ethiopia", "jubaland": "Jubaland", "lipetsk": "Lipetsk",
    "moldovia": "Moldova", "ouest du quebec": "Western Quebec",
    "paraguay": "Paraguay", "tula": "Tula", "ulyanovsky": "Ulyanovsk",
    "volgodonsk": "Volgodonsk", "sov state 8": None,  # placeholder, handled above
}

OCT_EN = ["East", "Northeast", "North", "Northwest", "West", "Southwest", "South", "Southeast"]
OCT_RU = ["Восток", "Северо-Восток", "Север", "Северо-Запад", "Запад", "Юго-Запад", "Юг", "Юго-Восток"]

# hand-curated names for specific placeholders where the nearest-seed guess is
# wrong or clumsy (checked against their actual map positions)
CURATED = {
    "Soviet Lakes": ("Subantarctic Islands", "Субантарктические острова"),
    "Below Zero": ("White Sea", "Беломорье"),
    "Champagne2": ("Upper Champagne", "Верхняя Шампань"),
    "Arab UK 1": ("Trucial Coast", "Договорный Оман"),
}

def wrap_dx(x1, x2):
    dx = abs(x1 - x2)
    return min(dx, W - dx)

def wdist(p, q):
    return math.hypot(wrap_dx(p[0], q[0]), p[1] - q[1])

def solve_normal(ata, atb):
    n = len(atb)
    M = [row[:] + [atb[i]] for i, row in enumerate(ata)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[piv] = M[piv], M[c]
        for r in range(n):
            if r != c and M[r][c]:
                f = M[r][c] / M[c][c]
                for k in range(c, n + 1):
                    M[r][k] -= f * M[c][k]
    return [M[i][n] / M[i][i] for i in range(n)]

def polyfit(xs, ys, deg):
    n = deg + 1
    ata = [[sum(x ** (i + j) for x in xs) for j in range(n)] for i in range(n)]
    atb = [sum((x ** i) * y for x, y in zip(xs, ys)) for i in range(n)]
    return solve_normal(ata, atb)

def polyval(c, x):
    return sum(ci * x ** i for i, ci in enumerate(c))

# ---------------------------------------------------------------- load
print("loading…", flush=True)
prov_gj = json.load(open(PROV))
land = {}   # pid -> {x,y,geom}
for f in prov_gj["features"]:
    p = f["properties"]
    if p.get("type") in ("sea", "lake") or p.get("terrain") in ("ocean", "lakes"):
        continue
    g = shape(f["geometry"])
    c = g.centroid
    land[p["provinceId"]] = {"x": c.x, "y": c.y, "geom": g}

base = json.load(open(BASE))
feats = base["features"]
print("base states:", len(feats), "| land provinces:", len(land))

# ---------------------------------------------------------------- calibrate
ref_cent = {}
for f in feats:
    nm = f["properties"]["name"]
    if nm in ANCHORS and nm not in ref_cent:
        c = shape(f["geometry"]).centroid
        ref_cent[nm] = (c.x, c.y)

def fit_projection(items):
    xs = [px for (_, (px, _)) in items]
    ys = [py for (_, (_, py)) in items]
    lons = [ANCHORS[nm][1] for (nm, _) in items]
    lats = [ANCHORS[nm][0] for (nm, _) in items]
    return polyfit(xs, lons, 1), polyfit(ys, lats, 3)

items = list(ref_cent.items())
lon_c, lat_c = fit_projection(items)
def residual(nm, px, py):
    la, lo = ANCHORS[nm]
    dlon = abs(polyval(lon_c, px) - lo); dlon = min(dlon, 360 - dlon)
    return max(dlon, abs(polyval(lat_c, py) - la))
for thresh in (6.0, 3.0, 2.0):
    items = [(nm, c) for nm, c in items if residual(nm, c[0], c[1]) < thresh]
    lon_c, lat_c = fit_projection(items)
print(f"calibration: {len(items)} anchors")

def lonlat_to_px(lat, lon):
    a, b = lon_c
    x = ((lon - a) / b) % W
    lo, hi = -64.0, H + 64.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if polyval(lat_c, mid) > lat: lo = mid
        else: hi = mid
    return x, (lo + hi) / 2

seed_px = [(ne, nr, *lonlat_to_px(lat, lon)) for ne, nr, lat, lon in SEEDS]

# ---------------------------------------------------------------- naming machinery
existing_names = Counter(f["properties"]["name"] for f in feats
                         if not PLACEHOLDER.match(f["properties"]["name"]))
used_names = Counter()   # names we assign

def nearest_seed(cx, cy):
    best, bd = None, 1e18
    for ne, nr, sx, sy in seed_px:
        d = wdist((cx, cy), (sx, sy))
        if d < bd: bd, best = d, (ne, nr, sx, sy)
    return best

def assign_name(cx, cy):
    ne, nr, sx, sy = nearest_seed(cx, cy)
    if existing_names[ne] == 0 and used_names[ne] == 0:
        used_names[ne] += 1
        return ne, nr
    # collision: add a compass suffix relative to the seed
    ang = math.degrees(math.atan2(-(cy - sy), cx - sx))
    oi = int(round(ang / 45.0)) % 8
    cand_e = f"{ne} ({OCT_EN[oi]})"; cand_r = f"{nr} ({OCT_RU[oi]})"
    n = 2
    while existing_names[cand_e] or used_names[cand_e]:
        cand_e = f"{ne} ({OCT_EN[oi]} {n})"; cand_r = f"{nr} ({OCT_RU[oi]} {n})"; n += 1
    used_names[cand_e] += 1
    return cand_e, cand_r

def unwrap_pts(pids):
    pts = []
    x0 = land[pids[0]]["x"]
    for pid in pids:
        x = land[pid]["x"]
        if x - x0 > W / 2: x -= W
        elif x0 - x > W / 2: x += W
        pts.append((x, land[pid]["y"]))
    return pts

def kmeans(pids, k):
    pts = unwrap_pts(pids)
    cents = [pts[0]]
    while len(cents) < k:
        far, fd = None, -1
        for pt in pts:
            d = min((pt[0]-c[0])**2 + (pt[1]-c[1])**2 for c in cents)
            if d > fd: fd, far = d, pt
        cents.append(far)
    assign = [0]*len(pts)
    for _ in range(15):
        changed = False
        for i, pt in enumerate(pts):
            bi = min(range(len(cents)), key=lambda c: (pt[0]-cents[c][0])**2 + (pt[1]-cents[c][1])**2)
            if assign[i] != bi: assign[i] = bi; changed = True
        for c in range(len(cents)):
            mem = [pts[i] for i in range(len(pts)) if assign[i] == c]
            if mem: cents[c] = (sum(m[0] for m in mem)/len(mem), sum(m[1] for m in mem)/len(mem))
        if not changed: break
    out = defaultdict(list)
    for i, a in enumerate(assign): out[a].append(pids[i])
    return [v for v in out.values() if v]

def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 1), round(obj[1], 1)]
        return [round_coords(o) for o in obj]
    return obj

def union_feature(pids):
    geoms = [land[p]["geom"] for p in pids if p in land]
    try:
        u = unary_union(geoms)
    except Exception:
        u = unary_union([g.buffer(0) for g in geoms])
    gm = mapping(u)
    gm["coordinates"] = round_coords(gm["coordinates"])
    return gm

# ---------------------------------------------------------------- process
next_id = max(f["properties"]["stateId"] for f in feats) + 1
out_feats, renamed, split_log, fixed = [], [], [], []

for f in feats:
    p = f["properties"]
    name = p["name"]
    if PLACEHOLDER.match(name):
        pids_land = [pid for pid in p.get("provinceIds", []) if pid in land]
        if not pids_land:
            out_feats.append(f)   # nothing to anchor on — keep as-is
            continue
        if len(pids_land) > MAXN:
            # split the placeholder into sensible parts
            k = math.ceil(len(pids_land) / TARGET)
            parts = kmeans(pids_land, k)
            global_first = True
            for part in parts:
                pts = unwrap_pts(part)
                cx = sum(q[0] for q in pts)/len(pts) % W
                cy = sum(q[1] for q in pts)/len(pts)
                ne, nr = assign_name(cx, cy)
                props = dict(p)
                props.update({"stateId": next_id, "id": next_id, "name": ne, "name_ru": nr,
                              "sourceName": name, "provinceIds": sorted(part),
                              "provinceCount": len(part), "renamed": True, "splitFrom": name})
                out_feats.append({"type": "Feature", "geometry": union_feature(part), "properties": props})
                next_id += 1
            split_log.append((name, len(pids_land), len(parts)))
        else:
            if name in CURATED:
                ne, nr = CURATED[name]
                used_names[ne] += 1
            else:
                c = shape(f["geometry"]).centroid
                ne, nr = assign_name(c.x, c.y)
            props = dict(p)
            props.update({"name": ne, "name_ru": nr, "sourceName": name, "renamed": True})
            out_feats.append({"type": "Feature", "geometry": f["geometry"], "properties": props})
            renamed.append((name, ne))
    elif name in TYPO_FIX and TYPO_FIX[name]:
        fix = TYPO_FIX[name]
        if existing_names[fix] or used_names[fix]:
            out_feats.append(f)   # would collide with a real state — keep original
        else:
            used_names[fix] += 1
            props = dict(p)
            props.update({"name": fix, "sourceName": name})
            out_feats.append({"type": "Feature", "geometry": f["geometry"], "properties": props})
            fixed.append((name, fix))
    else:
        out_feats.append(f)

json.dump({"type": "FeatureCollection", "features": out_feats},
          open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

import os
print(f"\nwrote {OUT}: {len(out_feats)} states ({len(feats)} in base), "
      f"{os.path.getsize(OUT)/1e6:.1f} MB")
print(f"renamed placeholders (kept boundaries): {len(renamed)}")
for a, b in renamed: print(f"  {a}  ->  {b}")
print(f"split oversized placeholders: {len(split_log)}")
for nm, n, k in split_log: print(f"  {nm} ({n} prov) -> {k} parts")
print(f"typo fixes: {len(fixed)}")
for a, b in fixed: print(f"  {a}  ->  {b}")

# coverage check
covered = set()
for f in out_feats:
    covered.update(f["properties"].get("provinceIds", []))
gaps = set(land) - covered
print("\ncoverage: uncovered land provinces =", len(gaps))
