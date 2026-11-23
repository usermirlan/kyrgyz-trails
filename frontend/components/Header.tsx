import Link from "next/link";
import { logout } from "@/app/actions";
import { getDict, getLang, getUser } from "@/lib/session";
import LangSwitcher from "./LangSwitcher";

export default async function Header() {
  const [t, lang, user] = await Promise.all([getDict(), getLang(), getUser()]);
  const link = "rounded-lg px-2.5 py-1.5 text-sm hover:bg-stone/5";

  return (
    <header className="sticky top-0 z-20 border-b border-stone/10 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden>⛰️</span> Too Arna
          <span className="hidden text-sm font-normal text-stone/50 md:inline">· {t.tagline}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/planner" className={`${link} font-medium text-sky`}>✨ {t.planner}</Link>
          {user ? (
            <>
              <Link href="/favorites" className={link}>♥ {t.favorites}</Link>
              <form action={logout}>
                <button className={`${link} text-stone/60`} title={user.email}>
                  {user.name} · {t.logout}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={link}>{t.login}</Link>
          )}
          <LangSwitcher current={lang} />
        </nav>
      </div>
    </header>
  );
}
