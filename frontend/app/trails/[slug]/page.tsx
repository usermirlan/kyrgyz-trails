import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DrivingDirections from "@/components/DrivingDirections";
import ElevationProfile from "@/components/ElevationProfile";
import FavoriteButton from "@/components/FavoriteButton";
import Reviews from "@/components/Reviews";
import SaveOfflineButton from "@/components/SaveOfflineButton";
import TrailMap from "@/components/TrailMap";
import { DIFFICULTY_STYLE, Rating } from "@/components/TrailCard";
import Weather from "@/components/Weather";
import { ApiError, getFavoriteSlugs, getTrail } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import { getDict, getLang, getToken, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string, lang: string) {
  try {
    return await getTrail(slug, lang);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trail = await load(slug, await getLang());
  return trail ? { title: `${trail.title} — Too Arna`, description: trail.summary } : {};
}

function Skeleton({ h }: { h: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone/5 ${h}`} />;
}

export default async function TrailPage({ params }: Props) {
  const { slug } = await params;
  const [lang, t, token, user] = await Promise.all([getLang(), getDict(), getToken(), getUser()]);
  const trail = await load(slug, lang);
  if (!trail) notFound();

  let isFav = false;
  if (user && token) {
    try {
      isFav = (await getFavoriteSlugs(token)).includes(slug);
    } catch {}
  }

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-8 md:px-8">
      <Link href="/#trails" className="text-sm font-semibold text-sky hover:underline">{t.allTrails}</Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${DIFFICULTY_STYLE[trail.difficulty]}`}>
          {t.difficulty[trail.difficulty]}
        </span>
        <span className="text-sm text-muted">
          {t.regions[trail.region as keyof Dict["regions"]]} {t.region}
        </span>
        <Rating avg={trail.avg_rating} count={trail.review_count} />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-6xl">
          {trail.title}
        </h1>
        <div className="flex gap-2">
          <SaveOfflineButton
            route={trail.route}
            lat={trail.lat}
            lng={trail.lng}
            labels={{ idle: t.saveOffline, saving: t.savingOffline, done: t.savedOffline }}
          />
          {user && <FavoriteButton slug={slug} initial={isFav} labels={{ add: t.favorite, remove: t.unfavorite }} />}
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-lg text-muted">{trail.summary}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t.distance, trail.distance_km, t.km],
          [t.gain, `+${trail.elevation_gain_m}`, t.m],
          [t.maxElevation, trail.max_elevation_m, t.m],
          [t.days, trail.duration_days, t.daysLong],
        ].map(([label, value, unit]) => (
          <div key={String(label)} className="rounded-3xl border border-line bg-panel p-5">
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-1 font-display text-3xl font-semibold">
              {value} <span className="text-base font-normal text-muted">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-line">
        <TrailMap
          points={[{ slug: trail.slug, title: trail.title, lat: trail.lat, lng: trail.lng, difficulty: trail.difficulty }]}
          route={trail.route}
        />
      </div>

      <section className="mt-6 rounded-3xl border border-line bg-panel p-5 md:p-6">
        <h2 className="mb-3 font-display text-xl font-semibold">{t.elevationProfile}</h2>
        {trail.elevation_profile.length > 1 ? (
          <ElevationProfile profile={trail.elevation_profile} labels={{ km: t.km, m: t.m }} />
        ) : (
          <p className="text-sm text-muted">{t.noRoute}</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">{t.weather}</h2>
        <Suspense fallback={<Skeleton h="h-28" />}>
          <Weather slug={slug} t={t} />
        </Suspense>
      </section>

      <DrivingDirections slug={slug} t={t} />

      <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border border-line bg-panel p-5 md:p-6">
          <h2 className="font-display text-xl font-semibold">{t.howToGet}</h2>
          <p className="mt-2 leading-relaxed text-stone/85">{trail.how_to_get_there || t.soon}</p>
          {trail.description && (
            <>
              <h2 className="mt-6 font-display text-xl font-semibold">{t.about}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-stone/85">{trail.description}</p>
            </>
          )}
        </section>

        <aside className="rounded-3xl border border-line bg-panel p-5 md:p-6">
          <h2 className="font-display text-xl font-semibold">{t.season}</h2>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {t.months.map((m, i) => (
              <div
                key={m}
                className={`rounded-lg py-1.5 text-center text-xs ${
                  trail.best_months.includes(i + 1) ? "bg-moss font-semibold text-ink" : "bg-stone/5 text-muted"
                }`}
              >
                {m}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <Suspense fallback={<Skeleton h="h-40" />}>
          <Reviews slug={slug} token={token} loggedIn={!!user} t={t} />
        </Suspense>
      </div>
    </main>
  );
}
