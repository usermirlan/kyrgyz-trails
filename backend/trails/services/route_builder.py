"""Hand-drawn routes: waypoints → path with elevations, distance, ascent, time.

Two modes:
* straight lines between the clicked points, elevations from the free Open-Meteo
  elevation API (Copernicus DEM, 90 m, no key);
* "follow trails": each leg is routed along OpenStreetMap paths by the free BRouter
  service (hiking-mountain profile), which also returns SRTM elevations. A leg with
  no trail nearby falls back to a straight line, and the caller is told how many.

Network calls are isolated in `fetch_elevations` / `fetch_trail_leg` so tests can
replace them.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence

import httpx
from django.core.cache import cache

from .gpx import PROFILE_POINTS, _downsample, haversine_m

OPEN_METEO_ELEVATION = "https://api.open-meteo.com/v1/elevation"
BROUTER = "https://brouter.de/brouter"
BROUTER_PROFILE = "hiking-mountain"
# if BRouter snaps a clicked point further than this onto a path, draw the gap
SNAP_GAP_M = 15
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

log = logging.getLogger(__name__)

Point = tuple[float, float]  # (lng, lat)
Point3 = tuple[float, float, float | None]  # (lng, lat, elevation or None)


class RouteError(ValueError):
    pass


class RateLimited(Exception):
    pass


class NoTrail(Exception):
    """BRouter found no path between two points (e.g. off the map data)."""


def fetch_trail_leg(a: Point, b: Point) -> list[Point3]:
    r = httpx.get(
        BROUTER,
        params={
            "lonlats": f"{a[0]:.6f},{a[1]:.6f}|{b[0]:.6f},{b[1]:.6f}",
            "profile": BROUTER_PROFILE,
            "alternativeidx": 0,
            "format": "geojson",
        },
        timeout=30,  # BRouter can be slow on long mountain legs
    )
    if r.status_code == 429:
        raise RateLimited
    if r.status_code != 200:  # BRouter answers 400 with a plain-text reason
        raise NoTrail(r.text[:200])
    coords = r.json()["features"][0]["geometry"]["coordinates"]
    return [(c[0], c[1], c[2] if len(c) > 2 else None) for c in coords]


def _cached_trail_leg(a: Point, b: Point) -> list[Point3] | None:
    """Routed leg, or None when there is no trail. Both outcomes are cached."""
    key = f"leg:{BROUTER_PROFILE}:{a[0]:.5f},{a[1]:.5f}:{b[0]:.5f},{b[1]:.5f}"
    hit = cache.get(key)
    if hit is not None:
        return hit or None
    try:
        leg = fetch_trail_leg(a, b)
    except NoTrail as e:
        log.info("BRouter: no trail %s -> %s: %s", a, b, e)
        leg = []
    cache.set(key, leg, CACHE_SECONDS)
    return leg or None


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


def _straight_leg(a: Point, b: Point) -> list[Point3]:
    pts, _ = sample_path([a, b])
    return [(lng, lat, None) for lng, lat in pts]


def trail_path(
    waypoints: Sequence[Point],
    router: Callable[[Point, Point], list[Point3] | None] = _cached_trail_leg,
) -> tuple[list[Point3], int]:
    """Concatenate routed legs. Returns the path and how many legs stayed straight."""
    path: list[Point3] = []
    straight = 0
    for a, b in zip(waypoints, waypoints[1:]):
        try:
            leg = router(a, b)
        except httpx.HTTPError as e:
            log.warning("BRouter request failed: %r", e)
            leg = None
        if leg:
            # connect the clicked points to where BRouter snapped them onto a path
            if haversine_m(a[1], a[0], leg[0][1], leg[0][0]) > SNAP_GAP_M:
                leg = [(a[0], a[1], None), *leg]
            if haversine_m(b[1], b[0], leg[-1][1], leg[-1][0]) > SNAP_GAP_M:
                leg = [*leg, (b[0], b[1], None)]
        else:
            straight += 1
            leg = _straight_leg(a, b)
        path.extend(leg if not path else leg[1:])
    return path, straight


def analyze(
    waypoints: Sequence[Sequence[float]],
    follow_trails: bool = False,
    elevations: Callable[[Sequence[Point]], list[float]] = _cached_elevations,
    router: Callable[[Point, Point], list[Point3] | None] = _cached_trail_leg,
) -> dict:
    wps: list[Point] = [(float(p[0]), float(p[1])) for p in waypoints]
    if len(wps) < 2:
        raise RouteError("Маршрут үчүн кеминде 2 чекит керек")
    for lng, lat in wps:
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise RouteError("Координаталар туура эмес")

    try:
        if follow_trails:
            path3, straight = trail_path(wps, router)
            pts = [(p[0], p[1]) for p in path3]
            # BRouter gives SRTM heights; ask the DEM only for points it left empty
            gaps = [i for i, p in enumerate(path3) if p[2] is None]
            filled = dict(zip(gaps, elevations([pts[i] for i in gaps]))) if gaps else {}
            eles = [float(p[2]) if p[2] is not None else filled[i] for i, p in enumerate(path3)]
            dist = [0.0]
            for a, b in zip(pts, pts[1:]):
                dist.append(dist[-1] + haversine_m(a[1], a[0], b[1], b[0]))
        else:
            straight = len(wps) - 1
            pts, dist = sample_path(wps)
            eles = elevations(pts)
    except RateLimited as e:
        raise RouteError("Карта кызматынын лимити толду — бир мүнөттөн кийин кайталаңыз") from e
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
        "follow_trails": follow_trails,
        "straight_legs": straight if follow_trails else 0,
    }
