import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Too Arna — Кыргызстандын тоо маршруттары",
    short_name: "Too Arna",
    description: "Hiking trails of Kyrgyzstan: maps, weather, offline mode and an AI trip planner.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#3f6b4f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
