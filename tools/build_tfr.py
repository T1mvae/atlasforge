#!/usr/bin/env python3
# AtlasForge — The Fire Rises (HOI4 mod) -> data/tfr_states.geojson + data/tfr_physical.geojson
#
#   python3 tools/build_tfr.py [MOD_ROOT]
#
# MOD_ROOT is the mod as Steam installs it (workshop id 3350890356): map/ gives the
# province raster, history/states the states and their owners at the start (2000),
# localisation the state and country names (English + Russian), common/countries the
# country colours. maps_references/map_fire_rises is the same map/ folder and is used
# when MOD_ROOT has no map/ of its own.
#
# The geometry comes from the SAME pipeline as OWB and the HOI4 world
# (tools/build_owb_from_mod.py, tools/build_world_terrain.py); this file only stages
# their input and adds what they do not know: Russian names, and the owner as a real
# country (name, Russian name, the mod's colour) instead of a tag.
#
# Afterwards simplify (shared borders stay shared):
#   npx mapshaper data/tfr_states_raw.geojson -simplify dp 25% keep-shapes \
#       -o format=geojson precision=0.1 data/tfr_states.geojson
import colorsys, glob, json, os, re, shutil, subprocess, sys
sys.dont_write_bytecode = True
from tfr_countries import NAMES, SKIP

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MOD = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    "~/Library/Application Support/Steam/steamapps/workshop/content/394360/3350890356")
MAP = os.path.join(MOD, "map")
if not os.path.exists(os.path.join(MAP, "provinces.bmp")):
    MAP = os.path.join(ROOT, "maps_references", "map_fire_rises")
STAGE = os.path.join(HERE, "cache", "tfr_src")
RAW = os.path.join(ROOT, "data", "tfr_states_raw.geojson")
PHYS = os.path.join(ROOT, "data", "tfr_physical.geojson")

LOC_RE = re.compile(r'^\s*([A-Za-z0-9_.\-]+)\s*:\s*\d*\s*"(.*)"\s*(?:#.*)?$')


def read_loc(lang, want):
    """key -> text for the keys `want(key)` accepts; files in replace/ win."""
    out = {}
    base = os.path.join(MOD, "localisation", lang)
    files = sorted(glob.glob(os.path.join(base, "**", "*.yml"), recursive=True),
                   key=lambda p: (os.sep + "replace" + os.sep in p, p))
    for fp in files:
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            m = LOC_RE.match(line)
            if m and want(m.group(1)) and m.group(2).strip():
                out[m.group(1)] = m.group(2).strip()
    return out


def stage():
    shutil.rmtree(STAGE, ignore_errors=True)
    os.makedirs(os.path.join(STAGE, "states"))
    for f in ("provinces.bmp", "definition.csv", "terrain.bmp", "rivers.bmp"):
        os.symlink(os.path.join(MAP, f), os.path.join(STAGE, f))
    for fp in glob.glob(os.path.join(MOD, "history", "states", "*.txt")):
        os.symlink(fp, os.path.join(STAGE, "states", os.path.basename(fp)))
    names = read_loc("english", lambda k: k.startswith("STATE_"))
    with open(os.path.join(STAGE, "states", "names_l_english.yml"), "w", encoding="utf-8") as f:
        f.write("l_english:\n")
        for k, v in names.items():
            f.write(' %s:0 "%s"\n' % (k, v.replace('"', "'")))
    return names


def state_keys():
    """feature id -> STATE_ key, the way build_owb_from_mod.py numbers the states."""
    out, seen, dup = {}, set(), 1000000
    for fp in sorted(glob.glob(os.path.join(STAGE, "states", "*.txt"))):
        txt = re.sub(r"#.*", "", open(fp, encoding="utf-8", errors="ignore").read())
        m = re.search(r"\bid\s*=\s*(\d+)", txt)
        if not m:
            continue
        sid = int(m.group(1))
        if sid in seen:
            sid = dup; dup += 1
        seen.add(sid)
        km = re.search(r'\bname\s*=\s*"(STATE_[A-Za-z0-9_]+)"', txt)
        if km:
            out["s%d" % sid] = km.group(1)
    return out


def country_files():
    """tag -> name taken from the country file ("countries/French Republic.txt")."""
    out = {}
    for fp in sorted(glob.glob(os.path.join(MOD, "common", "country_tags", "*.txt"))):
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            m = re.match(r'\s*([A-Z0-9]{3})\s*=\s*"countries/(.+?)\.txt"', line)
            if m:
                out[m.group(1)] = m.group(2)
    return out


def country_colors():
    out = {}
    fp = os.path.join(MOD, "common", "countries", "colors.txt")
    txt = re.sub(r"#.*", "", open(fp, encoding="utf-8-sig", errors="ignore").read())
    for m in re.finditer(r"\b([A-Z0-9]{3})\s*=\s*\{\s*color\s*=\s*(rgb|hsv|HSV)?\s*\{\s*([\d.\s]+)\}", txt):
        v = [float(x) for x in m.group(3).split()[:3]]
        if len(v) < 3:
            continue
        if (m.group(2) or "rgb").lower() == "hsv":
            v = [c * 255 for c in colorsys.hsv_to_rgb(v[0], v[1], v[2])]
        elif max(v) <= 1:
            v = [c * 255 for c in v]
        out[m.group(1)] = "#%02x%02x%02x" % tuple(max(0, min(255, int(round(c)))) for c in v)
    return out


names_en = stage()
env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
subprocess.check_call([sys.executable, os.path.join(HERE, "build_owb_from_mod.py"), STAGE, RAW], cwd=ROOT, env=env)

names_ru = read_loc("russian", lambda k: k.startswith("STATE_"))
tag_re = re.compile(r"^[A-Z0-9]{3}$")
c_en = read_loc("english", lambda k: bool(tag_re.match(k)))
c_ru = read_loc("russian", lambda k: bool(tag_re.match(k)))
c_file = country_files()
c_col = country_colors()
keys = state_keys()

gj = json.load(open(RAW, encoding="utf-8"))
tags = set()
for f in gj["features"]:
    p = f["properties"]
    ru = names_ru.get(keys.get(p["id"], ""))
    if ru:
        p["name_ru"] = ru
    tag = p.get("owner")
    if not tag or tag in SKIP:
        p["owner"] = None
        continue
    tags.add(tag)
    short = NAMES.get(tag, (None, None))
    p["owner_tag"] = tag
    p["owner"] = short[0] or c_en.get(tag) or c_file.get(tag) or tag
    ru = short[1] or c_ru.get(tag)
    if ru:
        p["owner_ru"] = ru
    if c_col.get(tag):
        p["owner_color"] = c_col[tag]
json.dump(gj, open(RAW, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("TFR: %d states, %d with a Russian name; %d countries (%d coloured); not in tfr_countries.py: %s" % (
    len(gj["features"]), sum(1 for f in gj["features"] if f["properties"].get("name_ru")), len(tags),
    sum(1 for t in tags if c_col.get(t)), sorted(t for t in tags if t not in NAMES) or "none"))

subprocess.check_call([sys.executable, os.path.join(HERE, "build_world_terrain.py"), STAGE, PHYS], cwd=ROOT, env=env)
