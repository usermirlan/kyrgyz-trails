"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap } from "maplibre-gl";

type MapPoint = { slug: string; title: string; lat: number; lng: number; difficulty: string };

const COLORS: Record<string, string> = {
  easy: "#3f6b4f",
  moderate: "#4a7ba6",
  hard: "#c8553d",
  expert: "#2b2d2a",
};

// Free vector tiles, no API key: https://openfreemap.org
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function TrailMap({
  points,
  route,
  className = "h-[420px]",
}: {
  points: MapPoint[];
  route?: [number, number][] | null;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;

      const map = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [75.0, 41.8], // Kyrgyzstan
        zoom: 5.5,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;

      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) {
        const el = document.createElement("a");
        el.href = `/trails/${p.slug}`;
        el.title = p.title;
        el.style.cssText = `display:block;width:16px;height:16px;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${COLORS[p.difficulty] ?? "#333"}`;
        new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(p.title))
          .addTo(map);
        bounds.extend([p.lng, p.lat]);
      }

      map.on("load", () => {
        if (route?.length) {
          map.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            paint: { "line-color": "#c8553d", "line-width": 4 },
          });
          route.forEach((c) => bounds.extend(c));
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 60, maxZoom: points.length === 1 ? 11 : 9, duration: 0 });
        }
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points, route]);

  return <div ref={container} className={`w-full overflow-hidden rounded-2xl ${className}`} />;
}
