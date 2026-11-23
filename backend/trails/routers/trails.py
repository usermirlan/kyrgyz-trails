import httpx
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Avg, Count, F, IntegerField, OuterRef, Prefetch, QuerySet, Subquery
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from ninja import File, Query, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile

from accounts.auth import token_auth

from ..models import Difficulty, Locale, Region, Review, Trail, TrailTranslation
from ..schemas import Directions, Meta, TrailDetail, TrailListItem, WeatherDay
from ..services import directions as directions_service
from ..services.gpx import GPXError
from ..services.trail_gpx import apply_gpx
from ..services.weather import forecast

router = Router(tags=["trails"])

MAX_GPX_BYTES = 5 * 1024 * 1024


class TrailFilters(Schema):
    lang: Locale = Locale.RU
    q: str | None = None
    region: Region | None = None
    difficulty: list[Difficulty] | None = None
    max_distance_km: float | None = None
    max_days: int | None = None
    month: int | None = None  # 1–12: show trails good for this month
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None  # requires lat & lng
    sort: str | None = None  # "rating" | "distance_km" | None


def base_queryset() -> QuerySet[Trail]:
    # Subqueries (not joins) so text-search joins can't skew the averages.
    reviews = Review.objects.filter(trail=OuterRef("pk")).order_by().values("trail")
    return (
        Trail.objects.filter(is_published=True)
        .prefetch_related(Prefetch("translations", queryset=TrailTranslation.objects.all()))
        .annotate(
            avg_rating=Subquery(reviews.annotate(a=Avg("rating")).values("a")[:1]),
            review_count=Coalesce(
                Subquery(reviews.annotate(c=Count("id")).values("c")[:1], output_field=IntegerField()),
                0,
            ),
        )
    )


def serialize(trail: Trail, lang: str, detail: bool = False) -> dict:
    tr = trail.translation(lang)
    avg = getattr(trail, "avg_rating", None)
    data = {
        "slug": trail.slug,
        "title": tr.title if tr else trail.slug,
        "summary": tr.summary if tr else "",
        "region": trail.region,
        "region_label": trail.get_region_display(),
        "difficulty": trail.difficulty,
        "difficulty_label": trail.get_difficulty_display(),
        "distance_km": float(trail.distance_km),
        "elevation_gain_m": trail.elevation_gain_m,
        "max_elevation_m": trail.max_elevation_m,
        "duration_days": trail.duration_days,
        "best_months": trail.best_months,
        "lat": trail.start_point.y,
        "lng": trail.start_point.x,
        "cover_image": trail.cover_image,
        "avg_rating": round(float(avg), 1) if avg is not None else None,
        "review_count": getattr(trail, "review_count", 0) or 0,
        "has_route": trail.route is not None,
        "distance_from_you_km": (
            round(trail.dist.km, 1) if getattr(trail, "dist", None) is not None else None
        ),
    }
    if detail:
        data["description"] = tr.description if tr else ""
        data["how_to_get_there"] = tr.how_to_get_there if tr else ""
        data["route"] = [list(c) for c in trail.route.coords] if trail.route else None
        data["elevation_profile"] = trail.elevation_profile or []
    return data


def filter_trails(f: TrailFilters) -> QuerySet[Trail]:
    qs = base_queryset()
    if f.q:
        qs = qs.filter(translations__title__icontains=f.q).distinct()
    if f.region:
        qs = qs.filter(region=f.region)
    if f.difficulty:
        qs = qs.filter(difficulty__in=f.difficulty)
    if f.max_distance_km is not None:
        qs = qs.filter(distance_km__lte=f.max_distance_km)
    if f.max_days is not None:
        qs = qs.filter(duration_days__lte=f.max_days)
    if f.month:
        qs = qs.filter(best_months__contains=[f.month])

    if f.lat is not None and f.lng is not None:
        here = Point(f.lng, f.lat, srid=4326)
        qs = qs.annotate(dist=Distance("start_point", here)).order_by("dist")
        if f.radius_km:
            qs = qs.filter(start_point__dwithin=(here, D(km=f.radius_km)))
    elif f.sort == "rating":
        qs = qs.order_by(F("avg_rating").desc(nulls_last=True), "-review_count")
    elif f.sort == "distance_km":
        qs = qs.order_by("distance_km")
    return qs


@router.get("/trails", response=list[TrailListItem])
def list_trails(request, filters: Query[TrailFilters]):
    return [serialize(t, filters.lang) for t in filter_trails(filters)]


@router.get("/trails/{slug}", response=TrailDetail)
def get_trail(request, slug: str, lang: Locale = Locale.RU):
    trail = get_object_or_404(base_queryset(), slug=slug)
    return serialize(trail, lang, detail=True)


@router.get("/trails/{slug}/weather", response=list[WeatherDay])
def trail_weather(request, slug: str):
    trail = get_object_or_404(Trail, slug=slug, is_published=True)
    try:
        return forecast(trail.start_point.y, trail.start_point.x)
    except httpx.HTTPError:
        raise HttpError(502, "Аба ырайы кызматы азыр жеткиликсиз")


@router.get("/trails/{slug}/directions", response=Directions)
def trail_directions(
    request, slug: str, from_lat: float | None = None, from_lng: float | None = None
):
    """Driving route to the trailhead — from Bishkek, or from the given point."""
    trail = get_object_or_404(Trail, slug=slug, is_published=True)
    origin = directions_service.BISHKEK
    if from_lat is not None and from_lng is not None:
        if not (-90 <= from_lat <= 90 and -180 <= from_lng <= 180):
            raise HttpError(422, "Координаталар туура эмес")
        origin = (from_lng, from_lat)
    try:
        return directions_service.directions((trail.start_point.x, trail.start_point.y), origin)
    except directions_service.NoRoute:
        raise HttpError(404, "Бул жерге унаа жолу табылган жок")
    except httpx.HTTPError:
        raise HttpError(502, "Жол көрсөтүү кызматы азыр жеткиликсиз")


@router.post("/trails/{slug}/gpx", response=TrailDetail, auth=token_auth)
def upload_gpx(request, slug: str, file: UploadedFile = File(...), update_stats: bool = True):
    """Staff only: attach a GPX track; distance/elevation are recomputed from it."""
    if not request.auth.is_staff:
        raise HttpError(403, "Админ гана GPX жүктөй алат")
    if file.size > MAX_GPX_BYTES:
        raise HttpError(413, "Файл 5 МБдан ашпашы керек")
    trail = get_object_or_404(Trail, slug=slug)
    try:
        apply_gpx(trail, file.read(), update_stats=update_stats)
    except GPXError as e:
        raise HttpError(400, str(e))
    return serialize(get_object_or_404(base_queryset(), slug=slug), "ru", detail=True)


@router.get("/meta", response=Meta, tags=["meta"])
def meta(request):
    return {
        "regions": [{"value": v, "label": l} for v, l in Region.choices],
        "difficulties": [{"value": v, "label": l} for v, l in Difficulty.choices],
    }
