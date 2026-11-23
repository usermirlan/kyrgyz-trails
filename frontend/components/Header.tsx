import Link from "next/link";
import { logout } from "@/app/actions";
import { getDict, getLang, getUser } from "@/lib/session";
import LangSwitcher from "./LangSwitcher";

export default async function Header() {
  const [t, lang, user] = await Promise.all([getDict(), getLang(), getUser()]);
  const link = "rounded-full px-4 py-2 text-[15px] font-semibold text-stone/90 hover:bg-white/10";

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/85">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-8">
        <Link href="/" className="font-display text-lg font-extrabold tracking-[0.08em] text-white">
          TOO·ARNA
        </Link>

        <nav className="flex flex-wrap items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
          <Link href="/#trails" className={link}>{t.navTrails}</Link>
          <Link href="/builder" className={link}>✏️ {t.navBuilder}</Link>
          <Link href="/planner" className={link}>✨ {t.planner}</Link>
          {user && <Link href="/favorites" className={link}>♥ {t.favorites}</Link>}
        </nav>

        <div className="flex items-center gap-2">
          <LangSwitcher current={lang} />
          {user ? (
            <form action={logout}>
              <button
                aria-label={`${t.logout} (${user.email})`}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                {user.name} · {t.logout}
              </button>
            </form>
          ) : (
            <Link href="/login" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
