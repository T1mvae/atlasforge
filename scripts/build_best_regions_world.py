#!/usr/bin/env python3
"""
Build one editable best_regions_world GeoJSON layer from AtlasForge's two
existing world maps:

- Atlas World Map: preferred for geographic, historical and cultural structure.
- World States Map: used only when its political subdivisions add useful detail.

The output is a flat region layer. It is not a province layer, hierarchy, or
strategic-region map.
"""
from __future__ import annotations

import argparse
import json
import math
import numbers
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from shapely.affinity import translate
from shapely.errors import GEOSException
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

try:
    from shapely import set_precision
except ImportError:  # pragma: no cover - older Shapely fallback
    set_precision = None


ROOT = Path(__file__).resolve().parents[1]

ATLAS_PATH = ROOT / "data/atlasforge_world_regions.geojson"
STATES_PATH = ROOT / "data/atlasforge_world_states_075px.geojson"
STATE_REF_PATH = ROOT / "data/hoi4_state_regions_simplified_0_75px.geojson"
ANCHOR_SOURCE = ROOT / "tools/generate_regions.py"

PUBLIC_DIR = ROOT / "public/data"
APP_DATA_DIR = ROOT / "data"

OUT_FULL = PUBLIC_DIR / "best_regions_world.geojson"
OUT_SIMPLIFIED = PUBLIC_DIR / "best_regions_world_simplified.geojson"
OUT_REPORT = PUBLIC_DIR / "best_regions_world_report.json"

MIRROR_FULL = APP_DATA_DIR / "best_regions_world.geojson"
MIRROR_SIMPLIFIED = APP_DATA_DIR / "best_regions_world_simplified.geojson"
MIRROR_REPORT = APP_DATA_DIR / "best_regions_world_report.json"

STATE_W = 5632.0
STATE_H = 2048.0

TARGET_MIN = 1000
TARGET_MAX = 3000

LOCAL_MIN_PIECE_KM2 = 1800.0
LOCAL_MIN_REL = 0.012
GLOBAL_SLIVER_KM2 = 1800.0
FORCE_TINY_SLIVER_KM2 = 450.0


@dataclass
class SourceFeature:
    idx: int
    source_id: str
    name: str
    name_ru: str | None
    geom: BaseGeometry
    props: dict[str, Any]
    area_km2: float


@dataclass
class Candidate:
    atlas: SourceFeature
    state: SourceFeature | None
    geom: BaseGeometry
    area_km2: float
    source_preference: str
    reason: str
    name: str
    name_ru: str | None = None
    merged_slivers: int = 0
    generated: bool = False
    sort_key: tuple[Any, ...] = field(default_factory=tuple)


def solve_normal(ata: list[list[float]], atb: list[float]) -> list[float]:
    n = len(atb)
    matrix = [row[:] + [atb[i]] for i, row in enumerate(ata)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(matrix[r][c]))
        matrix[c], matrix[piv] = matrix[piv], matrix[c]
        if abs(matrix[c][c]) < 1e-12:
            raise RuntimeError("projection calibration failed: singular matrix")
        for r in range(n):
            if r == c or not matrix[r][c]:
                continue
            factor = matrix[r][c] / matrix[c][c]
            for k in range(c, n + 1):
                matrix[r][k] -= factor * matrix[c][k]
    return [matrix[i][n] / matrix[i][i] for i in range(n)]


def polyfit(xs: list[float], ys: list[float], deg: int) -> list[float]:
    n = deg + 1
    ata = [[sum(x ** (i + j) for x in xs) for j in range(n)] for i in range(n)]
    atb = [sum((x**i) * y for x, y in zip(xs, ys)) for i in range(n)]
    return solve_normal(ata, atb)


def polyval(c: list[float], x: float) -> float:
    return sum(ci * x**i for i, ci in enumerate(c))


def load_anchor_projection() -> tuple[list[float], list[float], int]:
    """Reuse the existing AtlasForge pixel<->lon/lat calibration anchors."""
    src = ANCHOR_SOURCE.read_text(encoding="utf-8")
    prefix = src.split("# ---------------------------------------------------------------- helpers")[0]
    ns: dict[str, Any] = {}
    exec(prefix, ns)
    anchors: dict[str, tuple[float, float]] = ns["ANCHORS"]

    ref = json.loads(STATE_REF_PATH.read_text(encoding="utf-8"))
    ref_centroids: dict[str, tuple[float, float]] = {}
    for f in ref.get("features", []):
        props = f.get("properties") or {}
        name = props.get("name")
        if name in anchors and name not in ref_centroids:
            geom = clean_geom(shape(f["geometry"]), precision=None)
            if geom is not None:
                c = geom.centroid
                ref_centroids[name] = (c.x, c.y)

    if len(ref_centroids) < 20:
        raise RuntimeError(f"not enough projection anchors: {len(ref_centroids)}")

    items = list(ref_centroids.items())

    def fit(items_: list[tuple[str, tuple[float, float]]]) -> tuple[list[float], list[float]]:
        xs = [px for _, (px, _) in items_]
        ys = [py for _, (_, py) in items_]
        lons = [anchors[nm][1] for nm, _ in items_]
        lats = [anchors[nm][0] for nm, _ in items_]
        return polyfit(xs, lons, 1), polyfit(ys, lats, 3)

    lon_c, lat_c = fit(items)

    def residual(nm: str, px: float, py: float) -> float:
        lat, lon = anchors[nm]
        dlon = abs(polyval(lon_c, px) - lon)
        dlon = min(dlon, 360 - dlon)
        return max(dlon, abs(polyval(lat_c, py) - lat))

    for thresh in (6.0, 3.0, 2.0):
        items = [(nm, c) for nm, c in items if residual(nm, c[0], c[1]) < thresh]
        lon_c, lat_c = fit(items)

    return lon_c, lat_c, len(items)


def iter_polygon_parts(geom: BaseGeometry) -> Iterable[Polygon]:
    if geom.is_empty:
        return
    if isinstance(geom, Polygon):
        yield geom
    elif isinstance(geom, MultiPolygon):
        yield from geom.geoms
    elif isinstance(geom, GeometryCollection):
        for part in geom.geoms:
            yield from iter_polygon_parts(part)


def polygonal(geom: BaseGeometry) -> BaseGeometry | None:
    parts = [p for p in iter_polygon_parts(geom) if not p.is_empty and p.area > 0]
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return MultiPolygon(parts)


def clean_geom(geom: BaseGeometry, precision: float | None = 1e-7) -> BaseGeometry | None:
    if geom is None or geom.is_empty:
        return None
    try:
        if not geom.is_valid:
            geom = make_valid(geom)
    except GEOSException:
        try:
            geom = geom.buffer(0)
        except GEOSException:
            return None
    geom = polygonal(geom)
    if geom is None or geom.is_empty:
        return None
    try:
        if not geom.is_valid:
            geom = geom.buffer(0)
    except GEOSException:
        return None
    geom = polygonal(geom)
    if geom is None or geom.is_empty:
        return None
    if precision and set_precision is not None:
        try:
            geom = set_precision(geom, precision)
            geom = polygonal(geom)
        except GEOSException:
            pass
    return geom if geom is not None and not geom.is_empty else None


def orient_for_d3(geom: BaseGeometry) -> BaseGeometry:
    if isinstance(geom, Polygon):
        return orient(geom, sign=-1.0)
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([orient(g, sign=-1.0) for g in geom.geoms])
    return geom


def area_km2(geom: BaseGeometry) -> float:
    if geom is None or geom.is_empty:
        return 0.0
    c = geom.representative_point()
    coslat = max(0.08, math.cos(math.radians(c.y)))
    return abs(geom.area) * 111.32 * 111.32 * coslat


def safe_intersection(a: BaseGeometry, b: BaseGeometry) -> BaseGeometry | None:
    try:
        return clean_geom(a.intersection(b))
    except GEOSException:
        aa = clean_geom(a)
        bb = clean_geom(b)
        if aa is None or bb is None:
            return None
        try:
            return clean_geom(aa.intersection(bb))
        except GEOSException:
            return None


def safe_difference(a: BaseGeometry, b: BaseGeometry) -> BaseGeometry | None:
    try:
        return clean_geom(a.difference(b))
    except GEOSException:
        aa = clean_geom(a)
        bb = clean_geom(b)
        if aa is None or bb is None:
            return aa
        try:
            return clean_geom(aa.difference(bb))
        except GEOSException:
            return aa


def safe_union(geoms: Iterable[BaseGeometry]) -> BaseGeometry | None:
    usable = [g for g in geoms if g is not None and not g.is_empty]
    if not usable:
        return None
    try:
        return clean_geom(unary_union(usable))
    except GEOSException:
        out = usable[0]
        for geom in usable[1:]:
            try:
                out = out.union(geom)
            except GEOSException:
                out = out.buffer(0).union(geom.buffer(0))
            out = clean_geom(out)
            if out is None:
                return None
        return out


def round_coords(obj: Any, ndigits: int) -> Any:
    if isinstance(obj, tuple):
        obj = list(obj)
    if isinstance(obj, list):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(obj[0]), ndigits), round(float(obj[1]), ndigits)]
        return [round_coords(x, ndigits) for x in obj]
    return obj


def feature_id(props: dict[str, Any], idx: int, prefix: str) -> str:
    raw = props.get("id", props.get("regionId", props.get("stateId", idx + 1)))
    return f"{prefix}{raw}"


def load_atlas() -> tuple[list[SourceFeature], dict[str, int]]:
    gj = json.loads(ATLAS_PATH.read_text(encoding="utf-8"))
    warnings = Counter()
    features: list[SourceFeature] = []
    seen = set()

    for i, f in enumerate(gj.get("features", [])):
        props = f.get("properties") or {}
        if not f.get("geometry"):
            warnings["empty_input_geometry"] += 1
            continue
        raw_geom = shape(f["geometry"])
        if not raw_geom.is_valid:
            warnings["invalid_input_geometry"] += 1
        geom = clean_geom(raw_geom)
        if geom is None:
            warnings["removed_empty_geometry"] += 1
            continue
        key = geom.normalize().wkb_hex
        if key in seen:
            warnings["duplicate_geometry"] += 1
            continue
        seen.add(key)
        sid = str(props.get("id") or f.get("id") or f"a{i + 1}")
        name = props.get("name") or props.get("NAME") or f"Atlas Region {i + 1}"
        features.append(
            SourceFeature(
                idx=i,
                source_id=sid,
                name=name,
                name_ru=props.get("name_ru"),
                geom=geom,
                props=props,
                area_km2=area_km2(geom),
            )
        )
    return features, dict(warnings)


def convert_ring(
    ring: list[list[float]], lon_c: list[float], lat_c: list[float]
) -> list[list[float]]:
    out: list[list[float]] = []
    prev_lon: float | None = None
    offset = 0.0
    for pt in ring:
        x, y = float(pt[0]), float(pt[1])
        lon = polyval(lon_c, x)
        lat = polyval(lat_c, y)
        if prev_lon is not None:
            while lon + offset - prev_lon > 180:
                offset -= 360
            while lon + offset - prev_lon < -180:
                offset += 360
        lon2 = lon + offset
        out.append([lon2, lat])
        prev_lon = lon2
    return out


def convert_pixel_geometry(
    geom: dict[str, Any], lon_c: list[float], lat_c: list[float]
) -> dict[str, Any]:
    typ = geom.get("type")
    coords = geom.get("coordinates")
    if typ == "Polygon":
        return {"type": "Polygon", "coordinates": [convert_ring(r, lon_c, lat_c) for r in coords]}
    if typ == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [[convert_ring(r, lon_c, lat_c) for r in poly] for poly in coords],
        }
    raise ValueError(f"unsupported state geometry type: {typ}")


def wrap_dateline_parts(geom: BaseGeometry) -> BaseGeometry | None:
    parts: list[BaseGeometry] = []
    for part in iter_polygon_parts(geom):
        cx = part.representative_point().x
        xoff = 0.0
        while cx + xoff > 180:
            xoff -= 360
        while cx + xoff < -180:
            xoff += 360
        parts.append(translate(part, xoff=xoff) if xoff else part)
    return clean_geom(MultiPolygon(parts) if len(parts) > 1 else (parts[0] if parts else GeometryCollection()))


def load_states(lon_c: list[float], lat_c: list[float]) -> tuple[list[SourceFeature], dict[str, int]]:
    gj = json.loads(STATES_PATH.read_text(encoding="utf-8"))
    warnings = Counter()
    features: list[SourceFeature] = []
    seen = set()

    for i, f in enumerate(gj.get("features", [])):
        props = f.get("properties") or {}
        if not f.get("geometry"):
            warnings["empty_input_geometry"] += 1
            continue
        try:
            converted = convert_pixel_geometry(f["geometry"], lon_c, lat_c)
        except ValueError:
            warnings["unsupported_geometry"] += 1
            continue
        raw_geom = shape(converted)
        raw_geom = wrap_dateline_parts(raw_geom)
        if raw_geom is None:
            warnings["removed_empty_geometry"] += 1
            continue
        if not raw_geom.is_valid:
            warnings["invalid_input_geometry"] += 1
        geom = clean_geom(raw_geom)
        if geom is None:
            warnings["removed_empty_geometry"] += 1
            continue
        key = geom.normalize().wkb_hex
        if key in seen:
            warnings["duplicate_geometry"] += 1
            continue
        seen.add(key)
        sid = str(props.get("id") or f.get("id") or i + 1)
        features.append(
            SourceFeature(
                idx=i,
                source_id=sid,
                name=props.get("name") or f"State {i + 1}",
                name_ru=props.get("name_ru"),
                geom=geom,
                props=props,
                area_km2=area_km2(geom),
            )
        )
    return features, dict(warnings)


GENERIC_STATE_RE = re.compile(
    r"^(state|sov state|ts|china|arab uk|arabian uk|below zero|some mountains|"
    r"southern plain|central islands|border state)(\s*\d+)?$",
    re.IGNORECASE,
)


def state_name_is_useful(name: str | None) -> bool:
    if not name:
        return False
    if GENERIC_STATE_RE.match(name.strip()):
        return False
    return True


def choose_split_name(atlas: SourceFeature, state: SourceFeature, split_count: int) -> tuple[str, str | None]:
    if split_count <= 1 or not state_name_is_useful(state.name):
        return atlas.name, atlas.name_ru
    if state.name.strip().lower() == atlas.name.strip().lower():
        return atlas.name, atlas.name_ru or state.name_ru
    return state.name, state.name_ru or atlas.name_ru


def should_split(atlas: SourceFeature, candidates: list[Candidate], coverage_ratio: float) -> bool:
    if atlas.area_km2 < 18_000 or coverage_ratio < 0.72:
        return False
    min_piece = max(LOCAL_MIN_PIECE_KM2, atlas.area_km2 * LOCAL_MIN_REL)
    usable = [c for c in candidates if c.area_km2 >= min_piece and c.area_km2 / atlas.area_km2 >= 0.018]
    if len(usable) < 2:
        return False
    largest = max(c.area_km2 for c in usable) / atlas.area_km2
    if atlas.area_km2 > 450_000 and largest < 0.94:
        return True
    if atlas.area_km2 > 150_000 and len(usable) >= 2 and largest < 0.88:
        return True
    if atlas.area_km2 > 70_000 and len(usable) >= 3 and largest < 0.82:
        return True
    if atlas.area_km2 > 35_000 and len(usable) >= 4 and largest < 0.72:
        return True
    return False


def shared_boundary_len(a: BaseGeometry, b: BaseGeometry) -> float:
    try:
        return a.boundary.intersection(b.boundary).length
    except GEOSException:
        return 0.0


def nearest_merge_target(piece: BaseGeometry, targets: list[Candidate]) -> int | None:
    if not targets:
        return None
    best_idx: int | None = None
    best_len = 0.0
    for i, target in enumerate(targets):
        length = shared_boundary_len(piece, target.geom)
        if length > best_len:
            best_len = length
            best_idx = i
    if best_idx is not None and best_len > 1e-7:
        return best_idx

    pc = piece.representative_point()
    best_dist = float("inf")
    for i, target in enumerate(targets):
        tc = target.geom.representative_point()
        dist = (pc.x - tc.x) ** 2 + (pc.y - tc.y) ** 2
        if dist < best_dist:
            best_dist = dist
            best_idx = i
    return best_idx


def merge_piece_into(piece: BaseGeometry, target: Candidate) -> bool:
    merged = safe_union([target.geom, piece])
    if merged is None:
        return False
    target.geom = merged
    target.area_km2 = area_km2(merged)
    target.merged_slivers += 1
    return True


def tree_indices(tree: STRtree, query_geom: BaseGeometry, geoms: list[BaseGeometry]) -> Iterable[int]:
    result = tree.query(query_geom)
    for item in result:
        if isinstance(item, numbers.Integral):
            yield int(item)
        else:  # Shapely 1.x compatibility
            for i, geom in enumerate(geoms):
                if geom is item:
                    yield i
                    break


def build_candidates(atlas_features: list[SourceFeature], state_features: list[SourceFeature]) -> tuple[list[Candidate], dict[str, Any]]:
    state_geoms = [s.geom for s in state_features]
    state_tree = STRtree(state_geoms)
    final: list[Candidate] = []
    report = Counter()

    for atlas in atlas_features:
        overlaps: list[Candidate] = []
        for si in tree_indices(state_tree, atlas.geom, state_geoms):
            state = state_features[si]
            if not atlas.geom.intersects(state.geom):
                continue
            inter = safe_intersection(atlas.geom, state.geom)
            if inter is None:
                report["failed_intersections"] += 1
                continue
            iarea = area_km2(inter)
            if iarea < 50.0:
                continue
            name, name_ru = choose_split_name(atlas, state, 2)
            overlaps.append(
                Candidate(
                    atlas=atlas,
                    state=state,
                    geom=inter,
                    area_km2=iarea,
                    source_preference="merged",
                    reason="mixed",
                    name=name,
                    name_ru=name_ru,
                    sort_key=(atlas.idx, state.idx, 0),
                )
            )

        if overlaps:
            covered_geom = safe_union([c.geom for c in overlaps])
            coverage_ratio = area_km2(covered_geom) / max(atlas.area_km2, 1.0) if covered_geom else 0.0
        else:
            coverage_ratio = 0.0

        if not should_split(atlas, overlaps, coverage_ratio):
            final.append(
                Candidate(
                    atlas=atlas,
                    state=None,
                    geom=atlas.geom,
                    area_km2=atlas.area_km2,
                    source_preference="atlas",
                    reason=atlas_reason(atlas),
                    name=atlas.name,
                    name_ru=atlas.name_ru,
                    sort_key=(atlas.idx, -1, 0),
                )
            )
            report["kept_atlas_regions"] += 1
            continue

        split_count = len(overlaps)
        for c in overlaps:
            if c.state:
                c.name, c.name_ru = choose_split_name(atlas, c.state, split_count)

        min_piece = max(LOCAL_MIN_PIECE_KM2, atlas.area_km2 * LOCAL_MIN_REL)
        selected: list[Candidate] = []
        discarded: list[BaseGeometry] = []
        for c in overlaps:
            rel = c.area_km2 / max(atlas.area_km2, 1.0)
            if c.area_km2 >= min_piece and rel >= 0.01:
                selected.append(c)
            else:
                discarded.append(c.geom)

        if len(selected) < 2:
            final.append(
                Candidate(
                    atlas=atlas,
                    state=None,
                    geom=atlas.geom,
                    area_km2=atlas.area_km2,
                    source_preference="atlas",
                    reason=atlas_reason(atlas),
                    name=atlas.name,
                    name_ru=atlas.name_ru,
                    sort_key=(atlas.idx, -1, 0),
                )
            )
            report["kept_atlas_regions"] += 1
            continue

        selected_union = safe_union([c.geom for c in selected])
        remainder = safe_difference(atlas.geom, selected_union) if selected_union is not None else atlas.geom
        if remainder is not None:
            for part in iter_polygon_parts(remainder):
                part = clean_geom(part)
                if part is None:
                    continue
                part_area = area_km2(part)
                if part_area < 50:
                    continue
                if part_area > max(30_000.0, atlas.area_km2 * 0.12):
                    selected.append(
                        Candidate(
                            atlas=atlas,
                            state=None,
                            geom=part,
                            area_km2=part_area,
                            source_preference="generated",
                            reason="mixed",
                            name=atlas.name,
                            name_ru=atlas.name_ru,
                            generated=True,
                            sort_key=(atlas.idx, 10_000, len(selected)),
                        )
                    )
                    report["generated_remainders"] += 1
                else:
                    discarded.append(part)

        for piece in discarded:
            target_idx = nearest_merge_target(piece, selected)
            if target_idx is not None and merge_piece_into(piece, selected[target_idx]):
                report["merged_local_slivers"] += 1

        final.extend(selected)
        report["split_atlas_regions"] += 1

    return final, dict(report)


def atlas_reason(atlas: SourceFeature) -> str:
    if atlas.props.get("historicalArea"):
        return "historical"
    if atlas.props.get("culturalArea"):
        return "cultural"
    return "geographical"


def remove_duplicate_outputs(candidates: list[Candidate]) -> tuple[list[Candidate], int]:
    seen = set()
    out: list[Candidate] = []
    duplicates = 0
    for c in candidates:
        geom = clean_geom(c.geom)
        if geom is None:
            duplicates += 1
            continue
        c.geom = geom
        key = geom.normalize().wkb_hex
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        out.append(c)
    return out, duplicates


def merge_global_slivers(candidates: list[Candidate]) -> tuple[list[Candidate], int]:
    removed = 0
    changed = True
    passes = 0
    while changed and passes < 3:
        passes += 1
        changed = False
        geoms = [c.geom for c in candidates]
        tree = STRtree(geoms)
        keep = [True] * len(candidates)

        order = sorted(range(len(candidates)), key=lambda i: candidates[i].area_km2)
        for i in order:
            if not keep[i]:
                continue
            cand = candidates[i]
            if cand.area_km2 > GLOBAL_SLIVER_KM2:
                continue

            best_idx: int | None = None
            best_len = 0.0
            for j in tree_indices(tree, cand.geom, geoms):
                if i == j or not keep[j]:
                    continue
                length = shared_boundary_len(cand.geom, candidates[j].geom)
                if length > best_len:
                    best_len = length
                    best_idx = j

            isolated_island = best_len <= 1e-6
            if isolated_island and cand.area_km2 >= FORCE_TINY_SLIVER_KM2:
                continue
            if best_idx is None:
                continue

            if merge_piece_into(cand.geom, candidates[best_idx]):
                keep[i] = False
                removed += 1
                changed = True

        if changed:
            candidates = [c for i, c in enumerate(candidates) if keep[i]]

    return candidates, removed


def enforce_region_cap(candidates: list[Candidate], cap: int = TARGET_MAX) -> tuple[list[Candidate], int]:
    merged = 0
    while len(candidates) > cap:
        candidates, removed = merge_global_slivers(candidates)
        merged += removed
        if removed == 0:
            break
    return candidates, merged


def source_props(c: Candidate, region_id: str) -> dict[str, Any]:
    atlas_props = c.atlas.props
    state_props = c.state.props if c.state else {}
    return {
        "id": region_id,
        "name": c.name,
        "sourceAtlasId": c.atlas.source_id,
        "sourceStateId": c.state.source_id if c.state else None,
        "sourcePreference": c.source_preference,
        "reason": c.reason,
        "terrain": state_props.get("terrain") or atlas_props.get("terrain"),
        "historicalArea": atlas_props.get("historicalArea"),
        "culturalArea": atlas_props.get("culturalArea"),
        "ownerCountryId": atlas_props.get("ownerCountryId"),
        "color": atlas_props.get("color"),
        "notes": "",
    }


def to_feature_collection(candidates: list[Candidate], simplify_tolerance: float | None, ndigits: int) -> dict[str, Any]:
    features = []
    ordered = sorted(candidates, key=lambda c: c.sort_key)
    for idx, c in enumerate(ordered, start=1):
        geom = c.geom
        if simplify_tolerance:
            simplified = clean_geom(geom.simplify(simplify_tolerance, preserve_topology=True))
            if simplified is not None and area_km2(simplified) >= max(20.0, c.area_km2 * 0.85):
                geom = simplified
        if set_precision is not None:
            quantized = clean_geom(set_precision(geom, 10 ** -ndigits), precision=None)
            if quantized is not None and area_km2(quantized) >= max(10.0, area_km2(geom) * 0.80):
                geom = quantized
        geom = orient_for_d3(geom)
        gj_geom = mapping(geom)
        gj_geom["coordinates"] = round_coords(gj_geom["coordinates"], ndigits)
        region_id = f"region_{idx:04d}"
        features.append({"type": "Feature", "properties": source_props(c, region_id), "geometry": gj_geom})
    return {"type": "FeatureCollection", "features": features}


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def copy_text(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


def build(args: argparse.Namespace) -> dict[str, Any]:
    lon_c, lat_c, anchors_used = load_anchor_projection()
    atlas, atlas_warnings = load_atlas()
    states, state_warnings = load_states(lon_c, lat_c)

    candidates, build_report = build_candidates(atlas, states)
    candidates, duplicate_outputs = remove_duplicate_outputs(candidates)
    candidates, global_slivers = merge_global_slivers(candidates)
    candidates, cap_merges = enforce_region_cap(candidates)

    full = to_feature_collection(candidates, simplify_tolerance=None, ndigits=5)
    simplified = to_feature_collection(candidates, simplify_tolerance=args.simplify_tolerance, ndigits=3)

    write_json(OUT_FULL, full)
    write_json(OUT_SIMPLIFIED, simplified)
    copy_text(OUT_FULL, MIRROR_FULL)
    copy_text(OUT_SIMPLIFIED, MIRROR_SIMPLIFIED)

    final_count = len(full["features"])
    warnings: list[str] = []
    if final_count < TARGET_MIN or final_count > TARGET_MAX:
        warnings.append(f"final region count {final_count} is outside desired {TARGET_MIN}-{TARGET_MAX}")

    report = {
        "inputs": {
            "atlasPath": str(ATLAS_PATH.relative_to(ROOT)),
            "statesPath": str(STATES_PATH.relative_to(ROOT)),
            "projectionReferencePath": str(STATE_REF_PATH.relative_to(ROOT)),
        },
        "outputs": {
            "full": str(OUT_FULL.relative_to(ROOT)),
            "simplified": str(OUT_SIMPLIFIED.relative_to(ROOT)),
            "report": str(OUT_REPORT.relative_to(ROOT)),
            "appMirrorFull": str(MIRROR_FULL.relative_to(ROOT)),
            "appMirrorSimplified": str(MIRROR_SIMPLIFIED.relative_to(ROOT)),
        },
        "counts": {
            "atlasInputRegions": len(atlas),
            "statesInputRegions": len(states),
            "finalRegions": final_count,
            "splitAtlasRegions": build_report.get("split_atlas_regions", 0),
            "keptAtlasRegions": build_report.get("kept_atlas_regions", 0),
            "generatedRemainders": build_report.get("generated_remainders", 0),
            "removedDuplicateGeometries": duplicate_outputs,
            "removedSlivers": global_slivers + cap_merges,
            "mergedRegions": build_report.get("merged_local_slivers", 0) + global_slivers + cap_merges,
        },
        "validation": {
            "atlasWarnings": atlas_warnings,
            "statesWarnings": state_warnings,
            "projectionAnchorsUsed": anchors_used,
            "failedIntersections": build_report.get("failed_intersections", 0),
        },
        "parameters": {
            "targetRegionCount": [TARGET_MIN, TARGET_MAX],
            "globalSliverKm2": GLOBAL_SLIVER_KM2,
            "localMinPieceKm2": LOCAL_MIN_PIECE_KM2,
            "simplifyToleranceDegrees": args.simplify_tolerance,
            "statePixelMap": {"width": STATE_W, "height": STATE_H},
        },
        "warnings": warnings,
    }
    write_json(OUT_REPORT, report)
    copy_text(OUT_REPORT, MIRROR_REPORT)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the best_regions_world editable region layer.")
    parser.add_argument(
        "--simplify-tolerance",
        type=float,
        default=0.035,
        help="Douglas-Peucker simplification tolerance in lon/lat degrees for the light web version.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build(args)
    counts = report["counts"]
    print(
        "wrote best_regions_world: "
        f"{counts['finalRegions']} regions "
        f"({counts['splitAtlasRegions']} atlas regions split, "
        f"{counts['mergedRegions']} sliver/fragment merges)"
    )
    if report["warnings"]:
        for warning in report["warnings"]:
            print("warning:", warning, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
