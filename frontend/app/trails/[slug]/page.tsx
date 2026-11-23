import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ElevationProfile from "@/components/ElevationProfile";
import FavoriteButton from "@/components/FavoriteButton";
import Reviews from "@/components/Reviews";
import SaveOfflineButton from "@/components/SaveOfflineButton";
import TrailMap from "@/components/TrailMap";
import { DIFFICULTY_STYLE, Rating, Stat } from "@/components/TrailCard";
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-sky hover:underline">{t.allTrails}</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{trail.title}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${DIFFICULTY_STYLE[trail.difficulty]}`}>
            {t.difficulty[trail.difficulty]}
          </span>
          <Rating avg={trail.avg_rating} count={trail.review_count} />
        </div>
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
      <p className="mt-2 text-stone/70">{trail.summary}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-stone/10 bg-panel p-5 sm:grid-cols-4">
        <Stat label={t.distance} value={`${trail.distance_km} ${t.km}`} />
        <Stat label={t.gain} value={`+${trail.elevation_gain_m} ${t.m}`} />
        <Stat label={t.maxElevation} value={`${trail.max_elevation_m} ${t.m}`} />
        <Stat label={t.days} value={`${trail.duration_days} ${t.daysLong}`} />
      </div>

      <div className="mt-6">
        <TrailMap
          points={[{ slug: trail.slug, title: trail.title, lat: trail.lat, lng: trail.lng, difficulty: trail.difficulty }]}
          route={trail.route}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-stone/10 bg-panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{t.elevationProfile}</h2>
        {trail.elevation_profile.length > 1 ? (
          <ElevationProfile profile={trail.elevation_profile} labels={{ km: t.km, m: t.m }} />
        ) : (
          <p className="text-sm text-stone/50">{t.noRoute}</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{t.weather}</h2>
        <Suspense fallback={<Skeleton h="h-28" />}>
          <Weather slug={slug} t={t} />
        </Suspense>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="text-xl font-semibold">{t.howToGet}</h2>
          <p className="mt-2 leading-relaxed text-stone/80">{trail.how_to_get_there || t.soon}</p>
          {trail.description && (
            <>
              <h2 className="mt-6 text-xl font-semibold">{t.about}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-stone/80">{trail.description}</p>
            </>
          )}
        </section>

        <aside>
          <h2 className="text-xl font-semibold">{t.season}</h2>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {t.months.map((m, i) => (
              <div
                key={m}
                className={`rounded-lg py-1.5 text-center text-xs ${
                  trail.best_months.includes(i + 1) ? "bg-moss text-ink" : "bg-stone/5 text-stone/40"
                }`}
              >
                {m}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone/60">
            {t.regions[trail.region as keyof Dict["regions"]]} {t.region}
          </p>
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
