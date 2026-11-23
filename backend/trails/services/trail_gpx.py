from django.contrib.gis.geos import LineString, Point

from ..models import Trail
from .gpx import parse_gpx


def apply_gpx(trail: Trail, content: str | bytes, update_stats: bool = True) -> Trail:
    """Parse a GPX file and store its route, profile and (optionally) stats on the trail."""
    stats = parse_gpx(content)
    trail.route = LineString(stats.coords, srid=4326)
    trail.start_point = Point(*stats.coords[0], srid=4326)
    trail.elevation_profile = stats.profile
    if update_stats:
        trail.distance_km = stats.distance_km
        trail.elevation_gain_m = stats.elevation_gain_m
        if stats.max_elevation_m is not None:
            trail.max_elevation_m = stats.max_elevation_m
    trail.save()
    return trail
