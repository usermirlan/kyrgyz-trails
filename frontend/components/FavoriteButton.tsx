"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions";

export default function FavoriteButton({
  slug,
  initial,
  labels,
}: {
  slug: string;
  initial: boolean;
  labels: { add: string; remove: string };
}) {
  const [fav, setFav] = useOptimistic(initial);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setFav(!fav);
          await toggleFavorite(slug);
        })
      }
      aria-pressed={fav}
      title={fav ? labels.remove : labels.add}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        fav ? "border-ember bg-ember/10 text-ember" : "border-stone/15 bg-panel hover:border-ember/50"
      }`}
    >
      {fav ? "♥" : "♡"} <span className="hidden sm:inline">{fav ? labels.remove : labels.add}</span>
    </button>
  );
}
