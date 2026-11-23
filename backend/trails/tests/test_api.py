"""API integration tests — run inside Docker (need PostGIS): docker compose exec backend pytest"""

from pathlib import Path
from unittest import mock

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import Client

SAMPLE_GPX = Path(__file__).parent / "data" / "sample.gpx"
pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def seeded(db):
    cache.clear()
    call_command("seed_trails", verbosity=0)


@pytest.fixture
def client():
    return Client()


def auth_header(client, email="a@test.kg", staff=False):
    r = client.post(
        "/api/auth/register",
        {"email": email, "password": "Tooarna-2026!", "name": "Asel"},
        content_type="application/json",
    )
    assert r.status_code == 201, r.content
    if staff:
        User.objects.filter(email=email).update(is_staff=True)
    return {"HTTP_AUTHORIZATION": f"Bearer {r.json()['token']}"}


# ---- trails ---------------------------------------------------------------

def test_list_returns_all(client):
    r = client.get("/api/trails")
    assert r.status_code == 200
    assert len(r.json()) == 10


def test_filter_by_region_and_difficulty(client):
    r = client.get("/api/trails", {"region": "issyk_kul", "difficulty": "easy"})
    slugs = {t["slug"] for t in r.json()}
    assert "skazka-canyon" in slugs
    assert "ala-kul-trek" not in slugs


def test_month_filter(client):
    r = client.get("/api/trails", {"month": 4})
    assert "ala-kul-trek" not in {t["slug"] for t in r.json()}


def test_nearby_sorted_by_distance(client):
    r = client.get("/api/trails", {"lat": 42.8746, "lng": 74.5698, "radius_km": 60})
    data = r.json()
    assert data[0]["slug"].startswith("ala-archa")
    assert all(t["distance_from_you_km"] <= 60 for t in data)


def test_detail_language(client):
    r = client.get("/api/trails/sary-chelek", {"lang": "en"})
    assert r.status_code == 200
    assert r.json()["title"] == "Sary-Chelek Lake"


# ---- auth -----------------------------------------------------------------

def test_register_login_me_logout(client):
    h = auth_header(client)
    assert client.get("/api/auth/me", **h).json()["name"] == "Asel"

    r = client.post("/api/auth/login", {"email": "A@test.kg", "password": "Tooarna-2026!"},
                    content_type="application/json")
    assert r.status_code == 200

    assert client.post("/api/auth/logout", **h).status_code == 204
    assert client.get("/api/auth/me", **h).status_code == 401


def test_duplicate_email(client):
    auth_header(client)
    r = client.post("/api/auth/register", {"email": "a@test.kg", "password": "Tooarna-2026!", "name": "X"},
                    content_type="application/json")
    assert r.status_code == 409


def test_wrong_password(client):
    auth_header(client)
    r = client.post("/api/auth/login", {"email": "a@test.kg", "password": "nope-nope"},
                    content_type="application/json")
    assert r.status_code == 401


# ---- reviews & favorites --------------------------------------------------

def test_review_upsert_and_rating(client):
    h1 = auth_header(client, "a@test.kg")
    h2 = auth_header(client, "b@test.kg")
    url = "/api/trails/sary-chelek/reviews"
    client.post(url, {"rating": 5, "text": "Сонун!"}, content_type="application/json", **h1)
    client.post(url, {"rating": 3}, content_type="application/json", **h2)
    client.post(url, {"rating": 4}, content_type="application/json", **h2)  # update, not duplicate

    reviews = client.get(url, **h1).json()
    assert len(reviews) == 2
    assert sum(r["is_mine"] for r in reviews) == 1

    trail = client.get("/api/trails/sary-chelek").json()
    assert trail["avg_rating"] == 4.5
    assert trail["review_count"] == 2

    top = client.get("/api/trails", {"sort": "rating"}).json()
    assert top[0]["slug"] == "sary-chelek"


def test_review_requires_auth_and_valid_rating(client):
    url = "/api/trails/sary-chelek/reviews"
    assert client.post(url, {"rating": 5}, content_type="application/json").status_code == 401
    h = auth_header(client)
    assert client.post(url, {"rating": 9}, content_type="application/json", **h).status_code == 422


def test_cannot_delete_others_review(client):
    h1 = auth_header(client, "a@test.kg")
    h2 = auth_header(client, "b@test.kg")
    rid = client.post("/api/trails/kel-suu/reviews", {"rating": 5}, content_type="application/json", **h1).json()["id"]
    assert client.delete(f"/api/reviews/{rid}", **h2).status_code == 403
    assert client.delete(f"/api/reviews/{rid}", **h1).status_code == 204


def test_favorite_toggle(client):
    h = auth_header(client)
    assert client.post("/api/trails/kel-suu/favorite", **h).json() == {"favorited": True}
    assert client.get("/api/me/favorite-slugs", **h).json() == ["kel-suu"]
    assert [t["slug"] for t in client.get("/api/me/favorites", **h).json()] == ["kel-suu"]
    assert client.post("/api/trails/kel-suu/favorite", **h).json() == {"favorited": False}
    assert client.get("/api/me/favorites", **h).json() == []


# ---- GPX ------------------------------------------------------------------

def test_gpx_upload_staff_only(client):
    h_user = auth_header(client, "u@test.kg")
    h_staff = auth_header(client, "s@test.kg", staff=True)
    url = "/api/trails/ala-archa-ratsek/gpx"

    with SAMPLE_GPX.open("rb") as f:
        assert client.post(url, {"file": f}, **h_user).status_code == 403
    with SAMPLE_GPX.open("rb") as f:
        r = client.post(url, {"file": f}, **h_staff)
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["has_route"] is True
    assert len(d["route"]) == 5
    assert d["elevation_gain_m"] == 270
    assert d["elevation_profile"][0] == [0.0, 2100.0]


def test_gpx_upload_rejects_bad_file(client):
    h = auth_header(client, "s@test.kg", staff=True)
    from django.core.files.uploadedfile import SimpleUploadedFile

    bad = SimpleUploadedFile("x.gpx", b"<<<nope")
    assert client.post("/api/trails/kel-suu/gpx", {"file": bad}, **h).status_code == 400


# ---- weather & planner (external calls mocked) ----------------------------

def test_weather(client):
    days = [{"date": "2026-07-01", "code": 1, "t_max": 20, "t_min": 5, "precip_mm": 0, "wind_kmh": 10}]
    with mock.patch("trails.routers.trails.forecast", return_value=days):
        r = client.get("/api/trails/kel-suu/weather")
    assert r.status_code == 200
    assert r.json()[0]["t_max"] == 20


def test_planner_disabled_without_key(client, monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    r = client.post("/api/planner", {"prompt": "2 күн Ысык-Көл"}, content_type="application/json")
    assert r.status_code == 503


def test_planner_uses_real_tools(client, monkeypatch):
    """Fake LLM, real tool implementations against the seeded DB."""
    import json as _json

    class Fake:
        def __init__(self):
            self.step = 0

        def complete(self, messages, tools):
            self.step += 1
            if self.step == 1:
                args = _json.dumps({"region": "issyk_kul", "difficulty": ["easy"]})
                return {"content": None, "tool_calls": [
                    {"id": "1", "type": "function", "function": {"name": "search_trails", "arguments": args}}]}
            found = _json.loads(messages[-1]["content"])
            slug = found[0]["slug"]
            return {"content": f"[{found[0]['title']}](/trails/{slug})", "tool_calls": []}

    monkeypatch.setattr("trails.routers.planner.OpenAICompatClient", Fake)
    r = client.post("/api/planner", {"prompt": "жеңил маршрут Ысык-Көл", "lang": "ky"},
                    content_type="application/json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert len(body["trail_slugs"]) == 1
    assert body["tool_calls"][0]["tool"] == "search_trails"


# ---- route builder ----------------------------------------------------------

ROUTE = [[74.60, 42.80], [74.60, 42.81], [74.61, 42.81]]


@pytest.fixture
def fake_elevations():
    def climb(points):
        return [1000.0 + 10.0 * i for i in range(len(points))]

    with mock.patch("trails.services.route_builder.fetch_elevations", side_effect=climb) as m:
        yield m


def test_analyze_route(client, fake_elevations):
    r = client.post("/api/routes/analyze", {"points": ROUTE}, content_type="application/json")
    assert r.status_code == 200, r.content
    d = r.json()
    assert 1.9 < d["distance_km"] < 2.1
    assert d["ascent_m"] > 0 and d["descent_m"] == 0
    assert len(d["path"][0]) == 3 and d["profile"][0][0] == 0


def test_analyze_route_needs_two_points(client):
    r = client.post("/api/routes/analyze", {"points": [[74.6, 42.8]]}, content_type="application/json")
    assert r.status_code == 422


def test_analyze_route_elevation_service_down(client):
    import httpx

    with mock.patch(
        "trails.services.route_builder.fetch_elevations", side_effect=httpx.ConnectError("down")
    ):
        r = client.post("/api/routes/analyze", {"points": ROUTE}, content_type="application/json")
    assert r.status_code == 422


def test_save_list_delete_routes(client, fake_elevations):
    h = auth_header(client)
    r = client.post(
        "/api/me/routes", {"title": "Менин жолум", "points": ROUTE},
        content_type="application/json", **h,
    )
    assert r.status_code == 201, r.content
    rid = r.json()["id"]
    assert r.json()["waypoints"] == ROUTE

    mine = client.get("/api/me/routes", **h).json()
    assert [x["id"] for x in mine] == [rid]

    # someone else can neither see nor delete it
    other = auth_header(client, email="b@test.kg")
    assert client.get("/api/me/routes", **other).json() == []
    assert client.delete(f"/api/me/routes/{rid}", **other).status_code == 404

    assert client.delete(f"/api/me/routes/{rid}", **h).status_code == 204
    assert client.get("/api/me/routes", **h).json() == []


def test_save_route_requires_login(client):
    r = client.post("/api/me/routes", {"title": "x", "points": ROUTE}, content_type="application/json")
    assert r.status_code == 401


def test_analyze_route_following_trails(client, fake_elevations):
    def leg(a, b):
        return [(a[0], a[1], 1500.0), ((a[0] + b[0]) / 2 + 0.003, (a[1] + b[1]) / 2, 1600.0), (b[0], b[1], 1500.0)]

    with mock.patch("trails.services.route_builder.fetch_trail_leg", side_effect=leg):
        r = client.post(
            "/api/routes/analyze", {"points": ROUTE, "follow_trails": True},
            content_type="application/json",
        )
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["follow_trails"] is True and d["straight_legs"] == 0
    assert d["max_elevation_m"] == 1600
    assert fake_elevations.call_count == 0


def test_trail_not_found_falls_back_to_straight(client, fake_elevations):
    from trails.services.route_builder import NoTrail

    with mock.patch("trails.services.route_builder.fetch_trail_leg", side_effect=NoTrail("no")):
        r = client.post(
            "/api/routes/analyze", {"points": ROUTE, "follow_trails": True},
            content_type="application/json",
        )
    assert r.status_code == 200
    assert r.json()["straight_legs"] == 2
