#!/usr/bin/env python3
"""AtlasForge — the composited A Game of Thrones map source.

The AGOT mod's `map_data` can carry submod folders nested inside it that extend the
same 9216x6144 image. They are stacked in a fixed order and **an earlier layer always
keeps what it already covers** — a later one may only fill what is still blank. That
way every integration adds and nothing that already works is repainted.

    base  map_data_agot                 the AGOT mod itself
     +1   map_data_legacy_of_valyria    Valyria, Volantis, Slaver's Bay, Sothoryos, Asshai
     +2   map_data_summer_isles         the Summer Isles
     +3   map_data_further_east         the far east: the Dothraki Sea, Yi Ti, Jogos Nhai,
     +4   map_data_essos_expanded       Qarth, Leng, Ulthos, Mossovy, the Cannibal Sands

The last two are the same mod one revision apart — their province rasters are pixel
for pixel identical and their definitions differ in a single province — so the newer
`further_east` goes first and `essos_expanded` fills nothing. It is still listed,
because it is the one that carries the per-province culture the far east is grouped by.

"Blank" means a huge impassable block — what a mod paints over the parts of the world
it has not made yet. Small impassable ridges are real terrain and are left alone.

Legacy_of_valyria is the one exception to the fill-only rule: it was integrated before
that rule existed and *wins* where it drew real provinces (it reworked the Rhoyne), with
the base filling the parts it blanked back to `impassable_land` — Lorath, Norvos, Qohor
and the Axe. Changing it now would silently repaint an already published map.

Every layer gets its own id offset, because the submods re-use the raw province numbers
for completely different places. `load()` returns one unified id space.
"""
import csv, glob, os, re
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
BASE_OFFSET = 100000
BIG_FILLER_PX = 50000        # an impassable province this big is unmade world, not terrain

# stacked in priority order; the first entry that covers a pixel keeps it
LAYERS = [
    {"dir": "map_data_legacy_of_valyria", "offset": 0,      "mode": "wins"},
    {"dir": "map_data_summer_isles",      "offset": 400000, "mode": "fill"},
    {"dir": "map_data_further_east",      "offset": 300000, "mode": "fill"},
    {"dir": "map_data_essos_expanded",    "offset": 200000, "mode": "fill"},
]


def read_definitions(folder):
    keys, pids, barony = [], [], {}
    for row in csv.reader(open(os.path.join(folder, "definition.csv"), encoding="utf-8-sig"),
                          delimiter=";"):
        if len(row) < 5: continue
        try: pid, r, g, b = int(row[0]), int(row[1]), int(row[2]), int(row[3])
        except ValueError: continue
        keys.append((r << 16) | (g << 8) | b); pids.append(pid)
        barony[pid] = row[4].strip()
    k = np.array(keys, np.uint32); p = np.array(pids, np.int32)
    o = np.argsort(k)
    return k[o], p[o], barony


def read_classes(folder):
    txt = open(os.path.join(folder, "default.map"), encoding="utf-8-sig").read()
    def collect(key):
        s = set()
        for m in re.finditer(r"^\s*" + key + r"\s*=\s*(RANGE|LIST)\s*\{([^}]*)\}", txt, re.M):
            n = [int(x) for x in re.findall(r"\d+", m.group(2))]
            s.update(range(n[0], n[1] + 1) if (m.group(1) == "RANGE" and len(n) >= 2) else n)
        return s
    return {"sea": collect("sea_zones") | collect("impassable_seas"),
            "lake": collect("lakes"), "river": collect("river_provinces"),
            "mount": collect("impassable_mountains")}


def _pid_image(folder, keys, pids):
    a = np.asarray(Image.open(os.path.join(folder, "provinces.png")).convert("RGB")).astype(np.uint32)
    k = (a[:, :, 0] << 16) | (a[:, :, 1] << 8) | a[:, :, 2]
    pos = np.clip(np.searchsorted(keys, k), 0, len(keys) - 1)
    img = pids[pos].astype(np.int32)
    img[keys[pos] != k] = -1
    return img


def _real(pid, cls, maxpid):
    """every pixel the mod actually drew — only huge impassable blocks are filler"""
    px = np.bincount(np.clip(pid, 0, maxpid + 1).ravel(), minlength=maxpid + 2)
    lut = np.ones(maxpid + 2, bool); lut[0] = False
    for p in cls["mount"]:
        if p <= maxpid + 1 and px[p] >= BIG_FILLER_PX: lut[p] = False
    return lut[np.clip(pid, 0, maxpid + 1)] & (pid >= 0)


def _read_layer(folder):
    k, p, barony = read_definitions(folder)
    cls = read_classes(folder)
    pid = _pid_image(folder, k, p)
    return {"pid": pid, "barony": barony, "cls": cls, "real": _real(pid, cls, int(p.max()))}


def load(src="map_data_agot", log=print):
    """-> dict with the composited raster and its unified province tables."""
    base = _read_layer(src)
    H, W = base["pid"].shape
    present = [dict(spec, path=os.path.join(src, spec["dir"]))
               for spec in LAYERS if os.path.isfile(os.path.join(src, spec["dir"], "provinces.png"))]

    if not present:
        return _pack(base["pid"], base["barony"], base["cls"],
                     np.zeros((H, W), np.int16), [src], W, H, log)

    layers = [dict(spec, **_read_layer(spec["path"])) for spec in present]
    dirs = [src] + [l["path"] for l in layers]

    # ---- layer 1 may win outright (see the module docstring); the rest only fill
    first = layers[0]
    if first["mode"] == "wins":
        use_base = base["real"] & ~first["real"]
        pid = np.where(use_base, base["pid"] + BASE_OFFSET, first["pid"] + first["offset"])
        origin = np.where(use_base, 0, 1).astype(np.int16)
        covered = base["real"] | first["real"]
        log("layer 1 %-26s wins: covers %d px, base fills the %d px it left blank, "
            "adds %d px the base did not have"
            % (first["dir"], int(first["real"].sum()), int(use_base.sum()),
               int((first["real"] & ~base["real"]).sum())))
        rest = layers[1:]
    else:
        pid = base["pid"] + BASE_OFFSET
        origin = np.zeros((H, W), np.int16)
        covered = base["real"]
        rest = layers

    barony = {p + BASE_OFFSET: k for p, k in base["barony"].items()}
    cls = {k: {p + BASE_OFFSET for p in v} for k, v in base["cls"].items()}
    for i, l in enumerate(layers, start=1):
        for p, k in l["barony"].items(): barony[p + l["offset"]] = k
        for k, v in l["cls"].items(): cls[k] |= {p + l["offset"] for p in v}

    # ---- every later layer may only fill what is still blank
    for i, l in enumerate(rest, start=len(layers) - len(rest) + 1):
        add = l["real"] & ~covered
        n = int(add.sum())
        pid = np.where(add, l["pid"] + l["offset"], pid)
        origin = np.where(add, i, origin).astype(np.int16)
        covered |= add
        log("layer %d %-26s fills %d px of what was still blank" % (i, l["dir"], n))

    return _pack(pid, barony, cls, origin, dirs, W, H, log)


def _pack(pid, barony, cls, origin, dirs, W, H, log):
    maxpid = max(int(pid.max()), max(barony) if barony else 0)
    water = cls["sea"] | cls["lake"] | cls["river"]
    land = {p for p in barony if p > 0} - water - cls["mount"]
    log("map %dx%d: %d land, %d water (sea %d / lake %d / river %d), %d impassable"
        % (W, H, len(land), len(water), len(cls["sea"]), len(cls["lake"]),
           len(cls["river"]), len(cls["mount"])))
    return {"pid": pid, "W": W, "H": H, "maxpid": maxpid, "barony": barony,
            "land": land, "water": water, "sea": cls["sea"], "lake": cls["lake"],
            "river": cls["river"], "mount": cls["mount"],
            "origin": origin, "dirs": dirs, "src": dirs[0]}


def layer_offset(state, folder_name):
    """the id offset a layer's provinces carry in the unified space"""
    if folder_name in (None, "", state["src"]): return BASE_OFFSET
    for spec in LAYERS:
        if spec["dir"] == folder_name: return spec["offset"]
    return 0


def layer_index(state, folder_name):
    """position of a layer in `origin` (0 = the base mod), or None if absent"""
    for i, d in enumerate(state["dirs"]):
        if os.path.basename(d) == folder_name: return i
    return None


def composite_image(state, name):
    """Read `name` (rivers.png / heightmap.png) from every layer that has it and
    composite it exactly the way the province raster was composited. A layer without
    the file keeps whatever the layer below it had."""
    out = None
    for i, d in enumerate(state["dirs"]):
        p = os.path.join(d, name)
        if not os.path.isfile(p): continue
        a = np.asarray(Image.open(p))
        if out is None:
            out = a.copy()
            continue
        if a.shape != out.shape: continue
        out = np.where(state["origin"] == i, a, out)
    return out
