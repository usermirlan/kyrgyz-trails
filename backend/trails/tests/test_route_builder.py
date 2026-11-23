"""Unit tests for the route builder service — no database or network needed."""

import pytest

from trails.services.route_builder import RouteError, analyze, sample_path, walking_hours

# ~1.11 km due north near Bishkek (0.01° of latitude)
A = (74.60, 42.80)
B = (74.60, 42.81)


def flat(points):
    return [1000.0] * len(points)


def climb(points):
    # linear climb from 1000 m to 1500 m
    n = len(points) - 1
    return [1000.0 + 500.0 * i / n for i in range(len(points))]


def test_sample_path_spacing_and_endpoints():
    pts, dist = sample_path([A, B])
    assert pts[0] == A and pts[-1] == pytest.approx(B)
    assert dist[-1] == pytest.approx(1112, rel=0.01)
    gaps = [b - a for a, b in zip(dist, dist[1:])]
    assert max(gaps) <= 90


def test_sample_path_is_capped_per_segment():
    pts, _ = sample_path([(74.0, 42.0), (75.5, 42.0), (75.5, 43.0)])  # ~230 km
    assert len(pts) == 1 + 60 + 60


def test_segments_sample_the_same_when_extended():
    # adding a waypoint must not move earlier samples (they are cached per point)
    short, _ = sample_path([A, B])
    longer, _ = sample_path([A, B, (74.7, 42.9)])
    assert longer[: len(short)] == short


def test_smooth_removes_dem_noise():
    noisy = [1000 + (12 if i % 2 else 0) for i in range(40)]
    r = analyze([A, B], elevations=lambda pts: [noisy[i % 40] for i in range(len(pts))])
    assert r["ascent_m"] < 30


def test_analyze_flat_route():
    r = analyze([A, B], elevations=flat)
    assert r["distance_km"] == pytest.approx(1.11, abs=0.01)
    assert r["ascent_m"] == 0 and r["descent_m"] == 0
    assert r["duration_h"] == pytest.approx(1.11 / 4, abs=0.05)
    assert r["path"][0] == [74.6, 42.8, 1000]


def test_analyze_climb_counts_ascent_and_time():
    r = analyze([A, B], elevations=climb)
    assert r["ascent_m"] == pytest.approx(500, abs=10)
    assert r["descent_m"] == 0
    assert r["max_elevation_m"] == 1500 and r["min_elevation_m"] == 1000
    assert r["duration_h"] == pytest.approx(1.11 / 4 + 500 / 600, abs=0.1)
    # reversed route: the same metres become descent
    back = analyze([B, A], elevations=climb)
    assert back["ascent_m"] == pytest.approx(500, abs=10)


def test_profile_starts_at_zero_and_ends_at_distance():
    r = analyze([A, B, (74.61, 42.81)], elevations=flat)
    assert r["profile"][0][0] == 0
    assert r["profile"][-1][0] == pytest.approx(r["distance_km"], abs=0.01)


def test_walking_hours_rule():
    assert walking_hours(8, 600, 1000) == pytest.approx(4.0)


@pytest.mark.parametrize("pts", [[A], [(200.0, 42.0), B]])
def test_invalid_input(pts):
    with pytest.raises(RouteError):
        analyze(pts, elevations=flat)


# ---- follow trails ---------------------------------------------------------

def zigzag_router(a, b):
    """Fake BRouter: a dog-leg via an intermediate point, with SRTM heights."""
    mid = ((a[0] + b[0]) / 2 + 0.005, (a[1] + b[1]) / 2)
    up = [(a[0] + (mid[0] - a[0]) * i / 10, a[1] + (mid[1] - a[1]) * i / 10, 1000.0 + 10 * i) for i in range(11)]
    down = [(mid[0] + (b[0] - mid[0]) * i / 10, mid[1] + (b[1] - mid[1]) * i / 10, 1100.0 - 10 * i) for i in range(1, 11)]
    return up + down


def test_follow_trails_uses_routed_geometry_and_its_heights():
    calls = []

    def elevations(pts):
        calls.append(len(pts))
        return [0.0] * len(pts)

    r = analyze([A, B], follow_trails=True, router=zigzag_router, elevations=elevations)
    assert len(r["path"]) == 21 and r["max_elevation_m"] == 1100
    assert r["distance_km"] > 1.11  # the detour is longer than the straight line
    assert 90 <= r["ascent_m"] <= 100 and 90 <= r["descent_m"] <= 100
    assert r["straight_legs"] == 0 and calls == []  # no DEM lookups needed


def test_follow_trails_falls_back_to_straight_leg():
    def router(a, b):
        return None if a == B else zigzag_router(a, b)

    r = analyze([A, B, (74.61, 42.81)], follow_trails=True, router=router, elevations=flat)
    assert r["straight_legs"] == 1
    assert r["path"][-1][:2] == [74.61, 42.81]


def test_follow_trails_connects_snapped_ends():
    def far_router(a, b):  # snaps both ends ~100 m away onto a path
        return [(a[0] + 0.001, a[1], 900.0), (b[0] + 0.001, b[1], 900.0)]

    r = analyze([A, B], follow_trails=True, router=far_router, elevations=flat)
    assert r["path"][0][:2] == [74.6, 42.8] and r["path"][-1][:2] == [74.6, 42.81]
    assert len(r["path"]) == 4
