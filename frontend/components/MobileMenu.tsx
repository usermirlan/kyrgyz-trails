"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Hamburger menu for small screens; the menu content is rendered by the server. */
export default function MobileMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close after navigating
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-lg hover:bg-white/10"
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div
          id="mobile-menu"
          // links inside close the menu (same-page hash links don't change the pathname)
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className="absolute inset-x-0 top-full border-b border-white/10 bg-ink px-6 pb-6 pt-2 shadow-2xl shadow-black/50"
        >
          {children}
        </div>
      )}
    </div>
  );
}
