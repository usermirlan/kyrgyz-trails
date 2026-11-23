"""7-day forecast from Open-Meteo (free, no API key). Cached for 30 minutes."""

import httpx
from django.core.cache import cache

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 30 * 60


def forecast(lat: float, lng: float, elevation_m: int | None = None) -> list[dict]:
    key = f"wx:{lat:.3f}:{lng:.3f}:{elevation_m}"
    if (cached := cache.get(key)) is not None:
        return cached

    params = {
        "latitude": lat,
        "longitude": lng,
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        "timezone": "Asia/Bishkek",
        "forecast_days": 7,
    }
    if elevation_m is not None:
        # Open-Meteo downscales temperature to this altitude
        params["elevation"] = elevation_m

    r = httpx.get(OPEN_METEO, params=params, timeout=8)
    r.raise_for_status()
    d = r.json()["daily"]
    days = [
        {
            "date": d["time"][i],
            "code": d["weather_code"][i],
            "t_max": d["temperature_2m_max"][i],
            "t_min": d["temperature_2m_min"][i],
            "precip_mm": d["precipitation_sum"][i],
            "wind_kmh": d["wind_speed_10m_max"][i],
        }
        for i in range(len(d["time"]))
    ]
    cache.set(key, days, CACHE_SECONDS)
    return days
