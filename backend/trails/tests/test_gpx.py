from pathlib import Path

import pytest

from trails.services.gpx import GPXError, _ascent, haversine_m, parse_gpx

SAMPLE = Path(__file__).parent / "data" / "sample.gpx"


def test_haversine_one_degree_latitude():
    assert haversine_m(0, 0, 1, 0) == pytest.approx(111_195, rel=1e-3)


def test_ascent_ignores_small_noise():
    # +100, -20 (dip), +170, +2 (noise, ignored)
    assert _ascent([2100, 2200, 2180, 2350, 2352]) == pytest.approx(270)


def test_parse_sample_track():
    s = parse_gpx(SAMPLE.read_bytes())
    assert len(s.coords) == 5
    assert s.coords[0] == (74.48, 42.56)  # (lng, lat) order
    assert 2.5 < s.distance_km < 3.0
    assert s.elevation_gain_m == 270
    assert s.max_elevation_m == 2352
    assert s.profile[0] == [0.0, 2100.0]
    assert s.profile[-1][0] == pytest.approx(s.distance_km, abs=0.1)


def test_rejects_garbage():
    with pytest.raises(GPXError):
        parse_gpx(b"not xml at all")


def test_rejects_single_point():
    gpx = SAMPLE.read_text().split("<trkpt", 2)
    one_point = gpx[0] + "<trkpt" + gpx[1].split("</trkpt>")[0] + "</trkpt></trkseg></trk></gpx>"
    with pytest.raises(GPXError):
        parse_gpx(one_point)
