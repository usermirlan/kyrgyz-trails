"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import type { Dict } from "@/lib/i18n";

export default function Filters({ t }: { t: Dict }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function update(key: string, value: string | string[] | null) {
    const next = new URLSearchParams(sp.toString());
    next.delete(key);
    if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
    else if (value) next.set(key, value);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  const selectedDifficulty = sp.getAll("difficulty");
  const toggleDifficulty = (v: string) =>
    update(
      "difficulty",
      selectedDifficulty.includes(v) ? selectedDifficulty.filter((d) => d !== v) : [...selectedDifficulty, v],
    );

  const field = "rounded-xl border border-stone/15 bg-panel px-3 py-2 text-sm outline-none focus:border-sky";

  return (
    <div className={`flex flex-wrap items-center gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        type="search"
        placeholder={t.searchPlaceholder}
        defaultValue={sp.get("q") ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => update("q", v || null), 300);
        }}
        aria-label={t.searchPlaceholder}
        className={`${field} w-56`}
      />

      <select aria-label={t.where} value={sp.get("region") ?? ""} onChange={(e) => update("region", e.target.value || null)} className={field}>
        <option value="">{t.allRegions}</option>
        {Object.entries(t.regions).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>

      <select aria-label={t.when} value={sp.get("month") ?? ""} onChange={(e) => update("month", e.target.value || null)} className={field}>
        <option value="">{t.anyMonth}</option>
        {t.months.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>

      <select aria-label={t.duration} value={sp.get("max_days") ?? ""} onChange={(e) => update("max_days", e.target.value || null)} className={field}>
        <option value="">{t.duration}</option>
        <option value="1">{t.day1}</option>
        <option value="2">{t.upTo2}</option>
        <option value="3">{t.upTo3}</option>
      </select>

      <select aria-label={t.sortDefault} value={sp.get("sort") ?? ""} onChange={(e) => update("sort", e.target.value || null)} className={field}>
        <option value="">{t.sortDefault}</option>
        <option value="rating">{t.sortRating}</option>
        <option value="distance_km">{t.sortShort}</option>
      </select>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(t.difficulty).map(([v, label]) => {
          const on = selectedDifficulty.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggleDifficulty(v)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                on ? "border-white bg-white text-ink" : "border-stone/15 bg-panel hover:border-stone/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
