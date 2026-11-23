import Link from "next/link";
import { logout } from "@/app/actions";
import { getDict, getLang, getUser } from "@/lib/session";
import LangSwitcher from "./LangSwitcher";
import MobileMenu from "./MobileMenu";

export default async function Header() {
  const [t, lang, user] = await Promise.all([getDict(), getLang(), getUser()]);
  const link = "rounded-full px-4 py-2 text-[15px] font-semibold text-stone/90 hover:bg-white/10";
  const mlink = "block rounded-2xl px-4 py-3 text-lg font-semibold text-stone hover:bg-white/10";

  const links = [
    { href: "/#trails", label: t.navTrails },
    { href: "/builder", label: `✏️ ${t.navBuilder}` },
    { href: "/planner", label: `✨ ${t.planner}` },
    ...(user ? [{ href: "/favorites", label: `♥ ${t.favorites}` }] : []),
  ];

  const account = user ? (
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
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/85">
      <div className="relative mx-auto flex h-[66px] max-w-[1320px] items-center justify-between gap-3 px-6 md:px-8">
        <Link href="/" className="font-display text-lg font-extrabold tracking-[0.08em] text-white">
          TOO·ARNA
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={link}>{l.label}</Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LangSwitcher current={lang} />
          {account}
        </div>

        <MobileMenu label={t.menu}>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={mlink}>{l.label}</Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <LangSwitcher current={lang} />
            {account}
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
