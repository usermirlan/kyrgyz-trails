import { Suspense } from "react";
import Filters from "@/components/Filters";
import TrailCard from "@/components/TrailCard";
import TrailMap from "@/components/TrailMap";
import { getTrails, type SearchParams } from "@/lib/api";
import { getDict, getLang } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, lang, t] = await Promise.all([searchParams, getLang(), getDict()]);
  const trails = await getTrails(sp, lang);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t.heroTitle}</h1>
        <p className="mt-2 max-w-2xl text-stone/70">{t.heroText}</p>
      </section>

      <Suspense>
        <Filters t={t} />
      </Suspense>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <TrailMap
            points={trails.map(({ slug, title, lat, lng, difficulty }) => ({ slug, title, lat, lng, difficulty }))}
            className="h-[360px] lg:h-[calc(100vh-7rem)]"
          />
        </div>

        <div>
          <p className="mb-3 text-sm text-stone/60">
            {trails.length} {t.found}
          </p>
          {trails.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone/20 p-10 text-center text-stone/60">{t.nothing}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {trails.map((trail) => (
                <TrailCard key={trail.slug} trail={trail} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
