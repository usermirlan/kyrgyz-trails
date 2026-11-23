import type { Metadata } from "next";
import RouteBuilder from "@/components/RouteBuilder";
import { getMyRoutes, type UserRoute } from "@/lib/api";
import { getDict, getToken, getUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Route builder — Too Arna" };

export default async function BuilderPage() {
  const [t, user, token] = await Promise.all([getDict(), getUser(), getToken()]);
  let routes: UserRoute[] = [];
  if (user && token) {
    try {
      routes = await getMyRoutes(token);
    } catch {}
  }

  return (
    <main className="mx-auto max-w-[1480px] px-6 py-8 md:px-8">
      <div className="mb-6 flex flex-col gap-2">
        <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#8cc4ff]">{t.builderEyebrow}</span>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] md:text-5xl">{t.builderTitle}</h1>
        <p className="max-w-2xl text-lg text-muted">{t.builderLead}</p>
      </div>
      <RouteBuilder t={t} loggedIn={!!user} routes={routes} />
    </main>
  );
}
