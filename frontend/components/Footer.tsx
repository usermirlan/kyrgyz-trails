import Link from "next/link";
import { Suspense } from "react";
import { getTrails, getWeather } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import { getDict, getLang } from "@/lib/session";
import LangSwitcher from "./LangSwitcher";

const WEATHER_SLUG = "ala-archa-ratsek";
const REPO_URL = "https://github.com/usermirlan/kyrgyz-trails";

const heading = "text-xs font-bold uppercase tracking-[0.14em] text-muted/80";
const flink = "text-[15px] text-stone/85 hover:text-white";

async function RegionLinks({ t, lang }: { t: Dict; lang: string }) {
  let counts: [string, number][] = [];
  try {
    const trails = await getTrails({}, lang);
    const by = new Map<string, number>();
    for (const tr of trails) by.set(tr.region, (by.get(tr.region) ?? 0) + 1);
    counts = [...by.entries()].sort((a, b) => b[1] - a[1]);
  } catch {}
  return (
    <>
      {counts.map(([region, n]) => (
        <Link key={region} href={`/?region=${region}#trails`} className={flink}>
          {t.regions[region as keyof Dict["regions"]] ?? region} <span className="text-muted/70">{n}</span>
        </Link>
      ))}
    </>
  );
}

async function WeatherWidget({ t }: { t: Dict }) {
  let days;
  try {
    days = await getWeather(WEATHER_SLUG);
  } catch {
    return <p className="text-sm text-muted">{t.weatherError}</p>;
  }
  const [today, ...rest] = days;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-muted">Ала-Арча · 2 150 {t.m}</span>
          <span className="font-display text-3xl font-semibold">
            {Math.round(today.t_max ?? 0)}°
            <span className="text-lg text-muted"> / {Math.round(today.t_min ?? 0)}°</span>
          </span>
        </div>
        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8cc4ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18Z" />
        </svg>
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center text-xs text-muted">
        {rest.slice(0, 4).map((d) => {
          const date = new Date(`${d.date}T00:00:00`);
          return (
            <span key={d.date} className="rounded-xl bg-white/5 py-2">
              {date.getDate()} {t.months[date.getMonth()]}
              <br />
              <strong className="text-sm text-white">{Math.round(d.t_max ?? 0)}°</strong>
            </span>
          );
        })}
      </div>
      <span className="text-xs text-muted/70">Open-Meteo</span>
    </div>
  );
}

function Social({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-white/10"
    >
      {children}
    </a>
  );
}

export default async function Footer() {
  const [t, lang] = await Promise.all([getDict(), getLang()]);

  return (
    <footer className="mt-24 overflow-hidden border-t border-line pt-16">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-6 md:px-8 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.3fr]">
        <div className="flex flex-col gap-5">
          <Link href="/" className="font-display text-2xl font-extrabold tracking-[0.08em]">TOO·ARNA</Link>
          <p className="max-w-xs text-[15px] leading-relaxed text-muted">{t.footerAbout}</p>
          <div className="self-start"><LangSwitcher current={lang} /></div>
          <div className="flex gap-2.5">
            <Social label="GitHub" href={REPO_URL}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
            </Social>
            <Social label="Instagram" href="https://instagram.com">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="#fff" /></svg>
            </Social>
            <Social label="Telegram" href="https://t.me">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M21 4 L3 11 L10 13.5 L12.5 20.5 L21 4 Z M10 13.5 L21 4" /></svg>
            </Social>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <strong className={heading}>{t.footerRegions}</strong>
          <Suspense fallback={null}><RegionLinks t={t} lang={lang} /></Suspense>
        </div>

        <div className="flex flex-col gap-3.5">
          <strong className={heading}>{t.footerFeatures}</strong>
          <Link href="/planner" className={flink}>{t.planner}</Link>
          <Link href="/#trails" className={flink}>{t.footerMap}</Link>
          <Link href="/offline" className={flink}>{t.footerOffline}</Link>
          <Link href="/favorites" className={flink}>{t.favorites}</Link>
        </div>

        <div className="flex flex-col gap-3.5">
          <strong className={heading}>{t.footerProject}</strong>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={flink}>GitHub</a>
          <a href={`${REPO_URL}#api`} target="_blank" rel="noopener noreferrer" className={flink}>{t.footerApi}</a>
        </div>

        <div className="flex flex-col gap-3.5">
          <strong className={heading}>{t.weather}</strong>
          <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-white/5" />}>
            <WeatherWidget t={t} />
          </Suspense>
        </div>
      </div>

      <div aria-hidden="true" className="text-photo whitespace-nowrap pt-16 text-center font-display text-[17vw] font-extrabold leading-[0.82] tracking-[-0.035em] xl:text-[250px]">
        TOO ARNA
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 py-5 text-[13px] text-muted md:px-8">
          <span>© 2026 Too Arna · {t.footerPortfolio}</span>
          <span>© OpenStreetMap contributors · OpenFreeMap · Open-Meteo · {t.photoCredits}</span>
          <a href="#top" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 font-bold text-white hover:bg-white/10">
            {t.backToTop}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19 V5 M5 12 L12 5 L19 12" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
