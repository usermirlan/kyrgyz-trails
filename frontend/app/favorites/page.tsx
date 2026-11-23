import { redirect } from "next/navigation";
import TrailCard from "@/components/TrailCard";
import { getFavorites } from "@/lib/api";
import { getDict, getLang, getToken, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const [user, token, lang, t] = await Promise.all([getUser(), getToken(), getLang(), getDict()]);
  if (!user || !token) redirect("/login?next=/favorites");
  const trails = await getFavorites(token, lang);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">♥ {t.favorites}</h1>
      {trails.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone/20 p-10 text-center text-stone/60">{t.noFavorites}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trails.map((trail) => (
            <TrailCard key={trail.slug} trail={trail} t={t} />
          ))}
        </div>
      )}
    </main>
  );
}
