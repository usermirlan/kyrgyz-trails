export const metadata = { title: "Офлайн — Too Arna" };

// Static page, pre-cached by the service worker.
export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="text-5xl">📴</div>
      <h1 className="mt-4 text-2xl font-bold">Интернет жок · Нет сети · Offline</h1>
      <p className="mt-3 text-stone/70">
        Бул барак офлайн сакталган эмес. Маршрутту алдын ала «Офлайн сактоо» баскычы менен сактап алыңыз.
      </p>
      <p className="mt-2 text-sm text-muted">
        This page wasn&apos;t saved for offline use. Use “Save offline” on a trail page before you lose signal.
      </p>
    </main>
  );
}
