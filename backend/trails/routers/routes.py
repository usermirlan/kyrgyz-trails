"""Route builder: draw waypoints on the map, get distance/elevation/time, save routes."""

from django.contrib.gis.geos import LineString
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from accounts.auth import token_auth

from ..models import UserRoute
from ..schemas import RouteAnalyzeIn, RouteSaveIn, RouteStats, UserRouteOut
from ..services.route_builder import RouteError, analyze

router = Router(tags=["routes"])

MAX_ROUTES_PER_USER = 50


def _analyze(points: list[list[float]], follow_trails: bool) -> dict:
    if any(len(p) != 2 for p in points):
        raise HttpError(422, "Ар бир чекит [lng, lat] болушу керек")
    try:
        return analyze(points, follow_trails=follow_trails)
    except RouteError as e:
        raise HttpError(422, str(e)) from e


@router.post("/routes/analyze", response=RouteStats)
def analyze_route(request, data: RouteAnalyzeIn):
    """Distance, ascent/descent, walking time and elevation profile for drawn waypoints."""
    return _analyze(data.points, data.follow_trails)


@router.get("/me/routes", response=list[UserRouteOut], auth=token_auth)
def my_routes(request):
    return UserRoute.objects.filter(user=request.auth)


@router.post("/me/routes", response={201: UserRouteOut}, auth=token_auth)
def save_route(request, data: RouteSaveIn):
    if UserRoute.objects.filter(user=request.auth).count() >= MAX_ROUTES_PER_USER:
        raise HttpError(400, f"Эң көп {MAX_ROUTES_PER_USER} маршрут сактаса болот")
    stats = _analyze(data.points, data.follow_trails)
    route = UserRoute.objects.create(
        user=request.auth,
        title=data.title.strip(),
        waypoints=data.points,
        follow_trails=data.follow_trails,
        path=LineString([(p[0], p[1]) for p in stats["path"]], srid=4326),
        distance_km=stats["distance_km"],
        ascent_m=stats["ascent_m"],
        descent_m=stats["descent_m"],
        max_elevation_m=stats["max_elevation_m"],
        duration_h=stats["duration_h"],
        elevation_profile=stats["profile"],
    )
    return 201, route


@router.delete("/me/routes/{route_id}", response={204: None}, auth=token_auth)
def delete_route(request, route_id: int):
    get_object_or_404(UserRoute, id=route_id, user=request.auth).delete()
    return 204, None
