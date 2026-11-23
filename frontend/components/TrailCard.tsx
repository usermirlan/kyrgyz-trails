import Link from "next/link";
import type { Difficulty, Trail } from "@/lib/api";
import type { Dict } from "@/lib/i18n";

export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "bg-moss/10 text-moss",
  moderate: "bg-sky/10 text-sky",
  hard: "bg-ember/10 text-ember",
  expert: "bg-white text-ink",
};

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null) return null;
  return (
    <span className="text-sm text-stone/70" aria-label={`${avg} / 5`}>
      <span className="text-amber-500">★</span> {avg.toFixed(1)} <span className="text-stone/40">({count})</span>
    </span>
  );
}

export default function TrailCard({ trail, t }: { trail: Trail; t: Dict }) {
  return (
    <Link
      href={`/trails/${trail.slug}`}
      className="group flex flex-col gap-3 rounded-3xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-white/25"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[17px] font-semibold leading-snug group-hover:text-sky">{trail.title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[trail.difficulty]}`}>
          {t.difficulty[trail.difficulty]}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-stone/70">{trail.summary}</p>
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-stone/10 pt-3 text-sm">
        <Stat label={t.distance} value={`${trail.distance_km} ${t.km}`} />
        <Stat label={t.maxElevation} value={`${trail.max_elevation_m} ${t.m}`} />
        <Stat label={t.days} value={String(trail.duration_days)} />
      </div>
      <div className="flex items-center justify-between text-xs text-stone/50">
        <span>
          {t.regions[trail.region as keyof Dict["regions"]] ?? trail.region_label} {t.region}
        </span>
        <Rating avg={trail.avg_rating} count={trail.review_count} />
      </div>
    </Link>
  );
}
