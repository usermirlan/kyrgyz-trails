from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from trails.models import Trail
from trails.services.gpx import GPXError
from trails.services.trail_gpx import apply_gpx


class Command(BaseCommand):
    help = "Attach a GPX track to a trail: manage.py import_gpx <slug> <file.gpx>"

    def add_arguments(self, parser):
        parser.add_argument("slug")
        parser.add_argument("path", type=Path)
        parser.add_argument(
            "--keep-stats", action="store_true", help="Don't overwrite distance/elevation"
        )

    def handle(self, slug, path, keep_stats, **options):
        try:
            trail = Trail.objects.get(slug=slug)
        except Trail.DoesNotExist:
            raise CommandError(f"Trail '{slug}' not found")
        try:
            apply_gpx(trail, path.read_bytes(), update_stats=not keep_stats)
        except (OSError, GPXError) as e:
            raise CommandError(str(e))
        self.stdout.write(
            self.style.SUCCESS(
                f"{slug}: {trail.distance_km} km, +{trail.elevation_gain_m} m, max {trail.max_elevation_m} m, "
                f"{len(trail.elevation_profile)} profile points"
            )
        )
