#!/usr/bin/env python3
# AtlasForge — build the A Game of Thrones (CK3 mod) map from its map_data folder,
# optionally with a submod folder nested inside it that extends the same map
# (map_data_legacy_of_valyria: Valyria, Volantis, Slaver's Bay, Sothoryos, Asshai…).
#
# Sources
#   provinces.png   every province a unique colour
#   definition.csv  colour -> province id + barony key
#   default.map     which ids are sea / lake / river / impassable
#   provinces/*.txt province history; its banner comments carry the CK3 title
#                   hierarchy, and the FILE name carries the kingdom
# When a submod folder is present its provinces.png / definition.csv / default.map
# WIN (it repaints and re-numbers part of the map), and its province history is
# merged on top of the base one — base entries for ids the submod re-used are
# dropped, so nothing keeps a stale title.
#
# Output: four nested levels in the SAME pixel frame (game projection):
#   data/agot_counties.geojson  (the primary editable map)
#   data/agot_duchies.geojson / data/agot_kingdoms.geojson  (coarser levels)
#   data/agot_baronies.geojson  (full detail)
import colorsys, glob, hashlib, json, os, re, sys, time
from collections import Counter
import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping, MultiPolygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agot_source import load as load_source, BASE_OFFSET

Image.MAX_IMAGE_PIXELS = None
SRC = sys.argv[1] if len(sys.argv) > 1 else "map_data_agot"
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "data"
# a nested folder that also looks like map_data = a submod extending this map
OVERLAYS = sorted(d for d in glob.glob(os.path.join(SRC, "map_data_*"))
                  if os.path.isfile(os.path.join(d, "provinces.png")))
MAPDIR = OVERLAYS[-1] if OVERLAYS else SRC     # images + definition + default.map

COORD_SCALE = 0.25   # provinces.png is 9216x6144 -> a 2304x1536 working frame
NDIG = 2             # rounding is deterministic, so shared borders stay identical
SIMPLIFY = 0.0       # exact pixel tiling; mapshaper does the topological simplify
MIN_AREA = 4         # full-res px
IMPASSABLE_MIN_PX = 50000   # bigger impassable blocks stay units of their own

t0 = time.time()
def log(m): print(m, flush=True)
log("base %s, map data %s" % (SRC, MAPDIR))

# ---------------------------------------------------------------- names
SMALL = {"of", "the", "by", "in", "on", "at", "and", "upon", "de", "a", "an", "under", "to"}
NAME_OVERRIDE = {}
def pretty(key):
    if not key: return ""
    if key in NAME_OVERRIDE: return NAME_OVERRIDE[key]
    w = key.split("_", 1)[1] if re.match(r"^[bcdke]_", key) else key
    out = []
    for i, p in enumerate(w.split("_")):
        if not p: continue
        out.append(p if (p in SMALL and i > 0) else (p[:1].upper() + p[1:]))
    return " ".join(out)

def titlecase(s):
    out = []
    for i, p in enumerate(s.split()):
        out.append(p if (p.lower() in SMALL and i > 0) else
                   (p if any(c.islower() for c in p) else p[:1] + p[1:].lower()))
    return " ".join(out)

def slug(s):
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", s.lower())).strip("_")

def stem(key):
    """b_asshai_9 / b_draconys9 -> asshai / draconys (the sibling-barony group)"""
    return re.sub(r"_?\d+$", "", key[2:] if key.startswith("b_") else key)

# ---------------------------------------------------------------- source raster
# base map + submod composited into one unified id space (see tools/agot_source.py)
SRCSTATE = load_source(SRC, log)
pid_img   = SRCSTATE["pid"]
W, H      = SRCSTATE["W"], SRCSTATE["H"]
MAXPID    = SRCSTATE["maxpid"]
prov_barony = SRCSTATE["barony"]
LAND, MOUNT = SRCSTATE["land"], SRCSTATE["mount"]
MAPDIR    = SRCSTATE["mapdir"]
pidc      = np.clip(pid_img, 0, MAXPID + 1)
prov_px   = np.bincount(pidc.ravel(), minlength=MAXPID + 2)
# ids the submod re-used for somewhere else entirely: the base history for them is
# only valid for the pixels that came from the BASE raster (id + BASE_OFFSET).
# only ids that actually own pixels in the composite are real units
LAND  = {p for p in LAND if prov_px[p] > 0}
MOUNT = {p for p in MOUNT if prov_px[p] > 0}
base_barony = {p - BASE_OFFSET: k for p, k in prov_barony.items() if p > BASE_OFFSET}
REPAINTED = {p for p, k in base_barony.items() if prov_barony.get(p, k) != k}
log("provinces: %d land + %d impassable carry pixels, %d ids re-used by the submod (%.1fs)"
    % (len(LAND), len(MOUNT), len(REPAINTED), time.time() - t0))

# ---------------------------------------------------------------- province history
# Base (AGOT) files carry a two-line banner per province:
#   ################### b_winterfell ##################
#   ########### c_winterfell - d_winterfell ###########
RE_CD = re.compile(r"#+\s*(c_[A-Za-z0-9_\-]+)\s*-\s*(d_[A-Za-z0-9_\-]+)\s*#+")
RE_ID = re.compile(r"^\s*(\d+)\s*=\s*\{")
prov = {}

def parse_base(folder):
    """Base titles land twice: on the raw id (unless the submod re-used it) and on
    id+BASE_OFFSET, which is what the pixels the submod blanked out now carry."""
    n = 0
    for fp in sorted(glob.glob(os.path.join(folder, "*.txt"))):
        base = os.path.basename(fp)[:-4]
        m = re.search(r"(k_[A-Za-z0-9_\-]+?)_prov$", base)
        king = m.group(1) if m else base
        cd, depth = None, 0
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            mm = RE_CD.search(line)
            if mm: cd = (mm.group(1), mm.group(2)); continue
            if depth == 0:
                mm = RE_ID.match(line)
                if mm and cd:
                    pid = int(mm.group(1))
                    if pid not in REPAINTED:
                        prov[pid] = {"b": prov_barony.get(pid), "c": cd[0], "d": cd[1], "k": king}
                        n += 1
                    off = pid + BASE_OFFSET
                    if off in prov_barony:
                        prov[off] = {"b": prov_barony[off], "c": cd[0], "d": cd[1], "k": king}
            depth += line.count("{") - line.count("}")
            if depth < 0: depth = 0
    return n

# Submod files are laid out differently: a `# DUCHY OF X` line opens a duchy and a
# `##### Name #####` (or bare `#name`) comment opens a county, with its baronies
# listed underneath. Keys are namespaced per kingdom so a submod "Ghoyan Drohe -
# Ruin" never merges into the base map's county of the same name.
RE_DUCHY  = re.compile(r"^\s*#+\s*duch(?:y|ies)\s+of\s+(.+?)\s*#*\s*$", re.I)
RE_BANNER = re.compile(r"^\s*#+\s*([^#=]{2,44}?)\s*#*\s*$")
RE_NOISE  = re.compile(r"unfinished|todo|\bmake\b|^\d|=|special ruins|graphical", re.I)

def parse_overlay(folder):
    n = 0
    for fp in sorted(glob.glob(os.path.join(folder, "*.txt"))):
        base = re.sub(r"^lv_", "", os.path.basename(fp)[:-4])
        king = base if base.startswith("k_") else "k_" + base
        NAME_OVERRIDE.setdefault(king, pretty(king))
        ckey = dkey = None
        depth = 0
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            if depth == 0 and line.lstrip().startswith("#"):
                mm = RE_DUCHY.match(line)
                if mm:
                    txt = titlecase(mm.group(1).strip())
                    dkey = "d_%s_%s" % (king[2:], slug(txt)); NAME_OVERRIDE[dkey] = txt
                    ckey = None
                else:
                    mm = RE_BANNER.match(line)
                    if mm and not RE_NOISE.search(mm.group(1)):
                        txt = titlecase(mm.group(1).replace("_", " ").strip())
                        ckey = "c_%s_%s" % (king[2:], slug(txt)); NAME_OVERRIDE[ckey] = txt
                continue
            if depth == 0:
                mm = RE_ID.match(line)
                if mm:
                    pid = int(mm.group(1))
                    c = ckey or ("c_%s_%s" % (king[2:], slug(stem(prov_barony.get(pid, "") or str(pid)))))
                    d = dkey or c.replace("c_", "d_", 1)
                    prov[pid] = {"b": prov_barony.get(pid), "c": c, "d": d, "k": king}
                    n += 1
            depth += line.count("{") - line.count("}")
            if depth < 0: depth = 0
    return n

nb = parse_base(os.path.join(SRC, "provinces"))
no = parse_overlay(os.path.join(MAPDIR, "provinces")) if MAPDIR != SRC else 0
log("history: %d from base, %d from submod (%.1fs)" % (nb, no, time.time() - t0))

# Land provinces with no history line at all (the submod only writes the ones that
# hold something): adopt the title of a sibling barony — b_asshai_9 follows
# b_asshai_1. Whatever is still left is absorbed spatially further down.
by_stem = {}
for p, v in prov.items():
    b = v["b"]
    if b: by_stem.setdefault(stem(b), v)
adopted = 0
for p in sorted(LAND - set(prov)):
    v = by_stem.get(stem(prov_barony.get(p, "") or ""))
    if v:
        prov[p] = {"b": prov_barony.get(p), "c": v["c"], "d": v["d"], "k": v["k"]}
        adopted += 1
prov = {p: v for p, v in prov.items() if p in LAND}
log("history: %d land provinces titled (%d adopted from a sibling barony), %d left to absorb"
    % (len(prov), adopted, len(LAND) - len(prov)))

counties = sorted({v["c"] for v in prov.values() if v["c"]})
duchies  = sorted({v["d"] for v in prov.values() if v["d"]})
kingdoms = sorted({v["k"] for v in prov.values()})
log("titles: %d counties, %d duchies, %d kingdoms" % (len(counties), len(duchies), len(kingdoms)))

# ---------------------------------------------------------------- geographical regions
duchy_region = {}
for gf in sorted(set(glob.glob(os.path.join(SRC, "geographical_regions", "*.txt"))) |
                 set(glob.glob(os.path.join(MAPDIR, "geographical_regions", "*.txt")))):
    txt = re.sub(r"#.*", "", open(gf, encoding="utf-8-sig", errors="ignore").read())
    for m in re.finditer(r"(world_[A-Za-z0-9_]+)\s*=\s*\{(.*?)\n\}", txt, re.S):
        dm = re.search(r"duchies\s*=\s*\{([^}]*)\}", m.group(2))
        if not dm: continue
        for d in re.findall(r"d_[A-Za-z0-9_\-]+", dm.group(1)):
            duchy_region.setdefault(d, m.group(1))
log("geographical regions: %d duchies -> %d world regions"
    % (len(duchy_region), len(set(duchy_region.values()))))

# ---------------------------------------------------------------- colours
def _h(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16)
king_hue = {k: (_h(k) % 360) / 360.0 for k in kingdoms}
def shade(king, fid):
    if king == "k_impassable": return "#cfcbc4"
    hu = king_hue.get(king, 0.12)
    j = _h(fid)
    r, g, b = colorsys.hls_to_rgb(hu, 0.845 + (j & 15) * 0.004, 0.16 + ((j >> 4) & 7) * 0.006)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))

# The impassable provinces carry no title. Small ones are mountain passes inside a
# realm and get absorbed by whatever surrounds them; the big ones are real terrain
# — AGOT's id 6620 is the unmapped far east — so they become neutral units of
# their own instead of being swallowed by whichever county happens to touch them.
big_imp = sorted((p for p in MOUNT if prov_px[p] >= IMPASSABLE_MIN_PX), key=lambda p: -prov_px[p])
for i, p in enumerate(big_imp, start=1):
    label = "Impassable terrain" + ("" if len(big_imp) == 1 else " %d" % i)
    prov[p] = {"b": "b_impassable_%d" % p, "c": "c_impassable_%d" % p,
               "d": "d_impassable", "k": "k_impassable"}
    NAME_OVERRIDE["b_impassable_%d" % p] = label
    NAME_OVERRIDE["c_impassable_%d" % p] = label
if big_imp:
    NAME_OVERRIDE["d_impassable"] = NAME_OVERRIDE["k_impassable"] = "Impassable terrain"
    counties = sorted({v["c"] for v in prov.values() if v["c"]})
    duchies  = sorted({v["d"] for v in prov.values() if v["d"]})
    kingdoms = sorted({v["k"] for v in prov.values()})
log("impassable: %d kept as their own units (%s), %d small ones absorbed"
    % (len(big_imp), ", ".join("%d=%dpx" % (p, prov_px[p]) for p in big_imp) or "none",
       len(MOUNT) - len(big_imp)))

def label_image(pid2lab):
    lut = np.zeros(MAXPID + 2, np.int32)
    for p, l in pid2lab.items():
        if 0 <= p <= MAXPID + 1: lut[p] = l
    return np.where(pid_img >= 0, lut[pidc], 0).astype(np.int32)

# every land pixel with no unit yet (small impassables, untitled leftovers)
ORPHAN = (LAND | MOUNT) - set(prov)
orphan_img = None
if ORPHAN:
    olut = np.zeros(MAXPID + 2, np.int32)
    for i, p in enumerate(sorted(ORPHAN)): olut[p] = i + 1
    orphan_img = np.where(pid_img >= 0, olut[pidc], 0).astype(np.int32)
    orphan_objs = ndimage.find_objects(orphan_img)

def absorb_orphans(lab_img):
    """give every untitled land province to the unit it borders most"""
    if orphan_img is None: return 0
    done = 0
    for i, sl in enumerate(orphan_objs, start=1):
        if sl is None: continue
        pad = (slice(max(0, sl[0].start - 2), min(H, sl[0].stop + 2)),
               slice(max(0, sl[1].start - 2), min(W, sl[1].stop + 2)))
        sub = orphan_img[pad] == i
        ring = ndimage.binary_dilation(sub, ndimage.generate_binary_structure(2, 2), 2) & ~sub
        neigh = lab_img[pad][ring]; neigh = neigh[neigh > 0]
        if not neigh.size: continue
        lab_img[pad] = np.where(sub, int(Counter(neigh.tolist()).most_common(1)[0][0]), lab_img[pad])
        done += 1
    return done

# ---------------------------------------------------------------- vectorizing
def mask_to_poly(mask, x0, y0):
    boxes = []
    for r in range(mask.shape[0]):
        row = mask[r]
        d = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        s = np.where(d == 1)[0]; e = np.where(d == -1)[0]
        for c0, c1 in zip(s, e):
            boxes.append(box(x0 + c0, y0 + r, x0 + c1, y0 + r + 1))
    if not boxes: return None
    poly = unary_union(boxes)
    if SIMPLIFY: poly = poly.simplify(SIMPLIFY, preserve_topology=True)
    if not poly.is_valid: poly = poly.buffer(0)
    return None if poly.is_empty else poly

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon": return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0] * COORD_SCALE, NDIG), round(o[1] * COORD_SCALE, NDIG)]
        return [round_coords(x) for x in o]
    return o

def vectorize(lab_img, n, propfn, out, level):
    objs = ndimage.find_objects(lab_img, max_label=n)
    feats, skipped = [], 0
    for lab in range(1, n + 1):
        sl = objs[lab - 1]
        if sl is None: skipped += 1; continue
        mask = lab_img[sl] == lab
        if mask.sum() < MIN_AREA: skipped += 1; continue
        poly = mask_to_poly(mask, sl[1].start, sl[0].start)
        if poly is None: skipped += 1; continue
        gm = mapping(orient_d3(poly)); gm["coordinates"] = round_coords(gm["coordinates"])
        props = propfn(lab)
        feats.append({"type": "Feature", "id": props["id"], "geometry": gm, "properties": props})
        if len(feats) % 1000 == 0: log("  %s %d/%d (%.1fs)" % (level, len(feats), n, time.time() - t0))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    json.dump({"type": "FeatureCollection", "features": feats}, open(out, "w"),
              ensure_ascii=False, separators=(",", ":"))
    log("wrote %s: %d %s (%d empty), %.1f MB (%.1fs)"
        % (out, len(feats), level, skipped, os.path.getsize(out) / 1e6, time.time() - t0))

# ---- counties (the primary map) -------------------------------------------
county_lab = {c: i + 1 for i, c in enumerate(counties)}
c_info = {}
for p, v in prov.items():
    if not v["c"]: continue
    c_info.setdefault(v["c"], {"d": v["d"], "k": v["k"], "n": 0})["n"] += 1
lab_c = label_image({p: county_lab[v["c"]] for p, v in prov.items() if v["c"]})
log("absorbed %d untitled land provinces into their surrounding county (%.1fs)"
    % (absorb_orphans(lab_c), time.time() - t0))

def region_of(d): return duchy_region.get(d)
def county_props(lab):
    key = counties[lab - 1]; e = c_info[key]
    return {"id": "c%d" % lab, "key": key, "name": pretty(key),
            "duchy": e["d"], "duchyName": pretty(e["d"]),
            "kingdom": e["k"], "kingdomName": pretty(e["k"]),
            "region": region_of(e["d"]),
            "regionName": pretty(re.sub(r"^world_", "", region_of(e["d"]) or "")),
            "baronies": e["n"], "color": shade(e["k"], key),
            "owner": None, "ownerCountryId": None, "notes": ""}
vectorize(lab_c, len(counties), county_props, os.path.join(OUTDIR, "agot_counties.geojson"), "counties")

# ---- duchies / kingdoms (coarser levels, rolled up from the county image) ----
duchy_lab = {d: i + 1 for i, d in enumerate(duchies)}
d_info = {}
for c in counties:
    d_info.setdefault(c_info[c]["d"], {"k": c_info[c]["k"], "c": []})["c"].append(c)
c2d = np.zeros(len(counties) + 1, np.int32)
for i, c in enumerate(counties): c2d[i + 1] = duchy_lab.get(c_info[c]["d"], 0)
def duchy_props(lab):
    key = duchies[lab - 1]; e = d_info[key]
    return {"id": lab, "regionId": lab, "key": key, "name": pretty(key),
            "kingdom": e["k"], "kingdomName": pretty(e["k"]),
            "region": region_of(key),
            "regionName": pretty(re.sub(r"^world_", "", region_of(key) or "")),
            "type": "historical", "counties": len(e["c"]),
            "provinceIds": sorted(county_lab[c] for c in e["c"]),
            "provinceCount": len(e["c"]), "color": None, "notes": ""}
vectorize(c2d[lab_c], len(duchies), duchy_props, os.path.join(OUTDIR, "agot_duchies.geojson"), "duchies")

kingdom_lab = {k: i + 1 for i, k in enumerate(kingdoms)}
k_counts = Counter(c_info[c]["k"] for c in counties)
c2k = np.zeros(len(counties) + 1, np.int32)
for i, c in enumerate(counties): c2k[i + 1] = kingdom_lab[c_info[c]["k"]]
def kingdom_props(lab):
    key = kingdoms[lab - 1]
    return {"id": "k%d" % lab, "key": key, "name": pretty(key), "counties": k_counts[key],
            "color": shade(key, key), "owner": None, "ownerCountryId": None, "notes": ""}
vectorize(c2k[lab_c], len(kingdoms), kingdom_props, os.path.join(OUTDIR, "agot_kingdoms.geojson"), "kingdoms")
del lab_c

# ---- baronies (full detail) -------------------------------------------------
land_pids = sorted(prov)
lab_b = label_image({p: i + 1 for i, p in enumerate(land_pids)})
absorb_orphans(lab_b)
def barony_props(lab):
    p = land_pids[lab - 1]; v = prov[p]
    key = v["b"] or ("b_%d" % p)
    return {"id": "b%d" % p, "pid": p, "key": key, "name": pretty(key),
            "county": v["c"], "countyName": pretty(v["c"]),
            "duchy": v["d"], "duchyName": pretty(v["d"]),
            "kingdom": v["k"], "kingdomName": pretty(v["k"]),
            "region": region_of(v["d"]), "color": shade(v["k"], key + str(p)),
            "owner": None, "ownerCountryId": None, "notes": ""}
vectorize(lab_b, len(land_pids), barony_props, os.path.join(OUTDIR, "agot_baronies.geojson"), "baronies")
log("done (%.1fs)" % (time.time() - t0))
