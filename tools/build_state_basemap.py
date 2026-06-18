#!/usr/bin/env python3
# AtlasForge — build the standalone STATE-based world basemap.
#
# The map's editable units are the states themselves (no province layer).
# Source geometry: the improved state shapes (placeholders renamed, typos fixed
# by tools/complete_state_regions.py). Everything game-specific is stripped —
# the output is AtlasForge's own dataset with its own schema:
#   { id, name, name_ru?, terrain? }
# terrain = dominant terrain of the state's member provinces (used by the
# terrain display mode), computed here once so provinces are not needed at runtime.
import json
from collections import Counter

SRC  = "data/hoi4_state_regions_completed_0_75px.geojson"
PROV = "data/hoi4_provinces_simplified_075px.geojson"
OUT  = "data/atlasforge_world_states_075px.geojson"

prov = json.load(open(PROV))
terrain_of = {}
for f in prov["features"]:
    p = f["properties"]
    if p.get("type") in ("sea", "lake") or p.get("terrain") in ("ocean", "lakes"):
        continue
    terrain_of[p["provinceId"]] = p.get("terrain")

src = json.load(open(SRC))
out_feats = []
for i, f in enumerate(src["features"], start=1):
    p = f["properties"]
    terrs = Counter(terrain_of[pid] for pid in p.get("provinceIds", []) if pid in terrain_of)
    props = {"id": i, "name": p["name"]}
    if p.get("name_ru"):
        props["name_ru"] = p["name_ru"]
    if terrs:
        props["terrain"] = terrs.most_common(1)[0][0]
    out_feats.append({"type": "Feature", "geometry": f["geometry"], "properties": props})

json.dump({"type": "FeatureCollection", "features": out_feats},
          open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

import os
ru = sum(1 for f in out_feats if "name_ru" in f["properties"])
terr = Counter(f["properties"].get("terrain") for f in out_feats)
print(f"wrote {OUT}: {len(out_feats)} states, {os.path.getsize(OUT)/1e6:.1f} MB")
print("with name_ru:", ru, "| terrain distribution:", dict(terr))