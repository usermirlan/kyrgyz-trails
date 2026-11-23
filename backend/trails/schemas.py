from datetime import date, datetime

from ninja import Schema
from pydantic import Field


class TrailListItem(Schema):
    slug: str
    title: str
    summary: str
    region: str
    region_label: str
    difficulty: str
    difficulty_label: str
    distance_km: float
    elevation_gain_m: int
    max_elevation_m: int
    duration_days: int
    best_months: list[int]
    lat: float
    lng: float
    cover_image: str
    avg_rating: float | None = None
    review_count: int = 0
    has_route: bool = False
    distance_from_you_km: float | None = None


class TrailDetail(TrailListItem):
    description: str
    how_to_get_there: str
    # [[lng, lat], ...] — GeoJSON order, ready for MapLibre
    route: list[list[float]] | None = None
    # [[km, elevation_m], ...]
    elevation_profile: list[list[float]] = []


class Choice(Schema):
    value: str
    label: str


class Meta(Schema):
    regions: list[Choice]
    difficulties: list[Choice]


class WeatherDay(Schema):
    date: str
    code: int | None
    t_max: float | None
    t_min: float | None
    precip_mm: float | None
    wind_kmh: float | None


class ReviewIn(Schema):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=2000)
    hiked_on: date | None = None
    conditions: str = Field(default="", pattern="^(|dry|mud|snow|ice)$")


class ReviewOut(Schema):
    id: int
    rating: int
    text: str
    hiked_on: date | None
    conditions: str
    conditions_label: str
    author: str
    is_mine: bool
    created_at: datetime


class FavoriteToggleOut(Schema):
    favorited: bool
