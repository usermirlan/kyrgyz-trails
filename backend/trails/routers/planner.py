import httpx
from django.core.cache import cache
from ninja import Router, Schema
from ninja.errors import HttpError
from pydantic import Field

from ..models import Locale, Trail
from ..services.planner import OpenAICompatClient, PlannerUnavailable, run_agent
from ..services.weather import forecast
from .trails import TrailFilters, base_queryset, filter_trails, serialize

router = Router(tags=["planner"])

RATE_LIMIT = 15  # requests per IP per hour


class PlanIn(Schema):
    prompt: str = Field(min_length=5, max_length=1000)
    lang: Locale = Locale.RU


class ToolCallOut(Schema):
    tool: str
    args: str | None


class PlanOut(Schema):
    answer: str
    trail_slugs: list[str]
    tool_calls: list[ToolCallOut]


def _client_ip(request) -> str:
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "?")


def _check_rate_limit(request) -> None:
    key = f"plan-rl:{_client_ip(request)}"
    cache.add(key, 0, 3600)
    if cache.incr(key) > RATE_LIMIT:
        raise HttpError(429, "Саатына суроо-талаптардын лимити бүттү. Кийинчерээк аракет кылыңыз.")


def make_tools(lang: str) -> dict:
    """Tool implementations exposed to the agent. Outputs are compact on purpose (tokens)."""

    def search_trails(**kwargs):
        f = TrailFilters(lang=lang, **kwargs)
        return [
            {k: v for k, v in serialize(t, lang).items() if k in {
                "slug", "title", "summary", "region_label", "difficulty", "distance_km",
                "elevation_gain_m", "max_elevation_m", "duration_days", "best_months", "avg_rating",
            }}
            for t in filter_trails(f)[:15]
        ]

    def get_trail_details(slug: str):
        t = base_queryset().filter(slug=slug).first()
        if not t:
            return {"error": f"trail '{slug}' not found"}
        d = serialize(t, lang, detail=True)
        d.pop("route", None)
        d.pop("elevation_profile", None)
        return d

    def get_weather_forecast(slug: str):
        t = Trail.objects.filter(slug=slug).first()
        if not t:
            return {"error": f"trail '{slug}' not found"}
        try:
            return {"slug": slug, "days": forecast(t.start_point.y, t.start_point.x)}
        except httpx.HTTPError:
            return {"error": "weather service unavailable"}

    return {
        "search_trails": search_trails,
        "get_trail_details": get_trail_details,
        "get_weather_forecast": get_weather_forecast,
    }


@router.post("/planner", response=PlanOut)
def plan_trip(request, data: PlanIn):
    _check_rate_limit(request)
    try:
        client = OpenAICompatClient()
    except PlannerUnavailable as e:
        raise HttpError(503, f"AI пландоочу өчүк: {e}")
    try:
        result = run_agent(data.prompt, data.lang, client, make_tools(data.lang))
    except Exception:
        raise HttpError(502, "AI кызматы жооп берген жок. Бир аздан кийин кайра аракет кылыңыз.")
    return {"answer": result.answer, "trail_slugs": result.trail_slugs, "tool_calls": result.tool_calls}
