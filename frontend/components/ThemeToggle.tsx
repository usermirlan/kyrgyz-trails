"use client";

import { useEffect, useState } from "react";

export const THEME_EVENT = "themechange";

/** Switches between the dark and light theme instantly and remembers the choice in a cookie. */
export default function ThemeToggle({
  initial,
  labels,
}: {
  initial: "dark" | "light";
  labels: { toLight: string; toDark: string };
}) {
  const [theme, setTheme] = useState(initial);
  const next = theme === "dark" ? "light" : "dark";

  // the header renders one toggle for desktop and one for phones: keep them in sync
  useEffect(() => {
    const sync = (e: Event) => setTheme((e as CustomEvent<"dark" | "light">).detail);
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f3f5f8" : "#07090d");
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
    setTheme(next);
  }

  const label = next === "light" ? labels.toLight : labels.toDark;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 text-lg hover:bg-white/10"
    >
      <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}
