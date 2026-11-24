import type { Metadata, Viewport } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorker from "@/components/ServiceWorker";
import { getDict, getLang, getTheme } from "@/lib/session";
// Self-hosted variable fonts with Cyrillic (only the unicode ranges a page uses are fetched)
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/unbounded/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Too Arna — Кыргызстандын тоо маршруттары",
  description: "Кыргызстандагы жөө жүрүш маршруттары: карта, татаалдыгы, аба ырайы жана AI саякат пландоочу.",
  applicationName: "Too Arna",
  appleWebApp: { capable: true, title: "Too Arna", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getTheme()) === "light" ? "#f3f5f8" : "#07090d" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, t, theme] = await Promise.all([getLang(), getDict(), getTheme()]);
  return (
    // the theme is rendered on the server from a cookie, so there is no flash on load
    <html lang={lang} id="top" data-theme={theme}>
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <OfflineBanner text={t.offline} />
        {children}
        <Footer />
        <ServiceWorker />
      </body>
    </html>
  );
}
