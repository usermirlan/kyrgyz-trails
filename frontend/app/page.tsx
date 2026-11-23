import Link from "next/link";
import { Suspense } from "react";
import Filters from "@/components/Filters";
import TrailCard from "@/components/TrailCard";
import TrailMap from "@/components/TrailMap";
import { getTrails, type SearchParams } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import { getDict, getLang } from "@/lib/session";

export const dynamic = "force-dynamic";

const TICKER = ["Ала-Көл", "Сары-Челек", "Алтын-Арашан", "Соң-Көл", "Көл-Суу", "Жети-Өгүз", "Ала-Арча", "Барскоон"];

function Hero({ t }: { t: Dict }) {
  const field = "flex flex-col gap-1 rounded-2xl bg-ink/50 px-4 py-2.5";
  const select = "bg-transparent text-base font-semibold text-white outline-none [&>option]:bg-ink";
  return (
    <section className="relative isolate -mt-[66px] flex min-h-[860px] flex-col overflow-hidden pt-[66px]">
      <div aria-hidden className="photo-hero absolute inset-0 -z-10" />
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-between gap-12 px-6 pb-14 pt-16 md:px-8">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-bold uppercase tracking-[0.22em] [text-shadow:0_1px_12px_rgba(0,0,0,.45)]">
            {t.heroEyebrow}
          </span>
          <h1 className="font-display text-[56px] font-extrabold leading-[0.9] tracking-[-0.02em] [text-shadow:0_6px_40px_rgba(0,0,0,.35)] sm:text-[96px] lg:text-[168px]">
            {t.heroTitle1}
            <br />
            <span className="text-[34px] font-normal tracking-[0.18em] sm:text-[60px] lg:text-[96px]">{t.heroTitle2}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-8">
          <p className="max-w-md text-lg leading-relaxed text-stone/90">{t.heroLead}</p>
          <form
            action="/#trails"
            method="get"
            className="grid w-full max-w-[720px] gap-2 rounded-3xl border border-white/20 bg-ink/60 p-2.5 shadow-2xl shadow-black/40 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <label className={field}>
              <span className="text-xs font-semibold text-stone/75">{t.where}</span>
              <select name="region" defaultValue="" className={select}>
                <option value="">{t.allRegions}</option>
                {Object.entries(t.regions).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-stone/75">{t.when}</span>
              <select name="month" defaultValue="" className={select}>
                <option value="">{t.anyMonth}</option>
                {t.months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className="text-xs font-semibold text-stone/75">{t.level}</span>
              <select name="difficulty" defaultValue="" className={select}>
                <option value="">{t.anyLevel}</option>
                {Object.entries(t.difficulty).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <button className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-ink">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20 L16.5 16.5" /></svg>
              {t.search}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-line py-5">
      <div className="marquee gap-12 whitespace-nowrap font-display text-2xl font-semibold text-stone/90 md:text-[28px]">
        {items.map((name, i) => (
          <span key={i} className="flex items-center gap-12">
            {name}
            <span className="text-sky">✶</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Bento({ t }: { t: Dict }) {
  const card = "photo-card relative isolate flex flex-col justify-end gap-2 overflow-hidden rounded-[28px] p-6 [&>*]:relative";
  return (
    <section className="mx-auto max-w-[1320px] px-6 pb-12 pt-24 md:px-8">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] md:text-[56px]">{t.bentoTitle}</h2>
        <Link href="#trails" className="rounded-full border border-line px-5 py-3 font-bold hover:bg-white/10">{t.allTrailsLink}</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4 md:grid-rows-[300px_300px]">
        <Link href="/?q=көл#trails" className={`${card} photo-lake min-h-[320px] md:col-span-2 md:row-span-2 md:p-8`}>
          <span className="self-start rounded-full border border-white/35 bg-white/20 px-3 py-1.5 text-[13px] font-bold">4 {t.trailsCount}</span>
          <span className="font-display text-3xl font-semibold leading-none md:text-[44px]">{t.catLakes}</span>
          <span className="text-stone/85">{t.catLakesSub}</span>
        </Link>
        <Link href="/#trails" className={`${card} photo-valley min-h-[240px] md:col-span-2`}>
          <span className="font-display text-2xl font-semibold md:text-[30px]">{t.catGorges}</span>
          <span className="text-[15px] text-stone/85">{t.catGorgesSub}</span>
        </Link>
        <Link href="/?region=naryn#trails" className={`${card} photo-hills min-h-[240px]`}>
          <span className="font-display text-2xl font-semibold">{t.catPastures}</span>
          <span className="text-sm text-stone/85">{t.catPasturesSub}</span>
        </Link>
        <Link href="/?max_days=1#trails" className="flex min-h-[240px] flex-col justify-between rounded-[28px] bg-sky p-6 text-ink">
          <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20 L9 8 L13 14 L16 10 L21 20 Z" /></svg>
          <span className="flex flex-col gap-1.5">
            <span className="font-display text-2xl font-semibold">{t.catDay}</span>
            <span className="text-sm text-[#0b1a2c]">{t.catDaySub}</span>
          </span>
        </Link>
      </div>
    </section>
  );
}

function Numbers({ t }: { t: Dict }) {
  const items: [string, string][] = [["3 900", t.numPass], ["55", t.numLongest], ["7", t.numWeather], ["3", t.numLangs]];
  return (
    <section className="mx-auto max-w-[1320px] px-6 pb-24 pt-8 md:px-8">
      <div className="grid grid-cols-2 gap-6 border-t border-line pt-10 md:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label}>
            <div className="font-display text-5xl font-extrabold md:text-[64px]">{n}</div>
            <div className="text-[15px] text-muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiCta({ t }: { t: Dict }) {
  const tool = "rounded-full border border-white/15 px-2.5 py-1";
  return (
    <section className="mx-auto max-w-[1320px] px-6 pb-6 md:px-8">
      <div className="glow flex flex-wrap items-center gap-12 rounded-[36px] border border-line p-8 md:p-16">
        <div className="flex flex-[1_1_440px] flex-col gap-4">
          <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#8cc4ff]">{t.aiEyebrow}</span>
          <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] md:text-[52px]">
            {t.aiTitle1}
            <br />
            {t.aiTitle2}
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-[#b9c5d4]">{t.aiText}</p>
          <Link href="/planner" className="mt-1 self-start rounded-full bg-white px-6 py-4 font-bold text-ink">{t.aiButton}</Link>
        </div>
        <div className="flex flex-[1_1_400px] flex-col gap-3.5 rounded-3xl border border-line bg-ink p-6">
          <div className="max-w-xs self-end rounded-[20px_20px_6px_20px] bg-sky px-4 py-3.5 text-[15px] font-semibold text-ink">{t.aiDemoQ}</div>
          <div className="flex flex-wrap gap-1.5 text-xs text-muted">
            <span className={tool}>search_trails ✓</span>
            <span className={tool}>get_trail_details ✓</span>
            <span className={tool}>get_weather_forecast ✓</span>
          </div>
          <Link href="/trails/ala-kul-trek" className="flex gap-3.5 rounded-[20px_20px_20px_6px] border border-line bg-panel p-3.5">
            <span className="photo-card photo-lake h-24 w-24 shrink-0 rounded-2xl" />
            <span className="flex flex-col gap-1.5 text-[15px] leading-normal text-[#c9d4e2]">
              <strong className="font-display text-lg font-semibold text-white">Ала-Көл</strong>
              <span>3 {t.daysLong} · 55 {t.km} · ↑ 3 900 {t.m}</span>
              <span className="text-[#8cc4ff]">{t.aiDemoRoute}</span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PreFooter({ t }: { t: Dict }) {
  return (
    <section className="mx-auto max-w-[1320px] px-6 pt-6 md:px-8">
      <div className="photo-cta flex min-h-[320px] flex-wrap items-end justify-between gap-8 rounded-[36px] px-8 py-16 md:px-16 md:py-20">
        <div className="flex max-w-3xl flex-col gap-3.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-stone/90">{t.preEyebrow}</span>
          <h2 className="font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.02em] md:text-[72px]">
            {t.preTitle1}
            <br />
            {t.preTitle2}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="#trails" className="rounded-full bg-white px-7 py-4 font-bold text-ink">{t.findTrail}</Link>
          <Link href="/planner" className="rounded-full border border-white/45 bg-ink/50 px-7 py-4 font-bold">{t.aiButton.replace(" →", "")}</Link>
        </div>
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, lang, t] = await Promise.all([searchParams, getLang(), getDict()]);
  const trails = await getTrails(sp, lang);
  const filtered = Object.values(sp).some((v) => v && v.length);

  return (
    <main>
      <Hero t={t} />
      <Ticker />
      <Bento t={t} />
      <Numbers t={t} />

      <section id="trails" className="mx-auto max-w-[1320px] scroll-mt-24 px-6 pb-24 md:px-8">
        <h2 className="mb-6 font-display text-4xl font-semibold tracking-[-0.02em] md:text-5xl">{t.catalogTitle}</h2>
        <Suspense>
          <Filters t={t} />
        </Suspense>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <TrailMap
              points={trails.map(({ slug, title, lat, lng, difficulty }) => ({ slug, title, lat, lng, difficulty }))}
              className="h-[360px] lg:h-[calc(100vh-8rem)]"
            />
          </div>

          <div>
            <p className="mb-3 text-sm text-muted">
              {trails.length} {t.found}
            </p>
            {trails.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-white/20 p-8">
                <h3 className="font-display text-xl font-semibold">{sp.month ? t.offSeasonTitle : t.nothing}</h3>
                {sp.month && <p className="text-muted">{t.offSeasonText}</p>}
                {filtered && (
                  <Link href="/#trails" className="mt-2 rounded-full bg-white px-5 py-2.5 font-bold text-ink">
                    {t.resetFilters}
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {trails.map((trail) => (
                  <TrailCard key={trail.slug} trail={trail} t={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <AiCta t={t} />
      <PreFooter t={t} />
    </main>
  );
}
