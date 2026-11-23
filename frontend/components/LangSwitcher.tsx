"use client";

import { useTransition } from "react";
import { setLang } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n";

export default function LangSwitcher({ current }: { current: Lang }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      aria-label="Language"
      className={`flex gap-0.5 rounded-full border border-white/20 p-1 text-xs ${pending ? "opacity-50" : ""}`}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => start(() => setLang(l))}
          aria-pressed={l === current}
          className={`rounded-full px-3 py-1.5 font-bold uppercase ${
            l === current ? "bg-white text-ink" : "text-stone/80 hover:bg-white/10"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
