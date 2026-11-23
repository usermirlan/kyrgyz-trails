"""Unit tests for driving directions — no database or network."""

from unittest import mock

import pytest

from trails.services.directions import NoRoute, directions, simplify_steps

STEPS = [
    {"maneuver": {"type": "depart", "modifier": ""}, "name": "Чүй проспектиси", "distance": 500.4},
    {"maneuver": {"type": "new name", "modifier": "straight"}, "name": "Ч. Айтматов", "distance": 300},
    {"maneuver": {"type": "turn", "modifier": "left"}, "name": "Ала-Арча жолу", "distance": 20000},
    {"maneuver": {"type": "roundabout", "modifier": "right", "exit": 2}, "name": "", "distance": 150},
    {"maneuver": {"type": "arrive", "modifier": ""}, "name": "", "distance": 0},
]


def test_simplify_folds_silent_steps():
    s = simplify_steps(STEPS)
    assert [x["type"] for x in s] == ["depart", "turn", "roundabout", "arrive"]
    assert s[0]["distance_m"] == 800  # depart + renamed road
    assert s[2]["exit"] == 2
    assert s[1]["name"] == "Ала-Арча жолу"


def test_directions_shapes_and_caches():
    route = {
        "distance": 41234,
        "duration": 3000,
        "geometry": {"coordinates": [[74.6037, 42.8766], [74.48251, 42.56471]]},
        "legs": [{"steps": STEPS}],
    }
    with mock.patch("trails.services.directions.fetch_route", return_value=route) as m, \
         mock.patch("trails.services.directions.cache") as cache:
        cache.get.return_value = None
        d = directions((74.4825, 42.5647))
    assert d["distance_km"] == 41.2 and d["duration_min"] == 50
    assert d["geometry"][-1] == [74.48251, 42.56471]
    assert len(d["steps"]) == 4
    m.assert_called_once()
    cache.set.assert_called_once()


def test_no_route_propagates():
    with mock.patch("trails.services.directions.fetch_route", side_effect=NoRoute("x")), \
         mock.patch("trails.services.directions.cache") as cache:
        cache.get.return_value = None
        with pytest.raises(NoRoute):
            directions((0.0, 0.0))
