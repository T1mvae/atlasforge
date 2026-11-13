#!/usr/bin/env python3
# AtlasForge — The Fire Rises with the most detailed division the other state mods have
#   -> data/tfr_merged_raw.geojson
#
#   python3 tools/build_tfr.py   (and its Mapshaper line)   then
#   python3 tools/build_tfr_merged.py
#   npx mapshaper data/tfr_merged_raw.geojson -simplify dp 25% keep-shapes \
#       -o format=topojson no-quantization tools/cache/tfr_merged.topojson
#   python3 tools/smooth_topo.py tools/cache/tfr_merged.topojson tools/cache/tfr_merged_s.topojson
#   npx mapshaper tools/cache/tfr_merged_s.topojson -o format=geojson precision=0.1 data/tfr_merged.geojson
# (smooth_topo rounds the borders between borrowed states: KSRE / KSRER draw Europe
#  about 1.5x smaller than TFR, so their pixels come out as steps here.)
#
# Everything is compared and chosen on the mods' own bitmaps (provinces.bmp at full
# resolution); polygons are made once, from the finished raster.
#
# The base is The Fire Rises: its frame, its coast, its countries. The other mods
# (SOURCES, in order) only ever change how a TFR country is divided inside:
#   1. every mod becomes a raster of state numbers (provinces.bmp + definition.csv +
#      states/*.txt). A mod that defines only some states leaves the rest of the land
#      "unassigned" — nothing is taken from there.
#   2. a mod on another map (KSRE / KSRER: 5120x2560, another projection) is laid over
#      the TFR frame: a spline from the states that carry the same name and the same
#      shape, then refined by matching the coastlines block by block. The raster is
#      resampled once, at full resolution.
#   3. inside every country the states of the map so far and of the mod are grouped
#      into blocks — sets of states that cover the same ground in both (a state
#      overlapping another by a good share joins its block). A block is a place where
#      the two divisions can be swapped without touching anything outside it; where the
#      mod has more states in a block, and covers all of it, the block takes the mod's
#      division. The next mod is compared with the result.
# States taken from a mod keep that mod's name (English only) and the TFR owner; their
# ids are the mod's letter + its state id ("r1483"), and `source` names the mod.
import csv, glob, json, os, re, sys, time
import numpy as np
from collections import Counter, defaultdict
from PIL import Image
from scipy import ndimage
from scipy.interpolate import RBFInterpolator
from scipy.signal import fftconvolve
from shapely.geometry import box, mapping, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "maps_references")
STEAM = os.path.expanduser("~/Library/Application Support/Steam/steamapps/workshop/content/394360")
BASE = os.path.join(REF, "map_fire_rises")
A_PROPS = os.path.join(ROOT, "data", "tfr_states_raw.geojson")     # names, owners, colours by state id
OUT = os.path.join(ROOT, "data", "tfr_merged_raw.geojson")
# (key, id letter, folder with provinces.bmp + definition.csv + states/, workshop id for the names)
SOURCES = [
    ("ksrer", "r", os.path.join(REF, "map_ksrer"), "3817978431"),
    ("ksre", "k", os.path.join(REF, "map_ksre"), "2887517564"),
    ("nemos", "n", os.path.join(REF, "map_nemos_states"), "2843687331"),
]
LINK = 0.2        # a state overlapping another by this share of the smaller one joins its block
KEEP = 0.5        # a mod's state counts in a block that holds this share of it …
KEEP_A = 0.5      # … or a piece this large against the block's average state
MIN_PX = 12       # full-res pixels: nothing smaller becomes a state of its own
MAX_HOLE = 0.02   # share of a block the mod may leave unassigned and still be taken
MAX_SEA = 0.25    # share of a block the mod may show as sea (the coasts differ)

t0 = time.time()
def log(*a): print(*a, "(%.0fs)" % (time.time() - t0), flush=True)


# ---------------------------------------------------------------- 1. a mod -> raster of states
def load(folder, names=None):
    """lab: 0 sea / not land, -1 land in no state, 1..n = states[i-1]."""
    keys, pids, land = [], [], set()
    for row in csv.reader(open(os.path.join(folder, "definition.csv"), errors="ignore"), delimiter=";"):
        try: pid = int(row[0]); r, g, b = int(row[1]), int(row[2]), int(row[3])
        except (ValueError, IndexError): continue
        keys.append((r << 16) | (g << 8) | b); pids.append(pid)
        if len(row) > 4 and row[4] == "land": land.add(pid)
    keys = np.array(keys, np.uint32); pids = np.array(pids, np.int32)
    o = np.argsort(keys); keys, pids = keys[o], pids[o]
    states, claims, seen, dup = [], defaultdict(list), set(), 1000000
    for fp in sorted(glob.glob(os.path.join(folder, "states", "*.txt"))):
        txt = re.sub(r"#.*", "", open(fp, encoding="utf-8", errors="ignore").read())
        m = re.search(r"\bid\s*=\s*(\d+)", txt)
        if not m: continue
        sid = int(m.group(1))
        if sid in seen: sid = dup; dup += 1
        seen.add(sid)
        base = os.path.basename(fp)[:-4]
        fname = base.split("-", 1)[1].strip() if "-" in base else base
        km = re.search(r'\bname\s*=\s*"?(STATE_[A-Za-z0-9_]+)', txt)
        pm = re.search(r"provinces\s*=\s*\{([^}]*)\}", txt)
        prov = [int(x) for x in re.findall(r"\d+", pm.group(1))] if pm else []
        cm = re.search(r"state_category\s*=\s*(\w+)", txt)
        states.append({"sid": sid, "fname": fname, "name": (names or {}).get(km.group(1) if km else "") or fname,
                       "cat": cm.group(1) if cm else None, "prov": prov})
        for p in prov: claims[p].append(len(states))
    maxpid = int(pids.max())
    p2s = np.zeros(maxpid + 2, np.int32)
    for p in land:
        if p <= maxpid: p2s[p] = -1
    for p, cl in claims.items():                           # the smallest state wins a shared province
        if p <= maxpid: p2s[p] = min(cl, key=lambda s: (len(states[s - 1]["prov"]), s))
    arr = np.asarray(Image.open(os.path.join(folder, "provinces.bmp")).convert("RGB")).astype(np.uint32)
    k = (arr[:, :, 0] << 16) | (arr[:, :, 1] << 8) | arr[:, :, 2]
    pos = np.clip(np.searchsorted(keys, k), 0, len(keys) - 1)
    pid = np.where(keys[pos] == k, pids[pos], maxpid + 1)
    return p2s[pid], states


def state_names(workshop):
    out = {}
    files = sorted(glob.glob(os.path.join(STEAM, workshop, "localisation", "english", "**", "*.yml"), recursive=True),
                   key=lambda p: (os.sep + "replace" + os.sep in p, p))
    for fp in files:
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            m = re.match(r'\s*(STATE_\d+)\s*:\s*\d*\s*"([^"]+)"', line)
            if m and m.group(1) not in out: out[m.group(1)] = m.group(2).strip()
    return out


# ---------------------------------------------------------------- 2. another map onto the frame
def half(lab):
    return lab[::2, ::2]

def centroids(lab, states):
    idx = np.arange(1, len(states) + 1)
    area = ndimage.sum(np.ones(lab.shape, np.uint8), lab, idx)
    com = ndimage.center_of_mass(np.ones(lab.shape, np.uint8), lab, idx)
    out = defaultdict(list)
    for s, a, c in zip(states, area, com):
        if a > 0: out[s["name"].strip().lower()].append((c[1], c[0], a))   # the file names are often stale
    return out

def register(labA, statesA, labS, statesS):
    """Coordinates in S (full-res x, y) for every full-res pixel of A."""
    a2, s2 = half(labA), half(labS)
    H, W = a2.shape; Hs, Ws = s2.shape
    ca, cs = centroids(a2, statesA), centroids(s2, statesS)
    common = [n for n in ca if n in cs and len(ca[n]) == 1 and len(cs[n]) == 1]
    pa = np.array([ca[n][0][:2] for n in common]); ps = np.array([cs[n][0][:2] for n in common])
    ratio = np.array([ca[n][0][2] / cs[n][0][2] for n in common])
    ok = (ratio > 0.8) & (ratio < 2.6)                     # the same state, not just the same name
    # from nearly a plane to a spline: a wrong pair (one name, two places) must fall out
    # while the fit is still too stiff to bend to it
    for sm, lim in [(1e9, 60), (1e8, 40), (1e7, 25), (1e6, 15), (1e5, 10), (2e4, 6), (2e4, 5)]:
        f = RBFInterpolator(pa[ok], ps[ok], kernel="thin_plate_spline", smoothing=sm)
        r = np.hypot(*(f(pa) - ps).T)
        ok = r < max(lim, 2.5 * np.median(r[ok]))
    pa, ps = pa[ok], ps[ok]
    inv = RBFInterpolator(pa, ps, kernel="thin_plate_spline", smoothing=20000)
    ST = 8                                                 # the map A -> S is kept on a lattice
    gy, gx = np.mgrid[0:H + ST:ST, 0:W + ST:ST].astype(float)
    G = inv(np.c_[gx.ravel(), gy.ravel()]).reshape(gy.shape + (2,))
    def dense(scale=1):
        h, w = H * scale, W * scale
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        c = [yy / (ST * scale), xx / (ST * scale)]
        return [ndimage.map_coordinates(G[:, :, k], c, order=1, mode="nearest") for k in (0, 1)]
    def sample(img, sx, sy):
        xi = np.rint(sx).astype(np.int32); yi = np.rint(sy).astype(np.int32)
        inside = (xi >= 0) & (xi < img.shape[1]) & (yi >= 0) & (yi < img.shape[0])
        return np.where(inside, img[np.clip(yi, 0, img.shape[0] - 1), np.clip(xi, 0, img.shape[1] - 1)], 0)
    landA = a2 != 0; landS = s2 != 0
    for bs, rng in [(128, 40), (96, 24), (64, 12), (48, 8), (48, 6)]:
        sx, sy = dense()
        lb = sample(landS, sx, sy)
        pts, sh = [], []
        for y0 in range(0, H - bs + 1, bs // 2):
            for x0 in range(0, W - bs + 1, bs // 2):
                a = landA[y0:y0 + bs, x0:x0 + bs].astype(np.float32)
                if not 0.04 < a.mean() < 0.96: continue    # only blocks with a coast in them
                y1, y2 = max(0, y0 - rng), min(H, y0 + bs + rng); x1, x2 = max(0, x0 - rng), min(W, x0 + bs + rng)
                b = lb[y1:y2, x1:x2].astype(np.float32)
                c = fftconvolve(2 * b - 1, (2 * a - 1)[::-1, ::-1], mode="valid")
                j = np.unravel_index(np.argmax(c), c.shape)
                dy, dx = (y0 - y1) - j[0], (x0 - x1) - j[1]
                if c[j] / (bs * bs) < 0.8 or abs(dx) >= rng - 1 or abs(dy) >= rng - 1: continue
                pts.append((x0 + bs / 2, y0 + bs / 2)); sh.append((dx, dy))
        # the named states hold the inland, where there is no coast to match
        cur = np.c_[sample_at(G, pa, ST, 0), sample_at(G, pa, ST, 1)]
        sc = local_scale(G, pa, ST)
        # there G(pa - d) must be ps:  d = (G(pa) - ps) / scale
        pts = np.r_[np.array(pts), pa]; sh = np.r_[np.array(sh, float), (cur - ps) / sc]
        if os.environ.get("TFR_DEBUG"):
            la_, lb_ = landA, lb != 0
            print("   reg", bs, "IoU %.3f" % ((la_ & lb_).sum() / (la_ | lb_).sum()), "blocks", len(pts) - len(pa),
                  "cp resid", np.median(np.hypot(*(cur - ps).T)).round(2), "scale", np.median(sc, axis=0).round(3), sc.min().round(3), flush=True)
        sh = np.clip(sh, -rng, rng)
        D = RBFInterpolator(pts, sh, kernel="thin_plate_spline", smoothing=len(pts) * 2.0)
        # far from every coast and named state (open ocean) the spline is a guess: never beyond the search range
        d = np.clip(D(np.c_[gx.ravel(), gy.ravel()]).reshape(gy.shape + (2,)), -rng, rng)
        c = [(gy - d[:, :, 1]) / ST, (gx - d[:, :, 0]) / ST]   # moving the picture by d = reading it at p - d
        G = np.dstack([ndimage.map_coordinates(G[:, :, k], c, order=1, mode="nearest") for k in (0, 1)])
    sx, sy = dense(2)
    out = sample(labS, sx * 2 + 0.5, sy * 2 + 0.5)
    la, lb = labA != 0, out != 0
    return out, 100.0 * (la & lb).sum() / (la | lb).sum(), len(pa)

def sample_at(G, p, ST, k):
    return ndimage.map_coordinates(G[:, :, k], [p[:, 1] / ST, p[:, 0] / ST], order=1, mode="nearest")

def local_scale(G, p, ST):
    gxx = np.gradient(G[:, :, 0], axis=1) / ST; gyy = np.gradient(G[:, :, 1], axis=0) / ST
    c = [p[:, 1] / ST, p[:, 0] / ST]
    sc = np.c_[ndimage.map_coordinates(gxx, c, order=1, mode="nearest"),
               ndimage.map_coordinates(gyy, c, order=1, mode="nearest")]
    return np.where(np.abs(sc) < 0.2, 1.0, sc)


# ---------------------------------------------------------------- 3. take the finer division
def refine(cur, meta, own, S, statesS, key, letter):
    """cur: labels 1..len(meta) over the land; own[label] = country; S: the mod on the same frame."""
    n, nS = len(meta), len(statesS)
    land = cur > 0
    sv = S[land]
    pairs = cur[land].astype(np.int64) * (nS + 2) + (sv + 1)       # +1: unassigned -1 -> 0, sea 0 -> 1
    uk, cnt = np.unique(pairs, return_counts=True)
    ua, ub = (uk // (nS + 2)).astype(int), (uk % (nS + 2)).astype(int) - 1
    area = np.bincount(cur[land], minlength=n + 1)
    areaS = np.bincount(S[S > 0], minlength=nS + 1)
    part = defaultdict(int)                                # a mod's state is a separate thing in every country
    for a, b, c in zip(ua, ub, cnt):
        if b > 0: part[(own[a], b)] += c
    parent = list(range(n + 1))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    first = {}
    for a, b, c in zip(ua, ub, cnt):
        if b <= 0 or not own[a]: continue                  # ownerless placeholders stay as they are
        if c < MIN_PX or c < LINK * min(area[a], part[(own[a], b)]): continue
        k = (own[a], b)
        if k in first: parent[find(a)] = find(first[k])
        else: first[k] = a
    block = [find(a) for a in range(n + 1)]
    members = defaultdict(list)
    for a in range(1, n + 1): members[block[a]].append(a)
    ov = defaultdict(lambda: defaultdict(int))
    for a, b, c in zip(ua, ub, cnt): ov[block[a]][b] += c

    objs = ndimage.find_objects(cur, max_label=n)
    out = cur.copy(); new_meta = list(meta); new_own = list(own)
    dead = set(); taken = 0; used = Counter()
    for blk, mem in members.items():
        if not own[mem[0]] or any(objs[a - 1] is None for a in mem): continue
        barea = float(sum(area[a] for a in mem))
        if ov[blk].get(-1, 0) > MAX_HOLE * barea or ov[blk].get(0, 0) > MAX_SEA * barea: continue
        kept = [b for b, c in ov[blk].items()
                if b > 0 and c >= MIN_PX and (c >= KEEP * areaS[b] or c >= KEEP_A * barea / len(mem))]
        if len(kept) <= len(mem): continue
        ys = [objs[a - 1][0] for a in mem]; xs = [objs[a - 1][1] for a in mem]
        sl = (slice(min(s.start for s in ys), max(s.stop for s in ys)), slice(min(s.start for s in xs), max(s.stop for s in xs)))
        inblk = np.isin(cur[sl], mem)
        sub = S[sl]
        new = np.zeros(inblk.shape, np.int32)
        for i, b in enumerate(kept): new[inblk & (sub == b)] = i + 1
        # crumbs the block's outline cuts off a state go to whatever lies around them
        cl, nc = ndimage.label(new > 0)
        if nc > len(kept):
            lab_of = ndimage.maximum(new, cl, np.arange(1, nc + 1)).astype(int)
            size = ndimage.sum(np.ones(new.shape, np.uint8), cl, np.arange(1, nc + 1))
            # 4-connected pieces of ONE state: label() joined neighbours of different states, so split per state
            for i in range(1, len(kept) + 1):
                ci, ni = ndimage.label(new == i)
                if ni < 2: continue
                sz = ndimage.sum(np.ones(new.shape, np.uint8), ci, np.arange(1, ni + 1))
                big = sz.max()
                for j in range(ni):
                    if sz[j] < 0.03 * big and sz[j] < 400: new[ci == j + 1] = 0
        hole = inblk & (new == 0)                          # the mod's sea, a sliver from next door, a crumb
        if hole.any():
            ind = ndimage.distance_transform_edt(new == 0, return_distances=False, return_indices=True)
            new[hole] = new[tuple(ind)][hole]
        if len(np.unique(new[inblk])) <= len(mem): continue
        taken += 1; dead.update(mem)
        base = len(new_meta)
        for i, b in enumerate(kept):
            st = statesS[b - 1]; used[st["sid"]] += 1
            fid = "%s%d" % (letter, st["sid"]) + ("" if used[st["sid"]] == 1 else "_%d" % used[st["sid"]])
            props = {"id": fid, "name": st["name"], "state_category": st["cat"], "source": key}
            new_meta.append(props); new_own.append(own[mem[0]])
        out[sl] = np.where(inblk, new + base, out[sl])
    # renumber: drop the replaced states and the pieces that got no pixel
    alive = np.zeros(len(new_meta) + 1, bool); alive[np.unique(out)] = True; alive[0] = False
    remap = np.zeros(len(new_meta) + 1, np.int32); remap[alive] = np.arange(1, alive.sum() + 1)
    meta2 = [m for i, m in enumerate(new_meta, 1) if alive[i]]
    own2 = [""] + [o for i, o in enumerate(new_own[1:], 1) if alive[i]]
    return remap[out], meta2, own2, len(members), taken


# ---------------------------------------------------------------- run
labA, statesA = load(BASE)
propsA = {f["properties"]["id"]: f["properties"] for f in json.load(open(A_PROPS, encoding="utf-8"))["features"]}
# TFR leaves no land outside a state; anything else would be a hole in the map
labA = np.where(labA < 0, 0, labA)
meta, own = [], [""]
for s in statesA:
    p = dict(propsA.get("s%d" % s["sid"]) or {"id": "s%d" % s["sid"], "name": s["name"]})
    s["name"] = p.get("name") or s["name"]
    meta.append(p); own.append(p.get("owner_tag") or "")
terrA = {p["id"]: p.get("terrain") for p in meta}
cur = labA.copy()
# labels must be exactly 1..len(meta): states with no pixel keep their slot (find_objects gives None)
log("base: The Fire Rises, %d states" % len(np.unique(cur[cur > 0])))
tfr_owner = dict((p.get("owner_tag"), p) for p in meta if p.get("owner_tag"))
before = Counter(o for o in own[1:] if o)
for key, letter, folder, workshop in SOURCES:
    labS, statesS = load(folder, state_names(workshop))
    cover = 100.0 * (labS > 0).sum() / max(1, (labS != 0).sum())
    if labS.shape != labA.shape:
        labS, iou, ncp = register(labA, statesA, labS, statesS)
        note = "laid over the frame by %d states + coasts, land in common %.1f %%" % (ncp, iou)
    else:
        la, lb = labA != 0, labS != 0
        note = "same frame, land in common %.1f %%" % (100.0 * (la & lb).sum() / (la | lb).sum())
    n0 = len(meta)
    cur, meta, own, nblk, taken = refine(cur, meta, own, labS, statesS, key, letter)
    log("%s: %d states over %.0f %% of its land; %s; taken in %d of %d blocks: %d -> %d states" % (
        key, len(statesS), cover, note, taken, nblk, n0, len(meta)))

# ---------------------------------------------------------------- polygons, once
def mask_to_poly(mask, x0, y0):
    boxes = []
    for r in range(mask.shape[0]):
        d = np.diff(np.concatenate(([0], mask[r].view(np.int8), [0])))
        for c0, c1 in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    g = unary_union(boxes).simplify(0, preserve_topology=True)
    return g if g.is_valid else g.buffer(0)

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])

def rnd(o):
    if isinstance(o[0], (int, float)): return [round(o[0] * 0.5, 1), round(o[1] * 0.5, 1)]
    return [rnd(x) for x in o]

# terrain of a borrowed state = the TFR terrain most of it lies on
terr_ids = sorted(set(t for t in terrA.values() if t)); terr_ix = {t: i + 1 for i, t in enumerate(terr_ids)}
a_terr = np.array([0] + [terr_ix.get(terrA.get("s%d" % s["sid"]), 0) for s in statesA], np.int16)
terr_img = a_terr[labA]
OWNER_KEYS = ("owner", "owner_tag", "owner_ru", "owner_color")
feats = []; by_src = Counter(); after = Counter()
objs = ndimage.find_objects(cur, max_label=len(meta))
for lab, props in enumerate(meta, 1):
    sl = objs[lab - 1]
    if sl is None: continue
    mask = cur[sl] == lab
    p = dict(props)
    if p.get("source"):
        ap = tfr_owner.get(own[lab]) or {}
        for k in OWNER_KEYS:
            if ap.get(k) is not None: p[k] = ap[k]
        tv = np.bincount(terr_img[sl][mask], minlength=len(terr_ids) + 1); tv[0] = 0
        p["terrain"] = terr_ids[int(tv.argmax()) - 1] if tv.any() else None
        p.setdefault("ownerCountryId", None); p.setdefault("notes", ""); p["color"] = "#e8e6e2"
    by_src[p.get("source") or "tfr"] += 1; after[own[lab]] += 1
    gm = mapping(orient_d3(mask_to_poly(mask, sl[1].start, sl[0].start)))
    gm["coordinates"] = rnd(gm["coordinates"])
    feats.append({"type": "Feature", "id": p["id"], "geometry": gm, "properties": p})
assert len(set(f["id"] for f in feats)) == len(feats)
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT, "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
log("wrote %s: %d states — %s" % (os.path.relpath(OUT, ROOT), len(feats),
    ", ".join("%s %d" % kv for kv in by_src.most_common())))
gain = sorted(((after[o] - before[o], o) for o in after if o), reverse=True)
print("most added:", ", ".join("%s %d→%d" % (o, before[o], after[o]) for g, o in gain[:30] if g > 0))
