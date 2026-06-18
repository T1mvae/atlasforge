#!/usr/bin/env python3
# AtlasForge worldgen — an ORIGINAL atlas-style region grid built from scratch.
#
# Inputs: Natural Earth 50m public-domain physical data (land, rivers, lakes,
# named ranges/deserts, marine labels) + the hand-authored seed list in
# tools/worldgen/seeds_base.py (+ optional seeds_extra.py). No HOI4 data and no
# previously shipped map files are read.
#
# Pipeline:
#   1. Project the world to a Miller-cylindrical pixel space (W=4096).
#   2. Rasterize land / big-lake / river / mountain-range / desert masks.
#   3. Grow named REGION GROUPS from the seeds with multi-source Dijkstra whose
#      step costs make rivers and ridges natural borders (geography first).
#   4. Subdivide each group into provinces by a density field (dense Europe /
#      India / East Asia, sparse Sahara / Siberia / outback) → 1000-3000 units.
#   5. Vectorize the raster topologically: every border polyline is simplified
#      with an anchored, reversal-symmetric Douglas-Peucker so adjacent
#      provinces share identical coordinates — no slivers, clean group unions.
#   6. Export provinces / region groups / physical features as GeoJSON, plus a
#      debug PNG preview.
import json, math, os, sys, heapq
from collections import defaultdict, Counter, deque
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union

CACHE = "tools/worldgen/cache/"
OUT_PROV = "data/world_provinces.geojson"
OUT_GROUPS = "data/world_region_groups.geojson"
OUT_PHYS = "data/world_physical.geojson"
OUT_PREVIEW = "tools/worldgen/preview.png"

# ---------------- projection: Miller cylindrical, lat clamp [-60, 85] ----------------
W = 4096.0
LAT_N, LAT_S = 85.0, -60.0
def miller_y(lat):
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat)))
MY_N, MY_S = miller_y(LAT_N), miller_y(LAT_S)
H = round(W * (MY_N - MY_S) / (2 * math.pi))

def project(lon, lat):
    x = (lon + 180.0) / 360.0 * W
    lat = max(LAT_S, min(LAT_N, lat))
    y = (MY_N - miller_y(lat)) / (MY_N - MY_S) * H
    return x, y

RW = 2816
SCALE = W / RW
RH = int(round(H / SCALE))

CPP_BASE = 540          # raster cells per province before density multipliers
GROUP_KCAP = 24         # max provinces per group
MAX_PROV_CELLS = 4200   # hard cap: force-split anything bigger
MIN_SUB = 22            # sub-regions smaller than this merge into a neighbour
DP_EPS = 1.35           # simplification epsilon (raster units)

COST_BASE = 10
COST_RIVER = 110        # entering a river cell (borders settle on rivers)
COST_RANGE = 26         # mountain cells are slow (borders follow ridges)
COST_DESERT = 5
COST_PLATEAU = 6

DENSITY = [
    (34, 62, -11, 32, 0.45),     # Europe core
    (54, 64, 32, 60, 0.80),      # northern European Russia
    (28, 42, 26, 50, 0.55),      # Anatolia / Levant / Caucasus / Mesopotamia
    (22, 34, 29, 36, 0.50),      # Nile valley
    (6, 34, 66, 93, 0.50),       # Indian subcontinent
    (18, 42, 102, 124, 0.50),    # eastern China
    (30, 46, 124, 147, 0.50),    # Japan & Korea
    (-11, -5, 104, 116, 0.50),   # Java
    (29, 38, -12, 12, 0.70),     # Maghreb coast
    (4, 14, -17, 10, 0.65),      # West African coast belt
    (-38, -27, 15, 33, 0.80),    # South Africa
    (16, 31, -14, 33, 2.80),     # Sahara
    (12, 30, 36, 60, 2.40),      # Arabian interior
    (50, 85, 58, 180, 2.60),     # Siberia
    (50, 85, -170, -90, 2.60),   # northern Canada / Alaska north
    (58, 85, -90, -50, 2.80),    # northeastern Canada
    (59, 85, -58, -10, 3.20),    # Greenland
    (-32, -17, 118, 142, 2.60),  # Australian interior
    (-13, 3, -74, -50, 2.40),    # Amazonia
    (-56, -38, -76, -63, 2.00),  # Patagonia
    (28, 40, 78, 98, 2.20),      # Tibet / Qinghai
    (37, 47, 52, 88, 1.80),      # Central Asian deserts & steppe
    (-26, -17, 12, 26, 1.80),    # Kalahari / Namib
]
def density_mult(lat, lon):
    for la0, la1, lo0, lo1, m in DENSITY:
        if la0 <= lat <= la1 and lo0 <= lon <= lo1:
            return m
    return 1.0

def cell_latlon(r, c):
    x, y = (c + 0.5) * SCALE, (r + 0.5) * SCALE
    lon = x / W * 360.0 - 180.0
    my = MY_N - y / H * (MY_N - MY_S)
    lat = math.degrees(2.5 * (math.atan(math.exp(0.8 * my)) - math.pi / 4))
    return lat, lon

# islands that must have their own seed even if no list provides one
SEEDS_PATCH = [
    ("Azores", "Азорские острова", 38.5, -28.0),
    ("Madeira", "Мадейра", 32.7, -17.0),
    ("Canary Islands", "Канарские острова", 28.3, -16.0),
    ("Cape Verde", "Кабо-Верде", 15.5, -23.9),
    ("Kerguelen", "Кергелен", -49.3, 69.3),
    ("South Georgia", "Южная Георгия", -54.3, -36.5),
]

# ---------------- load Natural Earth ----------------
def load(fname):
    return json.load(open(CACHE + fname))

print(f"map {W:.0f}x{H} px, raster {RW}x{RH}", flush=True)
ne_land = load("ne_50m_land.geojson")
ne_rivers = load("ne_50m_rivers_lake_centerlines.geojson")
ne_lakes = load("ne_50m_lakes.geojson")
ne_geo = load("ne_50m_geography_regions_polys.geojson")
ne_marine = load("ne_50m_geography_marine_polys.geojson")

def proj_ring(ring):
    return [project(p[0], p[1]) for p in ring]

def iter_polys(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        for p in geom["coordinates"]:
            yield p

def iter_lines(geom):
    if geom["type"] == "LineString":
        yield geom["coordinates"]
    elif geom["type"] == "MultiLineString":
        for l in geom["coordinates"]:
            yield l

def to_raster(pts):
    return [(x / SCALE, y / SCALE) for x, y in pts]

# ---------------- rasterize masks ----------------
print("rasterizing land…", flush=True)
img = Image.new("L", (RW, RH), 0)
drw = ImageDraw.Draw(img)
for f in ne_land["features"]:
    for poly in iter_polys(f["geometry"]):
        drw.polygon(to_raster(proj_ring(poly[0])), fill=255)
        for hole in poly[1:]:
            drw.polygon(to_raster(proj_ring(hole)), fill=0)

# punch big lakes out of the land mask
big_lake_px = []
for f in ne_lakes["features"]:
    pxpolys = []
    area_px = 0.0
    for poly in iter_polys(f["geometry"]):
        outer = proj_ring(poly[0])
        holes = [proj_ring(h) for h in poly[1:]]
        try:
            pp = Polygon(outer, holes).buffer(0)
            if not pp.is_empty:
                area_px += pp.area
                pxpolys.append(pp)
        except Exception:
            pass
    if area_px > 110.0:
        for poly in iter_polys(f["geometry"]):
            drw.polygon(to_raster(proj_ring(poly[0])), fill=0)

land = np.array(img, dtype=np.uint8) > 128

print("rasterizing rivers / ranges / deserts…", flush=True)
rimg = Image.new("L", (RW, RH), 0)
rdrw = ImageDraw.Draw(rimg)
for f in ne_rivers["features"]:
    if (f["properties"].get("scalerank") or 9) > 5:
        continue
    for line in iter_lines(f["geometry"]):
        rdrw.line(to_raster(proj_ring(line)), fill=255, width=1)
river = np.array(rimg, dtype=np.uint8) > 128

def mask_from(features, classes):
    im = Image.new("L", (RW, RH), 0)
    d = ImageDraw.Draw(im)
    for f in features:
        if f["properties"].get("FEATURECLA") not in classes:
            continue
        for poly in iter_polys(f["geometry"]):
            d.polygon(to_raster(proj_ring(poly[0])), fill=255)
            for hole in poly[1:]:
                d.polygon(to_raster(proj_ring(hole)), fill=0)
    return np.array(im, dtype=np.uint8) > 128

ranges_m = mask_from(ne_geo["features"], ("Range/mtn",))
desert_m = mask_from(ne_geo["features"], ("Desert",))
plateau_m = mask_from(ne_geo["features"], ("Plateau",))

n_land = int(land.sum())
print(f"land cells: {n_land} ({100*n_land/(RW*RH):.1f}%)")

# organic value-noise so growth fronts wander instead of forming straight
# Voronoi-like borders (deterministic, multi-octave bilinear noise)
rng_np = np.random.default_rng(94517)
def value_noise():
    total = np.zeros((RH, RW), dtype=np.float64)
    for cells, weight in ((192, 0.5), (48, 0.32), (12, 0.18)):
        gh, gw = RH // cells + 2, RW // cells + 2
        grid = rng_np.random((gh, gw))
        im = Image.fromarray((grid * 255).astype(np.uint8), "L")
        im = im.resize((RW, RH), Image.BILINEAR)
        total += weight * (np.array(im, dtype=np.float64) / 255.0)
    return total
noise = value_noise()
base_mod = np.round(COST_BASE * (0.55 + 1.1 * noise)).astype(np.int32)

# per-cell entry cost: noisy base + geographic barriers
entry_cost = base_mod.copy()
entry_cost[river] += COST_RIVER
entry_cost[ranges_m] += COST_RANGE
entry_cost[desert_m] += COST_DESERT
entry_cost[plateau_m] += COST_PLATEAU
entry_cost = np.maximum(entry_cost, 3)

# ---------------- seeds ----------------
sys.path.insert(0, "tools/worldgen")
from seeds_base import SEEDS_BASE
try:
    from seeds_extra import SEEDS_EXTRA
except ImportError:
    SEEDS_EXTRA = []
raw = list(SEEDS_BASE) + list(SEEDS_EXTRA) + SEEDS_PATCH
seen, seeds = set(), []
for ne_, ru_, la, lo in raw:
    k = ne_.strip().lower()
    if k in seen or not (-60 <= la <= 85):
        continue
    seen.add(k)
    seeds.append((ne_.strip(), ru_.strip(), float(la), float(lo)))
print(f"seeds: {len(seeds)} (base {len(SEEDS_BASE)}, extra {len(SEEDS_EXTRA)})")

# bucket land cells for nearest-land snapping
BUCK = 24
buckets = defaultdict(list)
land_rc = np.argwhere(land)
for r, c in land_rc:
    buckets[(r // BUCK, c // BUCK)].append((int(r), int(c)))

def nearest_land(rr, cc, maxrad=20):
    best, bd = None, 1e18
    for rad in range(maxrad):
        found = False
        for br in range((rr // BUCK) - rad, (rr // BUCK) + rad + 1):
            for bc in range((cc // BUCK) - rad, (cc // BUCK) + rad + 1):
                if max(abs(br - rr // BUCK), abs(bc - cc // BUCK)) != rad:
                    continue
                for (r, c) in buckets.get((br, bc % (RW // BUCK + 1)), ()):
                    d = (r - rr) ** 2 + (c - cc) ** 2
                    if d < bd:
                        bd, best = d, (r, c)
                        found = True
        if best is not None and rad > (math.sqrt(bd) / BUCK) + 1:
            break
    return best, math.sqrt(bd) if best else 1e18

taken = set()
seed_cells = []   # (group_idx, r, c)
dropped = []
for gi, (ne_, ru_, la, lo) in enumerate(seeds):
    x, y = project(lo, la)
    rr, cc = int(y / SCALE), int(x / SCALE)
    cell, dist = nearest_land(rr, cc)
    if cell is None or dist > 14 * BUCK:
        dropped.append(ne_)
        continue
    if cell in taken:
        # nudge: scan small neighborhood for a free land cell
        r0, c0 = cell
        found = None
        for dr in range(-3, 4):
            for dc in range(-3, 4):
                r2, c2 = r0 + dr, c0 + dc
                if 0 <= r2 < RH and 0 <= c2 < RW and land[r2, c2] and (r2, c2) not in taken:
                    found = (r2, c2); break
            if found: break
        if not found:
            dropped.append(ne_); continue
        cell = found
    taken.add(cell)
    seed_cells.append((gi, cell[0], cell[1]))
print(f"seeds snapped: {len(seed_cells)}, dropped (no land near): {len(dropped)} {dropped[:8]}")

# ---------------- group growth: multi-source dijkstra ----------------
print("growing region groups…", flush=True)
owner = np.full((RH, RW), -1, dtype=np.int32)
dist = np.full((RH, RW), np.iinfo(np.int32).max, dtype=np.int32)
heap = []
for gi, r, c in seed_cells:
    heap.append((0, r, c, gi))
heapq.heapify(heap)
ec = entry_cost
while heap:
    d, r, c, gi = heapq.heappop(heap)
    if owner[r, c] != -1:
        continue
    owner[r, c] = gi
    dist[r, c] = d
    if r > 0 and land[r-1, c] and owner[r-1, c] == -1:
        heapq.heappush(heap, (d + ec[r-1, c], r-1, c, gi))
    if r+1 < RH and land[r+1, c] and owner[r+1, c] == -1:
        heapq.heappush(heap, (d + ec[r+1, c], r+1, c, gi))
    if c > 0 and land[r, c-1] and owner[r, c-1] == -1:
        heapq.heappush(heap, (d + ec[r, c-1], r, c-1, gi))
    if c+1 < RW and land[r, c+1] and owner[r, c+1] == -1:
        heapq.heappush(heap, (d + ec[r, c+1], r, c+1, gi))

# attach seedless components (islands) to the nearest seed
unassigned = land & (owner == -1)
n_un = int(unassigned.sum())
if n_un:
    print(f"attaching {n_un} island cells…", flush=True)
    seed_px = [(gi, (c + 0.5), (r + 0.5)) for gi, r, c in seed_cells]
    visited = np.zeros((RH, RW), dtype=bool)
    for r0, c0 in np.argwhere(unassigned):
        if visited[r0, c0]:
            continue
        comp = []
        dq = deque([(int(r0), int(c0))])
        visited[r0, c0] = True
        while dq:
            r, c = dq.popleft()
            comp.append((r, c))
            for r2, c2 in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                if 0 <= r2 < RH and 0 <= c2 < RW and unassigned[r2, c2] and not visited[r2, c2]:
                    visited[r2, c2] = True
                    dq.append((r2, c2))
        mr = sum(p[0] for p in comp) / len(comp)
        mc = sum(p[1] for p in comp) / len(comp)
        best, bd = 0, 1e18
        for gi, sx, sy in seed_px:
            dx = abs(sx - mc); dx = min(dx, RW - dx)
            d2 = dx * dx + (sy - mr) ** 2
            if d2 < bd:
                bd, best = d2, gi
        for r, c in comp:
            owner[r, c] = best

# ---------------- subdivision into provinces ----------------
print("subdividing groups into provinces…", flush=True)
group_cells = defaultdict(list)
for r, c in np.argwhere(land):
    group_cells[int(owner[r, c])].append((int(r), int(c)))

prov = np.zeros((RH, RW), dtype=np.int32)   # 0 = sea, 1.. = province
prov_group = {}                              # pid -> group idx
prov_cells_count = Counter()
next_pid = 1

def local_growth(cells, k):
    """k farthest-point sub-seeds + local dijkstra restricted to `cells`."""
    cellset = set(cells)
    # main connected component for seeding
    comp_of = {}
    comps = []
    for cell in cells:
        if cell in comp_of:
            continue
        comp = []
        dq = deque([cell]); comp_of[cell] = len(comps)
        while dq:
            cur = dq.popleft(); comp.append(cur)
            r, c = cur
            for nb in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                if nb in cellset and nb not in comp_of:
                    comp_of[nb] = len(comps); dq.append(nb)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    main = comps[0]
    # farthest-point sampling on the main component (euclidean)
    pts = main
    s0 = min(pts)  # deterministic
    subseeds = [s0]
    if k > 1:
        d2 = {p: (p[0]-s0[0])**2 + (p[1]-s0[1])**2 for p in pts}
        for _ in range(k - 1):
            far = max(pts, key=lambda p: (d2[p], p))
            subseeds.append(far)
            for p in pts:
                nd = (p[0]-far[0])**2 + (p[1]-far[1])**2
                if nd < d2[p]:
                    d2[p] = nd
    # local dijkstra
    sub = {}
    hp = [(0, s[0], s[1], i) for i, s in enumerate(subseeds)]
    heapq.heapify(hp)
    while hp:
        d, r, c, si = heapq.heappop(hp)
        if (r, c) in sub:
            continue
        sub[(r, c)] = si
        for r2, c2 in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
            if (r2, c2) in cellset and (r2, c2) not in sub:
                heapq.heappush(hp, (d + int(ec[r2, c2]), r2, c2, si))
    # attach unreached pieces (other components) to nearest sub-seed
    for comp in comps[1:]:
        mr = sum(p[0] for p in comp) / len(comp)
        mc = sum(p[1] for p in comp) / len(comp)
        best, bd = 0, 1e18
        for i, s in enumerate(subseeds):
            dx = abs(s[1] - mc); dx = min(dx, RW - dx)
            d2v = dx*dx + (s[0]-mr)**2
            if d2v < bd:
                bd, best = d2v, i
        for p in comp:
            sub[p] = best
    # merge tiny sub-regions into largest neighbour
    sizes = Counter(sub.values())
    small = {si for si, n in sizes.items() if n < MIN_SUB and len(sizes) > 1}
    if small:
        for p, si in list(sub.items()):
            if si in small:
                r, c = p
                nbsi = None
                for nb in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                    s2 = sub.get(nb)
                    if s2 is not None and s2 not in small:
                        nbsi = s2; break
                sub[p] = nbsi if nbsi is not None else si
    return sub

groups_meta = []   # (gi, name, ru, [pids])
for gi, cells in sorted(group_cells.items()):
    ne_, ru_, la, lo = seeds[gi]
    n = len(cells)
    mr = sum(p[0] for p in cells) / n
    mc = sum(p[1] for p in cells) / n
    clat, clon = cell_latlon(mr, mc)
    cpp = CPP_BASE * density_mult(clat, clon)
    k = max(1, round(n / cpp), math.ceil(n / MAX_PROV_CELLS))
    k = min(GROUP_KCAP, k)
    if k == 1:
        pid = next_pid; next_pid += 1
        for r, c in cells:
            prov[r, c] = pid
        prov_group[pid] = gi
        prov_cells_count[pid] = n
        groups_meta.append((gi, ne_, ru_, [pid]))
        continue
    sub = local_growth(cells, k)
    simap = {}
    pids = []
    for (r, c), si in sub.items():
        if si not in simap:
            simap[si] = next_pid
            prov_group[next_pid] = gi
            pids.append(next_pid)
            next_pid += 1
        prov[r, c] = simap[si]
        prov_cells_count[simap[si]] += 1
    groups_meta.append((gi, ne_, ru_, pids))

NPROV = next_pid - 1
print(f"groups: {len(groups_meta)}, provinces: {NPROV}")

# ---------------- naming ----------------
OCT_EN = ["East", "Northeast", "North", "Northwest", "West", "Southwest", "South", "Southeast"]
OCT_RU = ["Восток", "Северо-Восток", "Север", "Северо-Запад", "Запад", "Юго-Запад", "Юг", "Юго-Восток"]
prov_centroid = {}
acc = defaultdict(lambda: [0.0, 0.0, 0])
for r, c in np.argwhere(prov > 0):
    p = int(prov[r, c])
    a = acc[p]; a[0] += c; a[1] += r; a[2] += 1
for p, (sx, sy, n) in acc.items():
    prov_centroid[p] = (sx / n, sy / n)

prov_name = {}
for gi, ne_, ru_, pids in groups_meta:
    if len(pids) == 1:
        prov_name[pids[0]] = (ne_, ru_)
        continue
    order = sorted(pids, key=lambda p: -prov_cells_count[p])
    prov_name[order[0]] = (ne_, ru_)
    gx = sum(prov_centroid[p][0] for p in pids) / len(pids)
    gy = sum(prov_centroid[p][1] for p in pids) / len(pids)
    used = Counter()
    for p in order[1:]:
        cx, cy = prov_centroid[p]
        dx = cx - gx
        if dx > RW / 2: dx -= RW
        if dx < -RW / 2: dx += RW
        ang = math.degrees(math.atan2(-(cy - gy), dx))
        oi = int(round(ang / 45.0)) % 8
        sufE, sufR = OCT_EN[oi], OCT_RU[oi]
        used[sufE] += 1
        n_ = used[sufE]
        if n_ > 1:
            sufE = f"{sufE} {n_}"
            sufR = f"{sufR} {n_}"
        prov_name[p] = (f"{ne_} ({sufE})", f"{ru_} ({sufR})")

# ---------------- terrain metadata ----------------
prov_masks = defaultdict(lambda: [0, 0, 0, 0])   # range, desert, plateau, total
for r, c in np.argwhere(prov > 0):
    p = int(prov[r, c])
    m = prov_masks[p]
    m[3] += 1
    if ranges_m[r, c]: m[0] += 1
    if desert_m[r, c]: m[1] += 1
    if plateau_m[r, c]: m[2] += 1

def prov_terrain(p):
    rng, des, plt, tot = prov_masks[p]
    cx, cy = prov_centroid[p]
    lat, lon = cell_latlon(cy, cx)
    if des / tot > 0.45: return "desert"
    if rng / tot > 0.42: return "mountain"
    if plt / tot > 0.45: return "hills"
    if lat > 64 or lat < -52: return "tundra"
    if abs(lat) < 13: return "jungle"
    if 48 < lat < 64: return "forest"
    return "plains"

# ---------------- vectorization ----------------
print("vectorizing…", flush=True)
g = prov  # alias
# anchors: lattice points where 2x2 block has >= 3 distinct ids
pad = np.zeros((RH + 2, RW + 2), dtype=np.int32)
pad[1:-1, 1:-1] = g
a_ = pad[:-1, :-1]; b_ = pad[:-1, 1:]; c_ = pad[1:, :-1]; d_ = pad[1:, 1:]
distinct = (1
    + (b_ != a_).astype(np.int8)
    + ((c_ != a_) & (c_ != b_)).astype(np.int8)
    + ((d_ != a_) & (d_ != b_) & (d_ != c_)).astype(np.int8))
anchor = distinct >= 3      # indexed by lattice point (y, x) in 0..RH, 0..RW

# directed boundary edges per province: interior on the LEFT of travel
# point = (x, y) lattice ints
edges_by_prov = defaultdict(dict)   # pid -> {start_point: [(end_point), ...]}
nz = np.argwhere(g > 0)
for r, c in nz:
    p = int(g[r, c])
    up = int(g[r-1, c]) if r > 0 else 0
    dn = int(g[r+1, c]) if r+1 < RH else 0
    lf = int(g[r, c-1]) if c > 0 else 0
    rt = int(g[r, c+1]) if c+1 < RW else 0
    eb = edges_by_prov[p]
    if up != p:   # top side, interior below → walk west
        eb.setdefault((c+1, r), []).append((c, r))
    if dn != p:   # bottom side, interior above → walk east
        eb.setdefault((c, r+1), []).append((c+1, r+1))
    if lf != p:   # left side, interior east → walk south
        eb.setdefault((c, r), []).append((c, r+1))
    if rt != p:   # right side, interior west → walk north
        eb.setdefault((c+1, r+1), []).append((c+1, r))

def trace_rings(eb):
    """Trace closed rings from directed edges (interior on left)."""
    rings = []
    # consume edges; at junctions prefer the left-most turn
    while eb:
        start = next(iter(eb))
        ring = [start]
        cur = start
        prev_dir = None
        while True:
            outs = eb.get(cur)
            if not outs:
                break
            if len(outs) == 1 or prev_dir is None:
                nxt = outs.pop()
            else:
                # choose left-most turn relative to incoming direction
                def turn_key(np_):
                    dx, dy = np_[0]-cur[0], np_[1]-cur[1]
                    cross = prev_dir[0]*dy - prev_dir[1]*dx
                    dot = prev_dir[0]*dx + prev_dir[1]*dy
                    # left turn (cross<0 in screen coords y-down) first, then straight, then right
                    if cross < 0: rank = 0
                    elif cross == 0 and dot > 0: rank = 1
                    elif cross > 0: rank = 2
                    else: rank = 3
                    return rank
                outs.sort(key=turn_key)
                nxt = outs.pop(0)
            if not outs:
                eb.pop(cur, None)
            prev_dir = (nxt[0]-cur[0], nxt[1]-cur[1])
            cur = nxt
            ring.append(cur)
            if cur == start:
                break
        if len(ring) >= 4 and ring[0] == ring[-1]:
            rings.append(ring)
    return rings

def perp_dist(pt, a, b):
    if a == b:
        return math.hypot(pt[0]-a[0], pt[1]-a[1])
    ax, ay = a; bx, by = b
    t = ((pt[0]-ax)*(bx-ax) + (pt[1]-ay)*(by-ay)) / ((bx-ax)**2 + (by-ay)**2)
    px, py = ax + t*(bx-ax), ay + t*(by-ay)
    return math.hypot(pt[0]-px, pt[1]-py)

def dp_simplify(pts, eps):
    """Reversal-symmetric Douglas-Peucker (ties broken by point value)."""
    if len(pts) <= 2:
        return list(pts)
    stack = [(0, len(pts)-1)]
    keep = [False]*len(pts)
    keep[0] = keep[-1] = True
    while stack:
        i0, i1 = stack.pop()
        if i1 - i0 < 2:
            continue
        a, b = pts[i0], pts[i1]
        best, bi = -1.0, -1
        for i in range(i0+1, i1):
            d = perp_dist(pts[i], a, b)
            if d > best + 1e-9 or (abs(d-best) <= 1e-9 and (bi == -1 or pts[i] < pts[bi])):
                best, bi = d, i
        if best > eps:
            keep[bi] = True
            stack.append((i0, bi)); stack.append((bi, i1))
    return [p for p, k in zip(pts, keep) if k]

def simplify_ring(ring):
    """Split ring at anchors, DP each segment → consistent shared borders."""
    body = ring[:-1]
    n = len(body)
    anchor_idx = [i for i, (x, y) in enumerate(body) if anchor[y, x]]
    if not anchor_idx:
        # no junctions: canonical start + symmetric two-half split
        s = min(range(n), key=lambda i: body[i])
        body = body[s:] + body[:s]
        far = max(range(1, n), key=lambda i: ((body[i][0]-body[0][0])**2 + (body[i][1]-body[0][1])**2, body[i]))
        seg1 = dp_simplify(body[:far+1], DP_EPS)
        seg2 = dp_simplify(body[far:] + [body[0]], DP_EPS)
        out = seg1[:-1] + seg2[:-1]
    else:
        s = anchor_idx[0]
        body = body[s:] + body[:s]
        anchor_idx = sorted((i - s) % n for i in anchor_idx)
        out = []
        for j, i0 in enumerate(anchor_idx):
            i1 = anchor_idx[j+1] if j+1 < len(anchor_idx) else n
            seg = body[i0:i1+1] if i1 < n else body[i0:] + [body[0]]
            simp = dp_simplify(seg, DP_EPS)
            out.extend(simp[:-1])
    if len(out) < 3:
        return None
    out.append(out[0])
    return out

print("  tracing province rings…", flush=True)
prov_polys = {}
fail = 0
for p, eb in edges_by_prov.items():
    rings = trace_rings(eb)
    srings = []
    for ring in rings:
        sr = simplify_ring(ring)
        if sr:
            srings.append(sr)
    if not srings:
        fail += 1
        continue
    # build polygons: nest holes by containment
    polys = []
    shp = []
    for sr in srings:
        pts = [(x * SCALE, y * SCALE) for x, y in sr]
        try:
            poly = Polygon(pts)
            if poly.area < 0.5:
                continue
            shp.append((abs(poly.area), Polygon(pts)))
        except Exception:
            continue
    shp.sort(key=lambda t: -t[0])
    exteriors = []   # [shapely poly exterior ring coords, [holes]]
    for area, poly in shp:
        placed = False
        rp = poly.representative_point()
        for ext in exteriors:
            if ext[0].contains(rp):
                ext[1].append(list(poly.exterior.coords))
                placed = True
                break
        if not placed:
            exteriors.append((poly, []))
    geoms = []
    for ext, holes in exteriors:
        try:
            gp = Polygon(list(ext.exterior.coords), holes)
            if not gp.is_valid:
                gp = gp.buffer(0)
            if not gp.is_empty:
                geoms.append(gp)
        except Exception:
            pass
    if not geoms:
        fail += 1
        continue
    prov_polys[p] = geoms[0] if len(geoms) == 1 else MultiPolygon(
        [gg for g1 in geoms for gg in (g1.geoms if isinstance(g1, MultiPolygon) else [g1])])
print(f"  vectorized {len(prov_polys)} provinces, failures: {fail}")

# ---------------- exports ----------------
def rnd(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 1), round(obj[1], 1)]
        return [rnd(o) for o in obj]
    return obj

def geom_json(g_):
    gm = mapping(g_)
    gm["coordinates"] = rnd(gm["coordinates"])
    return gm

print("writing provinces…", flush=True)
prov_feats = []
gid_of = {}
for idx, (gi, ne_, ru_, pids) in enumerate(groups_meta, start=1):
    gid_of[gi] = idx
for p in sorted(prov_polys):
    if not prov_polys[p].is_valid:
        prov_polys[p] = prov_polys[p].buffer(0)
    if prov_polys[p].is_empty:
        continue
    ne_, ru_ = prov_name[p]
    gi = prov_group[p]
    prov_feats.append({
        "type": "Feature",
        "geometry": geom_json(prov_polys[p]),
        "properties": {
            "id": p, "name": ne_, "name_ru": ru_, "type": "province",
            "parentRegionIds": [gid_of[gi]],
            "terrain": prov_terrain(p),
            "metadata": {"terrain": prov_terrain(p)},
            "notes": ""
        }
    })
json.dump({"type": "FeatureCollection", "features": prov_feats},
          open(OUT_PROV, "w"), ensure_ascii=False, separators=(",", ":"))

print("writing region groups…", flush=True)
group_feats = []
for gi, ne_, ru_, pids in groups_meta:
    members = [prov_polys[p] for p in pids if p in prov_polys]
    if not members:
        continue
    u = unary_union(members)
    if u.is_empty:
        continue
    group_feats.append({
        "type": "Feature",
        "geometry": geom_json(u),
        "properties": {
            "id": gid_of[gi], "regionId": gid_of[gi],
            "name": ne_, "name_ru": ru_, "type": "historical",
            "provinceIds": [p for p in pids if p in prov_polys],
            "provinceCount": len([p for p in pids if p in prov_polys]),
            "color": None, "notes": ""
        }
    })
json.dump({"type": "FeatureCollection", "features": group_feats},
          open(OUT_GROUPS, "w"), ensure_ascii=False, separators=(",", ":"))

print("writing physical features…", flush=True)
phys = []
fid = 1
def add_phys(name, name_ru, typ, geom, importance):
    global fid
    if geom is None or geom.is_empty:
        return
    props = {"id": fid, "name": name, "name_ru": name_ru,
             "type": typ, "visible": True, "importance": importance}
    try:
        rp = geom.representative_point()
        props["labelX"] = round(rp.x, 1)
        props["labelY"] = round(rp.y, 1)
    except Exception:
        pass
    phys.append({"type": "Feature", "geometry": geom_json(geom), "properties": props})
    fid += 1

# land underlay (drawn beneath provinces so simplification slivers never show sea)
land_polys = []
for f in ne_land["features"]:
    for poly in iter_polys(f["geometry"]):
        try:
            pp = Polygon(proj_ring(poly[0]), [proj_ring(h) for h in poly[1:]])
            pp = pp.buffer(0)
            if pp.is_empty or pp.area < 1.0:
                continue
            land_polys.append(pp)
        except Exception:
            pass
land_u = unary_union(land_polys).simplify(1.2)
add_phys("Land", "Суша", "land", land_u, "major")

def title_name(s):
    if not s: return s
    small = {"of", "the", "al", "el", "de", "da", "do"}
    words = s.title().split()
    out = [w.lower() if w.lower() in small and i > 0 else w for i, w in enumerate(words)]
    return " ".join(out).replace("Mts.", "Mts.").replace("’S", "’s")

for f in ne_rivers["features"]:
    pr = f["properties"]
    sr = pr.get("scalerank") or 9
    if sr > 6:
        continue
    importance = "major" if sr <= 3 else ("medium" if sr <= 5 else "minor")
    lines = []
    for line in iter_lines(f["geometry"]):
        pts = proj_ring(line)
        if len(pts) >= 2:
            ls = LineString(pts).simplify(1.0)
            if ls.length > 6:
                lines.append(ls)
    if not lines:
        continue
    geom = lines[0] if len(lines) == 1 else unary_union(lines)
    add_phys(pr.get("name") or "", pr.get("name") or "", "river", geom, importance)

for f in ne_lakes["features"]:
    pr = f["properties"]
    polys = []
    for poly in iter_polys(f["geometry"]):
        try:
            pp = Polygon(proj_ring(poly[0]), [proj_ring(h) for h in poly[1:]]).buffer(0)
            if not pp.is_empty and pp.area > 2.0:
                polys.append(pp)
        except Exception:
            pass
    if not polys:
        continue
    u = unary_union(polys).simplify(0.8)
    importance = "major" if u.area > 110 else ("medium" if u.area > 20 else "minor")
    add_phys(pr.get("name") or "", pr.get("name_ru") or pr.get("name") or "", "lake", u, importance)

for f in ne_geo["features"]:
    pr = f["properties"]
    cla = pr.get("FEATURECLA")
    if cla not in ("Range/mtn", "Desert"):
        continue
    polys = []
    for poly in iter_polys(f["geometry"]):
        try:
            pp = Polygon(proj_ring(poly[0]), [proj_ring(h) for h in poly[1:]]).buffer(0)
            if not pp.is_empty and pp.area > 8.0:
                polys.append(pp)
        except Exception:
            pass
    if not polys:
        continue
    u = unary_union(polys).simplify(1.5)
    srank = pr.get("SCALERANK") or 5
    importance = "major" if srank <= 2 else ("medium" if srank <= 4 else "minor")
    typ = "mountain_range" if cla == "Range/mtn" else "desert"
    add_phys(title_name(pr.get("NAME") or ""), pr.get("NAME_RU") or title_name(pr.get("NAME") or ""), typ, u, importance)

for f in ne_marine["features"]:
    pr = f["properties"]
    cla = pr.get("featurecla")
    if cla not in ("sea", "gulf", "bay", "strait", "channel", "sound", "ocean"):
        continue
    try:
        gshp = shape(f["geometry"])
        rp = gshp.representative_point()
        px = project(rp.x, rp.y)
    except Exception:
        continue
    from shapely.geometry import Point
    srank = pr.get("scalerank")
    srank = 5 if srank is None else srank
    importance = "major" if srank <= 1 else ("medium" if srank <= 3 else "minor")
    typ = "strait" if cla in ("strait", "channel", "sound") else "sea"
    add_phys(pr.get("name") or "", pr.get("name_ru") or pr.get("name") or "", typ,
             Point(px), importance)

json.dump({"type": "FeatureCollection", "features": phys},
          open(OUT_PHYS, "w"), ensure_ascii=False, separators=(",", ":"))

# ---------------- preview png ----------------
print("rendering preview…", flush=True)
def hash32(s):
    h = 2166136261
    for ch in str(s):
        h ^= ord(ch); h = (h * 16777619) & 0xffffffff
    return h
import colorsys
pal = np.zeros((NPROV + 1, 3), dtype=np.uint8)
pal[0] = (168, 199, 219)
for gi, ne_, ru_, pids in groups_meta:
    hgrp = (hash32(ne_) % 360) / 360.0
    for p in pids:
        l = 0.62 + ((hash32(p) % 100) / 100.0 - 0.5) * 0.18
        r_, g_, b_ = colorsys.hls_to_rgb(hgrp, l, 0.32)
        pal[p] = (int(r_*255), int(g_*255), int(b_*255))
rgb = pal[prov]
rgb[river & land] = (60, 100, 160)
edge = np.zeros_like(land)
edge[:, 1:] |= (prov[:, 1:] != prov[:, :-1])
edge[1:, :] |= (prov[1:, :] != prov[:-1, :])
rgb[edge & (prov > 0)] = (90, 84, 70)
Image.fromarray(rgb, "RGB").save(OUT_PREVIEW)

# ---------------- validation ----------------
sizes = sorted(prov_cells_count[p] for p in prov_polys)
names = [prov_name[p][0] for p in prov_polys]
dupes = [n for n, k in Counter(names).items() if k > 1]
invalid = sum(0 if prov_polys[p].is_valid else 1 for p in prov_polys)
print("\n===== SUMMARY =====")
print(f"provinces: {len(prov_polys)} (target 1000-3000) | groups: {len(group_feats)}")
print(f"size cells: min {sizes[0]}, p10 {sizes[len(sizes)//10]}, median {sizes[len(sizes)//2]}, p90 {sizes[9*len(sizes)//10]}, max {sizes[-1]}")
print(f"invalid geometries: {invalid} | duplicate province names: {len(dupes)} {dupes[:6]}")
print(f"physical features: {len(phys)} (rivers {sum(1 for f in phys if f['properties']['type']=='river')}, "
      f"lakes {sum(1 for f in phys if f['properties']['type']=='lake')}, "
      f"ranges {sum(1 for f in phys if f['properties']['type']=='mountain_range')}, "
      f"deserts {sum(1 for f in phys if f['properties']['type']=='desert')}, "
      f"seas/straits {sum(1 for f in phys if f['properties']['type'] in ('sea','strait'))})")
for path in (OUT_PROV, OUT_GROUPS, OUT_PHYS):
    print(f"{path}: {os.path.getsize(path)/1e6:.1f} MB")
