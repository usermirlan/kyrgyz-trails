"use client";

import { useActionState, useState } from "react";
import { submitReview, type FormState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";

export default function ReviewForm({ slug, t }: { slug: string; t: Dict }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(0);
  const field = "w-full rounded-xl border border-stone/15 bg-panel px-3 py-2 text-sm outline-none focus:border-sky";

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-stone/10 bg-panel p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">{t.yourReview}:</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n}/5`}
            className={`text-2xl leading-none transition ${n <= rating ? "text-amber-500" : "text-stone/20 hover:text-amber-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea name="text" rows={3} maxLength={2000} placeholder={t.reviewText} className={field} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          {t.hikedOn}
          <input type="date" name="hiked_on" className={`${field} mt-1`} />
        </label>
        <label className="text-sm text-muted">
          {t.conditions}
          <select name="conditions" className={`${field} mt-1`} defaultValue="">
            {Object.entries(t.cond).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p className="text-sm text-ember">{state.error}</p>}
      <button
        disabled={pending || rating === 0}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
      >
        {t.submit}
      </button>
    </form>
  );
}
