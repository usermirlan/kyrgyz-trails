// Server-side only: in Docker the backend is reachable as http://backend:8000
const API_URL = process.env.API_URL ?? "http://localhost:8000";

export type Difficulty = "easy" | "moderate" | "hard" | "expert";

export type Trail = {
  slug: string;
  title: string;
  summary: string;
  region: string;
  region_label: string;
  difficulty: Difficulty;
  difficulty_label: string;
  distance_km: number;
  elevation_gain_m: number;
  max_elevation_m: number;
  duration_days: number;
  best_months: number[];
  lat: number;
  lng: number;
  cover_image: string;
  avg_rating: number | null;
  review_count: number;
  has_route: boolean;
  distance_from_you_km: number | null;
};

export type TrailDetail = Trail & {
  description: string;
  how_to_get_there: string;
  route: [number, number][] | null;
  elevation_profile: [number, number][];
};

export type WeatherDay = {
  date: string;
  code: number | null;
  t_max: number | null;
  t_min: number | null;
  precip_mm: number | null;
  wind_kmh: number | null;
};

export type Review = {
  id: number;
  rating: number;
  text: string;
  hiked_on: string | null;
  conditions: string;
  conditions_label: string;
  author: string;
  is_mine: boolean;
  created_at: string;
};

export type User = { id: number; email: string; name: string; is_staff: boolean };
export type Choice = { value: string; label: string };
export type Meta = { regions: Choice[]; difficulties: Choice[] };
export type PlanResult = {
  answer: string;
  trail_slugs: string[];
  tool_calls: { tool: string; args: string | null }[];
};

export type SearchParams = Record<string, string | string[] | undefined>;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Opts = { token?: string; method?: string; body?: unknown; params?: URLSearchParams };

export async function api<T>(path: string, { token, method = "GET", body, params }: Opts = {}): Promise<T> {
  const url = `${API_URL}/api${path}${params?.size ? `?${params}` : ""}`;
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      const d = j.detail;
      if (typeof d === "string") detail = d;
      else if (Array.isArray(d)) {
        // Pydantic validation errors: show the messages, not the raw JSON
        detail = d
          .map((e: { msg?: string; loc?: unknown[] }) => {
            const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : "";
            return field ? `${field}: ${e.msg ?? ""}` : e.msg ?? "";
          })
          .join("; ");
      } else detail = JSON.stringify(d ?? j);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const LIST_PARAMS = ["q", "region", "difficulty", "max_days", "month", "sort"];

export function getTrails(sp: SearchParams, lang: string) {
  const params = new URLSearchParams({ lang });
  for (const key of LIST_PARAMS) {
    const v = sp[key];
    if (Array.isArray(v)) v.forEach((x) => params.append(key, x));
    else if (v) params.set(key, v);
  }
  return api<Trail[]>("/trails", { params });
}

export const getTrail = (slug: string, lang: string) =>
  api<TrailDetail>(`/trails/${encodeURIComponent(slug)}`, { params: new URLSearchParams({ lang }) });

export const getWeather = (slug: string) => api<WeatherDay[]>(`/trails/${encodeURIComponent(slug)}/weather`);

export const getReviews = (slug: string, token?: string) =>
  api<Review[]>(`/trails/${encodeURIComponent(slug)}/reviews`, { token });

export const getMeta = () => api<Meta>("/meta");
export const getMe = (token: string) => api<User>("/auth/me", { token });

export const getFavorites = (token: string, lang: string) =>
  api<Trail[]>("/me/favorites", { token, params: new URLSearchParams({ lang }) });

export const getFavoriteSlugs = (token: string) => api<string[]>("/me/favorite-slugs", { token });
