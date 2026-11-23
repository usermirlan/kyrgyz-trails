"""GPX → route geometry + stats. Pure Python (no Django) so it is easy to unit-test."""

from __future__ import annotations

import math
from dataclasses import dataclass

import gpxpy

EARTH_RADIUS_M = 6_371_008.8
# Ignore elevation noise smaller than this when summing ascent (GPS jitter).
ASCENT_THRESHOLD_M = 5.0
PROFILE_POINTS = 200


@dataclass
class TrackStats:
    coords: list[tuple[float, float]]  # (lng, lat)
    distance_km: float
    elevation_gain_m: int
    max_elevation_m: int | None
    profile: list[list[float]]  # [[km, elevation_m], ...]


class GPXError(ValueError):
    pass


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _points(gpx: gpxpy.gpx.GPX) -> list[tuple[float, float, float | None]]:
    pts = [
        (p.latitude, p.longitude, p.elevation)
        for track in gpx.tracks
        for seg in track.segments
        for p in seg.points
    ]
    if not pts:  # some apps export <rte> instead of <trk>
        pts = [(p.latitude, p.longitude, p.elevation) for r in gpx.routes for p in r.points]
    return pts


def _ascent(elevations: list[float]) -> float:
    """Hysteresis ascent: only count climbs once they exceed the threshold."""
    if not elevations:
        return 0.0
    gain, ref = 0.0, elevations[0]
    for e in elevations[1:]:
        if e - ref >= ASCENT_THRESHOLD_M:
            gain += e - ref
            ref = e
        elif ref - e >= ASCENT_THRESHOLD_M:
            ref = e
    return gain


def _downsample(rows: list[list[float]], n: int) -> list[list[float]]:
    if len(rows) <= n:
        return rows
    step = (len(rows) - 1) / (n - 1)
    return [rows[round(i * step)] for i in range(n)]


def parse_gpx(content: str | bytes) -> TrackStats:
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    try:
        gpx = gpxpy.parse(content)
    except Exception as e:  # gpxpy raises several exception types
        raise GPXError(f"GPX файлды окуу мүмкүн эмес: {e}") from e

    pts = _points(gpx)
    if len(pts) < 2:
        raise GPXError("GPX файлда кеминде 2 чекит болушу керек")

    total_m = 0.0
    profile: list[list[float]] = []
    for i, (lat, lng, ele) in enumerate(pts):
        if i:
            plat, plng, _ = pts[i - 1]
            total_m += haversine_m(plat, plng, lat, lng)
        if ele is not None:
            profile.append([round(total_m / 1000, 3), round(ele, 1)])

    elevations = [e for _, _, e in pts if e is not None]
    return TrackStats(
        coords=[(lng, lat) for lat, lng, _ in pts],
        distance_km=round(total_m / 1000, 1),
        elevation_gain_m=round(_ascent(elevations)),
        max_elevation_m=round(max(elevations)) if elevations else None,
        profile=_downsample(profile, PROFILE_POINTS),
    )
