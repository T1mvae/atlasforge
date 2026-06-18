#!/usr/bin/env python3
# AtlasForge — (1) recolour the OWB regions to subtle white shades (clean atlas
# base instead of the garish source colours); (2) georeference the pixel map to
# real lon/lat with a 2nd-order polynomial fit from hand-read control points,
# producing a comparison "geo" dataset that sits at the correct world position.
import json, hashlib
import numpy as np
from scipy.interpolate import RBFInterpolator
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.geometry.polygon import orient

SRC = "data/owb_north_america.geojson"
OUT_PIXEL = "data/owb_north_america.geojson"        # recoloured, pixel coords (no georef)
OUT_GEO = "data/owb_north_america_geo.geojson"      # recoloured, lon/lat (georef)

# control points: (source_px_x, source_px_y) -> (lon, lat), read off /tmp/owb_grid.png
CP = [
    ((70, 95),   (-124.7, 48.4)),   # Cape Flattery, WA (NW corner)
    ((95, 360),  (-124.4, 40.4)),   # Cape Mendocino, N. California
    ((140, 470), (-120.5, 34.4)),   # Point Conception, S. California
    ((175, 510), (-117.1, 32.7)),   # San Diego
    ((305, 650), (-109.9, 22.9)),   # Cabo San Lucas (Baja tip)
    ((545, 585), (-89.2, 29.2)),    # Mississippi delta
    ((612, 560), (-80.9, 25.1)),    # Florida tip
    ((775, 330), (-76.0, 37.0)),    # Chesapeake / Norfolk
    ((812, 240), (-70.0, 41.7)),    # Cape Cod
    ((1035, 120),(-53.1, 46.7)),    # Cape Race, Newfoundland
    ((585, 728), (-87.0, 21.6)),    # Cabo Catoche, Yucatan
    ((650, 1085),(-80.2, 8.5)),     # Panama
    ((700, 55),  (-80.5, 51.5)),    # James Bay (S. Hudson Bay)
    ((430, 250), (-110.0, 45.0)),   # interior Montana-ish (mid anchor)
    # --- east coast / Gulf / Caribbean / Great Lakes (denser east constraint) ---
    ((625, 295), (-87.6, 41.9)),    # Chicago, S. Lake Michigan
    ((560, 205), (-92.1, 46.8)),    # Duluth, W. Lake Superior
    ((480, 130), (-97.1, 49.9)),    # Winnipeg
    ((875, 195), (-67.0, 45.0)),    # Maine
    ((925, 212), (-63.6, 44.6)),    # Halifax, Nova Scotia
    ((805, 375), (-75.5, 35.2)),    # Cape Hatteras
    ((765, 445), (-79.9, 32.8)),    # Charleston
    ((590, 540), (-84.3, 30.0)),    # Florida panhandle (Apalachee)
    ((490, 600), (-94.8, 29.3)),    # Galveston, TX
    ((460, 625), (-97.4, 25.9)),    # Brownsville / Rio Grande mouth
    ((490, 740), (-96.1, 19.2)),    # Veracruz
    ((680, 620), (-82.4, 23.1)),    # Havana, W. Cuba
    ((800, 660), (-75.0, 20.0)),    # E. Cuba (Guantanamo)
    ((900, 690), (-69.9, 18.5)),    # Hispaniola (Santo Domingo)
    ((950, 725), (-66.5, 18.2)),    # Puerto Rico
    # --- top edge is a hard crop through N. Canada (~67N); pin it flat ---
    ((40, 0),    (-138.0, 66.0)),
    ((300, 0),   (-128.0, 67.0)),
    ((600, 0),   (-110.0, 68.0)),
    ((860, 0),   (-94.0, 67.0)),
    ((1080, 0),  (-78.0, 64.0)),
    ((1340, 0),  (-62.0, 60.0)),
    ((1600, 0),  (-50.0, 62.0)),    # Greenland-ish far NE blob
    ((1900, 5),  (-40.0, 64.0)),
]

# thin-plate spline through the control points (exact at points, smooth between)
SRCP = np.array([[x, y] for (x, y), _ in CP], float)
LON = np.array([ll[0] for _, ll in CP], float)
LAT = np.array([ll[1] for _, ll in CP], float)
rbf_lon = RBFInterpolator(SRCP, LON, kernel="thin_plate_spline", smoothing=0.0)
rbf_lat = RBFInterpolator(SRCP, LAT, kernel="thin_plate_spline", smoothing=0.0)

def tx_batch(pts):
    a = np.asarray(pts, float)
    return np.column_stack([rbf_lon(a), rbf_lat(a)])

# report residuals (should be ~0 at control points)
pred = tx_batch(SRCP)
errs = np.hypot(pred[:, 0] - LON, pred[:, 1] - LAT)
print("TPS fit residual at control points: mean %.3f deg, max %.3f deg" % (errs.mean(), errs.max()))

def white_shade(fid):
    v = int(hashlib.md5(fid.encode()).hexdigest()[:8], 16)
    l = 224 + (v % 22)            # 224..245 lightness
    warm = (v >> 8) % 9 - 4       # -4..4 warm/cool
    cl = lambda t: max(0, min(255, t))
    return "#%02x%02x%02x" % (cl(l + warm), cl(l), cl(l - warm - 3))

def transform_geom(geom):
    pts = []
    def collect(c):
        if isinstance(c[0], (int, float)): pts.append((c[0], c[1]))
        else: [collect(x) for x in c]
    collect(geom["coordinates"])
    new = tx_batch(pts)
    idx = [0]
    def rebuild(c):
        if isinstance(c[0], (int, float)):
            i = idx[0]; idx[0] += 1
            return [float(new[i][0]), float(new[i][1])]
        return [rebuild(x) for x in c]
    return {"type": geom["type"], "coordinates": rebuild(geom["coordinates"])}

def orient_d3(g):
    if g.geom_type == "Polygon":
        return orient(g, sign=-1.0)
    if g.geom_type == "MultiPolygon":
        return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g

def round_coords(o, nd):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)):
            return [round(o[0], nd), round(o[1], nd)]
        return [round_coords(x, nd) for x in o]
    return o

src = json.load(open(SRC))
pix_feats, geo_feats = [], []
for f in src["features"]:
    fid = f["properties"]["id"]
    col = white_shade(fid)
    props = dict(f["properties"]); props["color"] = col
    # pixel (recoloured, geometry unchanged)
    pix_feats.append({"type": "Feature", "id": fid, "geometry": f["geometry"], "properties": props})
    # georeferenced: transform pixel -> lon/lat, fix winding
    gj = transform_geom(f["geometry"])
    try:
        gg = orient_d3(shape(gj))
        gm = mapping(gg); gm["coordinates"] = round_coords(gm["coordinates"], 4)
    except Exception:
        gm = gj
    geo_feats.append({"type": "Feature", "id": fid, "geometry": gm, "properties": dict(props)})

json.dump({"type": "FeatureCollection", "features": pix_feats}, open(OUT_PIXEL, "w"), separators=(",", ":"))
json.dump({"type": "FeatureCollection", "features": geo_feats}, open(OUT_GEO, "w"), separators=(",", ":"))
import os
print("wrote %s (pixel, white) %.2f MB" % (OUT_PIXEL, os.path.getsize(OUT_PIXEL) / 1e6))
print("wrote %s (geo, white)   %.2f MB" % (OUT_GEO, os.path.getsize(OUT_GEO) / 1e6))
