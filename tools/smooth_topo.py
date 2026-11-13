#!/usr/bin/env python3
# Round the borders BETWEEN the states borrowed from another mod (a `source` property) in a
# TopoJSON file: Chaikin corner cutting on every arc both of whose sides are such
# states. The ends of an arc stay where they are, so the mesh stays shared; the coast,
# country borders and every border of an original TFR state are not touched.
#   smooth_topo.py IN.topojson OUT.topojson [iterations=2]
import json, sys
from collections import defaultdict

src, dst = sys.argv[1], sys.argv[2]
ITER = int(sys.argv[3]) if len(sys.argv) > 3 else 2
t = json.load(open(src, encoding="utf-8"))
assert "transform" not in t, "write the TopoJSON without quantization (mapshaper: no-quantization)"
sides = defaultdict(set)
def walk(a, key):
    if isinstance(a, int): sides[a if a >= 0 else ~a].add(key)
    else:
        for x in a: walk(x, key)
for obj in t["objects"].values():
    for g in obj["geometries"]:
        p = g.get("properties") or {}
        if g.get("arcs") is not None:
            walk(g["arcs"], (str(p.get("id", "")), bool(p.get("source"))))

def chaikin(pts):
    out = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out.append([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
        out.append([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    out.append(pts[-1])
    return out

n = 0
for i, arc in enumerate(t["arcs"]):
    s = sides.get(i, ())
    if len(s) != 2 or not all(w for _, w in s) or len(arc) < 3: continue
    if arc[0] == arc[-1]: continue                 # an enclave's ring: nothing to hold it by
    for _ in range(ITER): arc = chaikin(arc)
    t["arcs"][i] = arc; n += 1
json.dump(t, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("smoothed %d of %d arcs" % (n, len(t["arcs"])))
