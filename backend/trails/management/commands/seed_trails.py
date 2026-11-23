import json
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand
from django.db import transaction

from trails.models import Trail, TrailTranslation

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "trails.json"


class Command(BaseCommand):
    help = "Load sample Kyrgyz trails. Existing trails are left alone unless --force."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true", help="Overwrite existing trails with fixture values"
        )

    @transaction.atomic
    def handle(self, *args, force=False, **options):
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        for item in data:
            lng, lat = item["start"]
            if not force and Trail.objects.filter(slug=item["slug"]).exists():
                continue  # don't clobber admin edits / GPX-derived stats on restart
            trail, created = Trail.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "region": item["region"],
                    "difficulty": item["difficulty"],
                    "distance_km": item["distance_km"],
                    "elevation_gain_m": item["elevation_gain_m"],
                    "max_elevation_m": item["max_elevation_m"],
                    "duration_days": item["duration_days"],
                    "best_months": item["best_months"],
                    "start_point": Point(lng, lat, srid=4326),
                },
            )
            for locale, (title, summary, how) in item["t"].items():
                TrailTranslation.objects.update_or_create(
                    trail=trail,
                    locale=locale,
                    defaults={"title": title, "summary": summary, "how_to_get_there": how},
                )
            self.stdout.write(f"{'+' if created else '~'} {trail.slug}")
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(data)} trails"))
