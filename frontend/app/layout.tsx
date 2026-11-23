import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorker from "@/components/ServiceWorker";
import { getDict, getLang } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Too Arna — Кыргызстандын тоо маршруттары",
  description: "Кыргызстандагы жөө жүрүш маршруттары: карта, татаалдыгы, аба ырайы жана AI саякат пландоочу.",
  applicationName: "Too Arna",
  appleWebApp: { capable: true, title: "Too Arna", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#3f6b4f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, t] = await Promise.all([getLang(), getDict()]);
  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        <Header />
        <OfflineBanner text={t.offline} />
        {children}
        <footer className="mx-auto mt-16 max-w-7xl px-4 pb-10 text-xs text-stone/40">
          Too Arna · © OpenStreetMap contributors · OpenFreeMap · Open-Meteo
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
