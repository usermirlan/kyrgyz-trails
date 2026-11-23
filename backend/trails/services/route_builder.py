"""Hand-drawn routes: waypoints → sampled path with elevations, distance, ascent, time.

Elevations come from the free Open-Meteo elevation API (Copernicus DEM, 90 m, no key).
The network call is isolated in `fetch_elevations` so tests can replace it.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

import httpx
from django.core.cache import cache

from .gpx import PROFILE_POINTS, _downsample, haversine_m

OPEN_METEO_ELEVATION = "https://api.open-meteo.com/v1/elevation"
BATCH = 100  # the API accepts up to 100 coordinates per request
# The free tier rate-limits by coordinate count, so sample sparsely (the DEM is 90 m
# anyway) and sample each segment on its own: adding a waypoint then only needs the
# new segment's points, the rest come from the per-point cache.
SAMPLE_STEP_M = 80
MAX_SAMPLES_PER_SEGMENT = 60
CACHE_SECONDS = 7 * 24 * 60 * 60
# DEM noise adds fake metres on every wiggle: smooth, then ignore climbs under 10 m.
SMOOTH_WINDOW = 3
DEM_ASCENT_THRESHOLD_M = 10.0

# Walking-time model: 4 km/h on the flat, +1 h per 600 m up, +1 h per 1000 m down
# (a common mountain-guide rule of thumb, close to Naismith with descent correction).
FLAT_KMH = 4.0
ASCENT_M_PER_H = 600.0
DESCENT_M_PER_H = 1000.0

Point = tuple[float, float]  # (lng, lat)


class RouteError(ValueError):
    pass


class RateLimited(Exception):
    pass


def fetch_elevations(points: Sequence[Point]) -> list[float]:
    out: list[float] = []
    for i in range(0, len(points), BATCH):
        chunk = points[i : i + BATCH]
        r = httpx.get(
            OPEN_METEO_ELEVATION,
            params={
                "latitude": ",".join(f"{lat:.5f}" for _, lat in chunk),
                "longitude": ",".join(f"{lng:.5f}" for lng, _ in chunk),
            },
            timeout=10,
        )
        if r.status_code == 429:
            raise RateLimited
        r.raise_for_status()
        out.extend(float(e) for e in r.json()["elevation"])
    return out


def _key(p: Point) -> str:
    return f"elev:{p[0]:.5f}:{p[1]:.5f}"


def _cached_elevations(points: Sequence[Point]) -> list[float]:
    keys = [_key(p) for p in points]
    known = cache.get_many(keys)
    missing = list(dict.fromkeys(k for k in keys if k not in known))
    if missing:
        by_key = {_key(p): p for p in points}
        fetched = fetch_elevations([by_key[k] for k in missing])
        new = dict(zip(missing, fetched))
        cache.set_many(new, CACHE_SECONDS)
        known.update(new)
    return [known[k] for k in keys]


def sample_path(waypoints: Sequence[Point]) -> tuple[list[Point], list[float]]:
    """Points every ~80 m along each segment (at most 60 per segment).

    Returns the points and their distance from the start in metres. Waypoints are
    always kept so the drawn corners survive, and a segment's samples depend only
    on its own two ends, so they stay identical when more waypoints are added.
    """
    pts: list[Point] = [waypoints[0]]
    dist: list[float] = [0.0]
    walked = 0.0
    for a, b in zip(waypoints, waypoints[1:]):
        length = haversine_m(a[1], a[0], b[1], b[0])
        n = max(1, min(MAX_SAMPLES_PER_SEGMENT, round(length / SAMPLE_STEP_M)))
        for k in range(1, n + 1):
            f = k / n
            pts.append((round(a[0] + (b[0] - a[0]) * f, 5), round(a[1] + (b[1] - a[1]) * f, 5)))
            dist.append(walked + length * f)
        walked += length
    return pts, dist


def smooth(values: list[float], window: int = SMOOTH_WINDOW) -> list[float]:
    """Moving average; the two ends are kept so start/finish heights stay exact."""
    if len(values) < window:
        return list(values)
    half = window // 2
    out = list(values)
    for i in range(half, len(values) - half):
        out[i] = sum(values[i - half : i + half + 1]) / window
    return out


def _climb(elevations: list[float]) -> float:
    gain, ref = 0.0, elevations[0]
    for e in elevations[1:]:
        if e - ref >= DEM_ASCENT_THRESHOLD_M:
            gain += e - ref
            ref = e
        elif ref - e >= DEM_ASCENT_THRESHOLD_M:
            ref = e
    return gain


def walking_hours(distance_km: float, ascent_m: float, descent_m: float) -> float:
    return distance_km / FLAT_KMH + ascent_m / ASCENT_M_PER_H + descent_m / DESCENT_M_PER_H


def analyze(
    waypoints: Sequence[Sequence[float]],
    elevations: Callable[[Sequence[Point]], list[float]] = _cached_elevations,
) -> dict:
    wps: list[Point] = [(float(p[0]), float(p[1])) for p in waypoints]
    if len(wps) < 2:
        raise RouteError("Маршрут үчүн кеминде 2 чекит керек")
    for lng, lat in wps:
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise RouteError("Координаталар туура эмес")

    pts, dist = sample_path(wps)
    try:
        eles = elevations(pts)
    except RateLimited as e:
        raise RouteError("Бийиктик кызматынын лимити толду — бир мүнөттөн кийин кайталаңыз") from e
    except httpx.HTTPError as e:
        raise RouteError("Бийиктик кызматы жооп бербей жатат, кийинчерээк аракет кылыңыз") from e

    smoothed = smooth(eles)
    ascent = _climb(smoothed)
    descent = _climb(smoothed[::-1])
    distance_km = dist[-1] / 1000
    profile = _downsample(
        [[round(d / 1000, 3), round(e)] for d, e in zip(dist, eles)], PROFILE_POINTS
    )
    return {
        "distance_km": round(distance_km, 2),
        "ascent_m": round(ascent),
        "descent_m": round(descent),
        "min_elevation_m": round(min(eles)),
        "max_elevation_m": round(max(eles)),
        "duration_h": round(walking_hours(distance_km, ascent, descent), 1),
        "profile": profile,
        "path": [[round(lng, 6), round(lat, 6), round(e)] for (lng, lat), e in zip(pts, eles)],
    }
