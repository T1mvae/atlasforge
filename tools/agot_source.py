#!/usr/bin/env python3
"""AtlasForge — the composited A Game of Thrones map source.

The AGOT mod's `map_data` can carry a submod folder nested inside it that extends
the same map (`map_data_legacy_of_valyria`: Valyria, Volantis, Slaver's Bay,
Sothoryos, Asshai…). The submod repaints and re-numbers a large part of the image,
so it cannot simply replace the base:

  * where it has real provinces it WINS  (+1.86 Mpx of new land),
  * but it also blanks Lorath, Norvos, Qohor and the Axe back to `impassable_land`
    (-0.58 Mpx) because it has not redone northern Essos yet.

So both are composited pixel by pixel: the submod everywhere it has real land, the
base wherever the submod only has filler. Base-sourced provinces keep their own ids
shifted by BASE_OFFSET, because the submod re-used the raw id numbers for other
places entirely.

`load()` returns everything the builders need in that single unified id space.
"""
import csv, glob, os, re
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
BASE_OFFSET = 100000


def find_overlay(src):
    ov = sorted(d for d in glob.glob(os.path.join(src, "map_data_*"))
                if os.path.isfile(os.path.join(d, "provinces.png")))
    return ov[-1] if ov else None


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


def load(src="map_data_agot", log=print):
    """-> dict with the composited raster and its unified province tables."""
    ov = find_overlay(src)
    bk, bp, b_barony = read_definitions(src)
    b_cls = read_classes(src)
    pid_base = _pid_image(src, bk, bp)
    H, W = pid_base.shape

    if ov is None:
        return _pack(pid_base, b_barony, b_cls, np.zeros((H, W), bool), src, src, W, H, log)

    ok, op, o_barony = read_definitions(ov)
    o_cls = read_classes(ov)
    pid_ov = _pid_image(ov, ok, op)

    # "Real" = anything the mod actually drew: land, sea, lake, river, and the small
    # impassable ridges too. Only the huge impassable blocks are filler — that is
    # what a mod paints over the parts of the world it has not made yet.
    real_base = _real(pid_base, b_cls, int(bp.max()))
    real_ov = _real(pid_ov, o_cls, int(op.max()))
    use_base = real_base & ~real_ov        # the submod only has filler here
    log("composite: submod covers %d px, base fills the %d px it left blank, "
        "submod adds %d px the base did not have"
        % (int(real_ov.sum()), int(use_base.sum()), int((real_ov & ~real_base).sum())))

    pid = np.where(use_base, pid_base + BASE_OFFSET, pid_ov)
    barony = dict(o_barony)
    for p, k in b_barony.items():
        barony[p + BASE_OFFSET] = k
    # base-sourced pixels keep their own sea / lake / river / impassable roles
    cls = {k: set(v) | {p + BASE_OFFSET for p in b_cls[k]} for k, v in o_cls.items()}
    return _pack(pid, barony, cls, use_base, src, ov, W, H, log)


BIG_FILLER_PX = 50000


def _real(pid, cls, maxpid):
    """every pixel the mod actually drew — only huge impassable blocks are filler"""
    px = np.bincount(np.clip(pid, 0, maxpid + 1).ravel(), minlength=maxpid + 2)
    lut = np.ones(maxpid + 2, bool); lut[0] = False
    for p in cls["mount"]:
        if p <= maxpid + 1 and px[p] >= BIG_FILLER_PX: lut[p] = False
    return lut[np.clip(pid, 0, maxpid + 1)] & (pid >= 0)


def _pack(pid, barony, cls, use_base, src, mapdir, W, H, log):
    maxpid = max(int(pid.max()), max(barony) if barony else 0)
    water = cls["sea"] | cls["lake"] | cls["river"]
    land = {p for p in barony if p > 0} - water - cls["mount"]
    log("map %dx%d: %d land, %d water (sea %d / lake %d / river %d), %d impassable"
        % (W, H, len(land), len(water), len(cls["sea"]), len(cls["lake"]),
           len(cls["river"]), len(cls["mount"])))
    return {"pid": pid, "W": W, "H": H, "maxpid": maxpid, "barony": barony,
            "land": land, "water": water, "sea": cls["sea"], "lake": cls["lake"],
            "river": cls["river"], "mount": cls["mount"],
            "use_base": use_base, "src": src, "mapdir": mapdir}


def composite_image(state, name, mode=None):
    """Read `name` (rivers.png / heightmap.png) from both folders and composite it
    the same way the province raster was composited."""
    a = np.asarray(Image.open(os.path.join(state["mapdir"], name)))
    if state["src"] == state["mapdir"]:
        return a
    b = np.asarray(Image.open(os.path.join(state["src"], name)))
    if a.shape != b.shape:
        return a
    return np.where(state["use_base"], b, a)
