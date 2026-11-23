"""Driving directions to a trailhead via the free FOSSGIS OSRM server (no key).

Returns the route line, total distance/time and simplified turn-by-turn steps.
The maneuver is returned as data (type/modifier/road name) so the frontend can
word it in the user's language.
"""

from __future__ import annotations

import httpx
from django.core.cache import cache

OSRM = "https://routing.openstreetmap.de/routed-car/route/v1/driving"
CACHE_SECONDS = 24 * 60 * 60

# Ala-Too Square, Bishkek — the default starting point
BISHKEK = (74.6037, 42.8766)

# OSRM step types that carry no instruction of their own
_SILENT = {"new name", "notification", "continue", "use lane"}


class NoRoute(Exception):
    pass


def fetch_route(origin: tuple[float, float], dest: tuple[float, float]) -> dict:
    url = f"{OSRM}/{origin[0]:.5f},{origin[1]:.5f};{dest[0]:.5f},{dest[1]:.5f}"
    r = httpx.get(
        url,
        params={"overview": "full", "geometries": "geojson", "steps": "true"},
        timeout=15,
        headers={"User-Agent": "TooArna/1.0 (portfolio project)"},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise NoRoute(data.get("message") or data.get("code"))
    return data["routes"][0]


def simplify_steps(steps: list[dict]) -> list[dict]:
    """Fold silent steps (road renamed, 'continue straight') into the previous one."""
    out: list[dict] = []
    for s in steps:
        m = s.get("maneuver", {})
        typ, mod = m.get("type", ""), m.get("modifier", "")
        if out and (typ in _SILENT and mod in ("", "straight")):
            out[-1]["distance_m"] += s.get("distance", 0)
            continue
        step = {
            "type": typ,
            "modifier": mod,
            "name": s.get("name") or s.get("ref") or "",
            "exit": m.get("exit"),
            "distance_m": s.get("distance", 0),
        }
        out.append(step)
    for s in out:
        s["distance_m"] = round(s["distance_m"])
    return out


def directions(dest: tuple[float, float], origin: tuple[float, float] = BISHKEK) -> dict:
    key = f"dir:{origin[0]:.4f},{origin[1]:.4f}:{dest[0]:.5f},{dest[1]:.5f}"
    if (hit := cache.get(key)) is not None:
        return hit
    route = fetch_route(origin, dest)
    steps = [s for leg in route["legs"] for s in leg["steps"]]
    result = {
        "distance_km": round(route["distance"] / 1000, 1),
        "duration_min": round(route["duration"] / 60),
        "geometry": [[round(x, 5), round(y, 5)] for x, y in route["geometry"]["coordinates"]],
        "steps": simplify_steps(steps),
        "origin": [origin[0], origin[1]],
        "destination": [dest[0], dest[1]],
    }
    cache.set(key, result, CACHE_SECONDS)
    return result
