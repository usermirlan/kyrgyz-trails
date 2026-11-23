"""Build GPX tracks for the seeded trails from their waypoints.

Each leg is routed along OpenStreetMap paths with BRouter (the same code as the
route builder), and the result is written to trails/fixtures/gpx/<slug>.gpx.
The files are committed, so seeding and tests never depend on BRouter:

    docker compose exec backend python manage.py build_tracks          # all trails
    docker compose exec backend python manage.py build_tracks kel-suu  # one trail
"""

import json
import time
from pathlib import Path
from xml.sax.saxutils import escape

import httpx
from django.core.management.base import BaseCommand, CommandError

from trails.services.route_builder import NoTrail, RouteError, analyze, fetch_trail_leg

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
GPX_DIR = FIXTURES / "gpx"


def to_gpx(name: str, path: list[list[float]]) -> str:
    pts = "\n".join(
        f'      <trkpt lat="{lat}" lon="{lng}"><ele>{ele}</ele></trkpt>' for lng, lat, ele in path
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<gpx version="1.1" creator="Too Arna build_tracks (BRouter, OpenStreetMap)" '
        'xmlns="http://www.topografix.com/GPX/1/1">\n'
        f"  <trk>\n    <name>{escape(name)}</name>\n    <trkseg>\n{pts}\n    </trkseg>\n  </trk>\n</gpx>\n"
    )


def patient_router(a, b, attempts: int = 4):
    """BRouter leg with retries: a flaky network must not turn a trail into a straight line."""
    for i in range(attempts):
        try:
            return fetch_trail_leg(a, b)
        except NoTrail:
            return None
        except httpx.HTTPError:
            if i == attempts - 1:
                raise
            time.sleep(2 * (i + 1))


class Command(BaseCommand):
    help = "Route each seeded trail's waypoints along OSM paths and save GPX fixtures"

    def add_arguments(self, parser):
        parser.add_argument("slugs", nargs="*", help="Only these trails (default: all)")
        parser.add_argument(
            "--allow-straight",
            action="store_true",
            help="Also write tracks where some legs found no trail and stayed straight",
        )

    def handle(self, *args, slugs, allow_straight=False, **options):
        data = json.loads((FIXTURES / "trails.json").read_text(encoding="utf-8"))
        known = {t["slug"] for t in data}
        if unknown := set(slugs) - known:
            raise CommandError(f"Unknown trails: {', '.join(sorted(unknown))}")
        GPX_DIR.mkdir(exist_ok=True)
        for item in data:
            if slugs and item["slug"] not in slugs:
                continue
            if not item.get("waypoints"):
                self.stdout.write(f"- {item['slug']}: no waypoints, skipped")
                continue
            try:
                r = analyze(item["waypoints"], follow_trails=True, router=patient_router)
            except (RouteError, httpx.HTTPError) as e:
                self.stderr.write(f"! {item['slug']}: {e}")
                continue
            if r["straight_legs"] and not allow_straight:
                self.stderr.write(
                    f"! {item['slug']}: {r['straight_legs']} leg(s) found no trail, not written "
                    "(move the waypoints or pass --allow-straight)"
                )
                continue
            (GPX_DIR / f"{item['slug']}.gpx").write_text(
                to_gpx(item["t"]["en"][0], r["path"]), encoding="utf-8"
            )
            note = f", {r['straight_legs']} straight leg(s)" if r["straight_legs"] else ""
            self.stdout.write(
                f"+ {item['slug']}: {r['distance_km']} km, +{r['ascent_m']} m, "
                f"max {r['max_elevation_m']} m, {len(r['path'])} points{note}"
            )
