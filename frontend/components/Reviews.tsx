import Link from "next/link";
import { deleteReview } from "@/app/actions";
import { getReviews } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import ReviewForm from "./ReviewForm";

export default async function Reviews({
  slug,
  token,
  loggedIn,
  t,
}: {
  slug: string;
  token?: string;
  loggedIn: boolean;
  t: Dict;
}) {
  let reviews: Awaited<ReturnType<typeof getReviews>> = [];
  try {
    reviews = await getReviews(slug, token);
  } catch {}
  const mine = reviews.some((r) => r.is_mine);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t.reviews} <span className="text-stone/40">({reviews.length})</span>
      </h2>

      {loggedIn ? (
        !mine && <ReviewForm slug={slug} t={t} />
      ) : (
        <Link href={`/login?next=/trails/${slug}`} className="inline-block text-sm text-sky hover:underline">
          {t.loginToReview} →
        </Link>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-stone/50">{t.noReviews}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-stone/10 bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.author}</span>
                  <span className="text-amber-500" aria-label={`${r.rating}/5`}>
                    {"★".repeat(r.rating)}
                    <span className="text-stone/15">{"★".repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone/50">
                  {r.conditions && <span className="rounded-full bg-stone/5 px-2 py-0.5">{t.cond[r.conditions as keyof Dict["cond"]]}</span>}
                  {r.hiked_on && <span>{r.hiked_on}</span>}
                  {r.is_mine && (
                    <form action={deleteReview.bind(null, slug, r.id)}>
                      <button className="text-ember hover:underline">{t.delete}</button>
                    </form>
                  )}
                </div>
              </div>
              {r.text && <p className="mt-2 whitespace-pre-line text-sm text-stone/80">{r.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
