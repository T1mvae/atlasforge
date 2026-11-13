#!/usr/bin/env python3
# AtlasForge — Kovas State Rework Expanded Refined (KSRER, a state mod for vanilla HOI4)
#   -> data/ksrer_states_raw.geojson + data/ksrer_physical.geojson
#
#   python3 tools/build_ksrer.py [MOD_ROOT [VANILLA_ROOT]]
#
# The base of the "ksrer_merged" map (tools/build_tfr_merged.py ksrer). Same pipeline as
# tools/build_tfr.py: the input of build_owb_from_mod.py / build_world_terrain.py is
# staged from the mod as Steam installs it (workshop id 3817978431), then the owner tag
# becomes a country — its short name (the plain TAG key, mod first, then the game),
# the Russian one from the game, the colour from colors.txt. The mod has no Russian
# text: a state gets `name_ru` only where its English name is still the game's own.
import colorsys, glob, json, os, re, shutil, subprocess, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STEAM = os.path.expanduser("~/Library/Application Support/Steam/steamapps")
MOD = sys.argv[1] if len(sys.argv) > 1 else os.path.join(STEAM, "workshop/content/394360/3817978431")
GAME = sys.argv[2] if len(sys.argv) > 2 else os.path.join(STEAM, "common/Hearts of Iron IV")
STAGE = os.path.join(HERE, "cache", "ksrer_src")
RAW = os.path.join(ROOT, "data", "ksrer_states_raw.geojson")
PHYS = os.path.join(ROOT, "data", "ksrer_physical.geojson")
# the plain key is the nation, not the country of 1936
SHORT = {"SOV": ("Soviet Union", "Советский Союз"), "USA": ("United States", "США"),
         "ENG": ("United Kingdom", "Великобритания"),
         # three tags the game all calls "China" — one name would make them one country
         "CHI": ("China", "Китай"), "PRC": ("Communist China", "Коммунистический Китай"),
         "MAN": ("Manchukuo", "Маньчжоу-го"),
         # the mod's own countries (it has no Russian text)
         "SMO": (None, "Испанское Марокко"), "HNN": (None, "Хунань"), "EHE": (None, "Восточный Хэбэй"),
         "CHN": (None, "Чэндуская клика"), "TSY": (None, "Дэян"), "RUU": (None, "Руанда-Урунди"),
         "YNL": (None, "Юйлинь"), "LCH": (None, "Лихтенштейн"), "SMR": (None, "Сан-Марино"),
         "VAT": (None, "Ватикан"), "MNC": (None, "Монако"), "ADR": (None, "Андорра"),
         "WCM": (None, "Западный Камерун"), "TIZ": (None, "Международная зона Танжер"),
         "WTG": ("West Togo", "Западное Того"), "DHU": (None, "Наньчун"), "KAN": (None, "Кам"),
         "JAD": ("Jabal ad Druze", "Джебель-Друз"), "AWS": ("Alawite State", "Государство алавитов"),
         "ZNZ": ("Zanzibar", "Занзибар"), "AFA": ("Afar", "Афар")}
SKIP = {"NUL"}        # "Uncontrolled Territory": a placeholder, not a country

LOC_RE = re.compile(r'^\s*([A-Za-z0-9_.\-]+)\s*:\s*\d*\s*"(.*)"\s*(?:#.*)?$')


def read_loc(root, lang, want):
    """key -> text for the keys `want(key)` accepts; files in replace/ win."""
    out = {}
    files = sorted(glob.glob(os.path.join(root, "localisation", lang, "**", "*.yml"), recursive=True),
                   key=lambda p: (os.sep + "replace" + os.sep in p, p))
    for fp in files:
        for line in open(fp, encoding="utf-8-sig", errors="ignore"):
            m = LOC_RE.match(line)
            if m and want(m.group(1)) and m.group(2).strip():
                out[m.group(1)] = m.group(2).strip()
    return out


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
        km = re.search(r'\bname\s*=\s*"?(STATE_[A-Za-z0-9_]+)', txt)
        if km:
            out["s%d" % sid] = km.group(1)
    return out


def country_colors(root):
    out = {}
    fp = os.path.join(root, "common", "countries", "colors.txt")
    if not os.path.exists(fp):
        return out
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


def file_colors():
    """tag -> the colour in its own country file, for the tags colors.txt leaves out."""
    out = {}
    for root in (GAME, MOD):
        for fp in sorted(glob.glob(os.path.join(root, "common", "country_tags", "*.txt"))):
            for line in open(fp, encoding="utf-8-sig", errors="ignore"):
                m = re.match(r'\s*([A-Z0-9]{3})\s*=\s*"(countries/.+?\.txt)"', line)
                cf = m and next((os.path.join(r, "common", m.group(2)) for r in (MOD, GAME)
                                 if os.path.exists(os.path.join(r, "common", m.group(2)))), None)
                if not cf:
                    continue
                c = re.search(r"\bcolor\s*=\s*(?:rgb)?\s*\{\s*(\d+)\s+(\d+)\s+(\d+)",
                              re.sub(r"#.*", "", open(cf, encoding="utf-8-sig", errors="ignore").read()))
                if c:
                    out[m.group(1)] = "#%02x%02x%02x" % tuple(min(255, int(x)) for x in c.groups())
    return out


is_state = lambda k: k.startswith("STATE_")
is_tag = lambda k: bool(re.match(r"^[A-Z0-9]{3}$", k))
game_en = read_loc(GAME, "english", is_state)
names_en = dict(game_en); names_en.update(read_loc(MOD, "english", is_state))

shutil.rmtree(STAGE, ignore_errors=True)
os.makedirs(os.path.join(STAGE, "states"))
for f in ("provinces.bmp", "definition.csv", "terrain.bmp", "rivers.bmp"):
    os.symlink(os.path.join(MOD, "map", f), os.path.join(STAGE, f))
for fp in glob.glob(os.path.join(MOD, "history", "states", "*.txt")):
    os.symlink(fp, os.path.join(STAGE, "states", os.path.basename(fp)))
with open(os.path.join(STAGE, "states", "names_l_english.yml"), "w", encoding="utf-8") as f:
    f.write("l_english:\n")
    for k, v in names_en.items():
        f.write(' %s:0 "%s"\n' % (k, v.replace('"', "'")))

env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
subprocess.check_call([sys.executable, os.path.join(HERE, "build_owb_from_mod.py"), STAGE, RAW], cwd=ROOT, env=env)

game_ru = read_loc(GAME, "russian", is_state)
c_en = read_loc(GAME, "english", is_tag); c_en.update(read_loc(MOD, "english", is_tag))
c_ru = read_loc(GAME, "russian", is_tag)
c_col = file_colors(); c_col.update(country_colors(GAME)); c_col.update(country_colors(MOD))
keys = state_keys()

gj = json.load(open(RAW, encoding="utf-8"))
tags = set()
for f in gj["features"]:
    p = f["properties"]
    k = keys.get(p["id"], "")
    if game_ru.get(k) and game_en.get(k) == names_en.get(k):
        p["name_ru"] = game_ru[k]
    tag = p.get("owner")
    if not tag or tag in SKIP:
        p["owner"] = None
        continue
    tags.add(tag)
    short = SHORT.get(tag, (None, None))
    p["owner_tag"] = tag
    p["owner"] = short[0] or c_en.get(tag) or tag
    ru = short[1] or c_ru.get(tag)
    if ru:
        p["owner_ru"] = ru
    if c_col.get(tag):
        p["owner_color"] = c_col[tag]
json.dump(gj, open(RAW, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("KSRER: %d states, %d with a Russian name; %d countries (%d coloured, %d with a Russian name); no name: %s" % (
    len(gj["features"]), sum(1 for f in gj["features"] if f["properties"].get("name_ru")), len(tags),
    sum(1 for t in tags if c_col.get(t)), sum(1 for t in tags if t in SHORT or c_ru.get(t)),
    sorted(t for t in tags if t not in SHORT and not c_en.get(t)) or "none"))

subprocess.check_call([sys.executable, os.path.join(HERE, "build_world_terrain.py"), STAGE, PHYS], cwd=ROOT, env=env)
