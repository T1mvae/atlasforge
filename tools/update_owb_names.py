#!/usr/bin/env python3
# AtlasForge — patch real state names into the already-built OWB GeoJSON, WITHOUT
# re-vectorizing (geometry is unchanged; only names changed when the user added
# localisation files / renamed state .txt files).
#
# Name resolution per state id, best source first:
#   1) localisation  STATE_<key> -> "Real Name"   (OWB_helping_files/states/*_l_english.yml)
#   2) friendly name in the FILENAME  "<id>-Real Name.txt"  (if not the generic "State")
#   3) "State <id>"  (unique + findable fallback)
import glob, json, os, re, sys

SRC = "OWB_helping_files"
STATES = os.path.join(SRC, "states")

# ---- 1) localisation: STATE_KEY -> real name (HOI4 yml: ` STATE_1:0 "The Hub"`)
loc = {}
LOC_RE = re.compile(r'(STATE_[A-Za-z0-9_]+)\s*:\s*\d*\s*"([^"]*)"')
for yf in glob.glob(os.path.join(STATES, "*_l_english.yml")):
    for line in open(yf, encoding="utf-8-sig", errors="ignore"):
        m = LOC_RE.search(line)
        if m and m.group(2).strip():
            loc[m.group(1)] = m.group(2).strip()
print("localisation keys: %d" % len(loc))

# ---- 2/3) per state file: id, internal STATE_ key, friendly filename
NAME_RE = re.compile(r'\bname\s*=\s*"(STATE_[A-Za-z0-9_]+)"')
ID_RE = re.compile(r"\bid\s*=\s*(\d+)")
id_name = {}
src_loc = src_file = src_fallback = 0
for fp in glob.glob(os.path.join(STATES, "*.txt")):
    txt = re.sub(r"#.*", "", open(fp, encoding="utf-8", errors="ignore").read())
    mi = ID_RE.search(txt)
    if not mi:
        continue
    sid = int(mi.group(1))
    mk = NAME_RE.search(txt)
    key = mk.group(1) if mk else None
    base = os.path.basename(fp)[:-4]
    fname = base.split("-", 1)[1].strip() if "-" in base else ""
    if key and key in loc:
        id_name[sid] = loc[key]; src_loc += 1
    elif fname and fname.lower() != "state":
        id_name[sid] = fname; src_file += 1
    else:
        id_name[sid] = "State %d" % sid; src_fallback += 1
print("states: %d  (loc=%d  filename=%d  fallback=%d)" %
      (len(id_name), src_loc, src_file, src_fallback))

# ---- patch the built GeoJSON files (keyed by feature id "s<id>")
def patch(path):
    if not os.path.exists(path):
        print("  skip (missing):", path); return
    gj = json.load(open(path, encoding="utf-8"))
    changed = 0
    for f in gj["features"]:
        fid = (f.get("properties") or {}).get("id") or f.get("id") or ""
        m = re.match(r"s(\d+)$", str(fid))
        if not m:
            continue
        sid = int(m.group(1))
        nm = id_name.get(sid)
        if nm and f["properties"].get("name") != nm:
            f["properties"]["name"] = nm; changed += 1
    json.dump(gj, open(path, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    named = sum(1 for f in gj["features"]
               if not str(f["properties"].get("name", "")).startswith("State "))
    print("  %s: patched %d, now real-named %d/%d" %
          (os.path.basename(path), changed, named, len(gj["features"])))

for p in ["data/owb_states.geojson", "data/owb_states_geo.geojson"]:
    patch(p)

# ---- bonus: give each province its owning state's name (nicer province labels)
def patch_provinces(path):
    if not os.path.exists(path):
        return
    gj = json.load(open(path, encoding="utf-8"))
    changed = 0
    for f in gj["features"]:
        st = (f.get("properties") or {}).get("state")
        try:
            sid = int(st)
        except (TypeError, ValueError):
            continue
        nm = id_name.get(sid)
        if nm and not nm.startswith("State ") and f["properties"].get("name") != nm:
            f["properties"]["name"] = nm; changed += 1
    json.dump(gj, open(path, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    print("  %s: province names set from state = %d" % (os.path.basename(path), changed))

if "--provinces" in sys.argv:
    patch_provinces("data/owb_provinces.geojson")

print("done.")
