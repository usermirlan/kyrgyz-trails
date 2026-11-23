"use client";

import { useTransition } from "react";
import { setLang } from "@/app/actions";
import { LANGS, type Lang } from "@/lib/i18n";

export default function LangSwitcher({ current }: { current: Lang }) {
  const [pending, start] = useTransition();
  return (
    <div className={`ml-1 flex rounded-lg border border-stone/15 p-0.5 text-xs ${pending ? "opacity-50" : ""}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => start(() => setLang(l))}
          aria-pressed={l === current}
          className={`rounded-md px-2 py-1 uppercase ${l === current ? "bg-stone text-white" : "hover:bg-stone/5"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
