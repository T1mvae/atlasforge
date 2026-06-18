#!/usr/bin/env python3
# Georeference the accurate OWB state map (data/owb_states.geojson, HOI4 pixel
# coords) to real lon/lat with a thin-plate spline over hand-read control points.
import json
import numpy as np
from scipy.interpolate import RBFInterpolator
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.geometry.polygon import orient

SRC = "data/owb_states.geojson"
OUT = "data/owb_states_geo.geojson"

CP = [
    # west coast
    ((615, 75),  (-124.7, 48.4)),   # Cape Flattery
    ((625, 300), (-124.0, 40.0)),   # Cape Mendocino
    ((685, 405), (-120.5, 34.4)),   # Point Conception
    ((715, 435), (-117.1, 32.7)),   # San Diego
    ((835, 625), (-109.9, 22.9)),   # Cabo San Lucas
    # gulf / mexico / yucatan / panama
    ((1340, 720),(-87.0, 21.6)),    # Cabo Catoche, Yucatan
    ((1300, 770),(-91.0, 18.6)),    # Veracruz/Campeche coast
    ((1440, 1120),(-80.2, 8.5)),    # Panama
    # east coast
    ((1535, 565),(-80.9, 25.1)),    # Florida tip
    ((1560, 470),(-81.5, 30.3)),    # Jacksonville
    ((1660, 375),(-75.5, 35.2)),    # Cape Hatteras
    ((1700, 320),(-76.0, 38.0)),    # Chesapeake
    ((1735, 235),(-70.0, 41.7)),    # Cape Cod
    ((2060, 245),(-63.6, 44.6)),    # Halifax
    ((2290, 175),(-52.6, 47.5)),    # Newfoundland
    # caribbean
    ((1490, 655),(-82.4, 23.1)),    # Havana
    ((1650, 690),(-75.0, 20.0)),    # E. Cuba
    ((1770, 725),(-69.9, 18.5)),    # Hispaniola
    ((1860, 735),(-66.5, 18.2)),    # Puerto Rico
    # interior / great lakes
    ((1375, 300),(-87.6, 41.9)),    # Chicago
    ((1300, 215),(-92.1, 46.8)),    # Duluth
    ((1180, 150),(-97.1, 49.9)),    # Winnipeg
    ((1430, 60), (-80.5, 51.5)),    # James Bay
    # top crop (~N. Canada, hard horizontal edge ~y0) -> pin flat
    ((620, 30),  (-130.0, 60.0)),
    ((900, 10),  (-118.0, 66.0)),
    ((1200, 5),  (-105.0, 68.0)),
    ((1500, 10), (-88.0, 66.0)),
    ((1800, 20), (-72.0, 62.0)),
    ((2100, 30), (-58.0, 60.0)),
]

SRCP = np.array([[x, y] for (x, y), _ in CP], float)
LON = np.array([ll[0] for _, ll in CP], float)
LAT = np.array([ll[1] for _, ll in CP], float)
rlon = RBFInterpolator(SRCP, LON, kernel="thin_plate_spline")
rlat = RBFInterpolator(SRCP, LAT, kernel="thin_plate_spline")

def orient_d3(g):
    if g.geom_type == "Polygon": return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon": return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], 4), round(o[1], 4)]
        return [round_coords(x) for x in o]
    return o

def transform(geom):
    pts = []
    def collect(c):
        if isinstance(c[0], (int, float)): pts.append((c[0], c[1]))
        else: [collect(x) for x in c]
    collect(geom["coordinates"])
    a = np.asarray(pts, float)
    new = np.column_stack([rlon(a), rlat(a)])
    idx = [0]
    def rebuild(c):
        if isinstance(c[0], (int, float)):
            i = idx[0]; idx[0] += 1; return [float(new[i][0]), float(new[i][1])]
        return [rebuild(x) for x in c]
    return {"type": geom["type"], "coordinates": rebuild(geom["coordinates"])}

g = json.load(open(SRC))
out = []
for f in g["features"]:
    gj = transform(f["geometry"])
    try:
        gm = mapping(orient_d3(shape(gj))); gm["coordinates"] = round_coords(gm["coordinates"])
    except Exception:
        gm = gj
    out.append({"type": "Feature", "id": f["id"], "geometry": gm, "properties": dict(f["properties"])})
json.dump({"type": "FeatureCollection", "features": out}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
import os
print("wrote %s: %d states, %.2f MB" % (OUT, len(out), os.path.getsize(OUT) / 1e6))
