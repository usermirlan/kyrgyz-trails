import { getWeather } from "@/lib/api";
import type { Dict } from "@/lib/i18n";

// WMO weather codes → emoji (https://open-meteo.com/en/docs)
function icon(code: number | null): string {
  if (code === null) return "·";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77 || code === 85 || code === 86) return "🌨️";
  return "⛈️";
}

export default async function Weather({ slug, t }: { slug: string; t: Dict }) {
  let days;
  try {
    days = await getWeather(slug);
  } catch {
    return <p className="text-sm text-muted">{t.weatherError}</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const date = new Date(`${d.date}T00:00:00`);
        return (
          <div key={d.date} className="rounded-xl bg-panel p-2 text-center text-sm ring-1 ring-stone/10">
            <div className="text-xs text-muted">
              {date.getDate()} {t.months[date.getMonth()]}
            </div>
            <div className="my-1 text-2xl" aria-hidden>{icon(d.code)}</div>
            <div className="font-medium">
              {Math.round(d.t_max ?? 0)}° <span className="text-muted">{Math.round(d.t_min ?? 0)}°</span>
            </div>
            {!!d.precip_mm && d.precip_mm > 0 && <div className="text-xs text-sky">{d.precip_mm} мм</div>}
          </div>
        );
      })}
    </div>
  );
}
