"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { getDirections } from "@/app/actions";
import type { DirectionStep, Directions } from "@/lib/api";
import type { Dict } from "@/lib/i18n";

const STYLE = "https://tiles.openfreemap.org/styles/dark";

type Origin = "bishkek" | "me";

function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m / 10) * 10} m`;
}

function duration(min: number, t: Dict) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} ${t.hoursShort}${m ? ` ${m} ${t.minutesShort}` : ""}` : `${m} ${t.minutesShort}`;
}

const MOD_KEY: Record<string, keyof Dict["dir"]> = {
  left: "left",
  right: "right",
  "slight left": "slightLeft",
  "slight right": "slightRight",
  "sharp left": "sharpLeft",
  "sharp right": "sharpRight",
  straight: "straight",
  uturn: "uturn",
};

function instruction(s: DirectionStep, t: Dict) {
  let verb: string;
  if (s.type === "depart") verb = t.dir.depart;
  else if (s.type === "arrive") return t.dir.arrive;
  else if ((s.type === "roundabout" || s.type === "rotary") && s.exit) verb = t.dir.roundabout.replace("{n}", String(s.exit));
  else verb = t.dir[MOD_KEY[s.modifier] ?? "straight"];
  return s.name ? `${verb} — ${t.dir.onto.replace("{name}", s.name)}` : verb;
}

function arrow(s: DirectionStep) {
  if (s.type === "arrive") return "🏁";
  if (s.type === "depart") return "🚗";
  if (s.type === "roundabout" || s.type === "rotary") return "⟳";
  if (s.modifier.includes("left")) return "↰";
  if (s.modifier.includes("right")) return "↱";
  if (s.modifier === "uturn") return "↶";
  return "↑";
}

export default function DrivingDirections({ slug, t }: { slug: string; t: Dict }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [origin, setOrigin] = useState<Origin>("bishkek");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [data, setData] = useState<Directions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // fetch the route whenever the origin changes
  useEffect(() => {
    if (origin === "me" && !coords) return;
    let stale = false;
    setLoading(true);
    getDirections(slug, origin === "me" ? coords ?? undefined : undefined).then((r) => {
      if (stale) return;
      setLoading(false);
      setError(r.error ?? null);
      if (r.directions) setData(r.directions);
    });
    return () => {
      stale = true;
    };
  }, [slug, origin, coords]);

  // map, created once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      const map = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: [74.6, 42.7],
        zoom: 8,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("drive", { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Routing: OSRM / FOSSGIS" });
        map.addLayer({ id: "drive-casing", type: "line", source: "drive", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#07090d", "line-width": 8 } });
        map.addLayer({ id: "drive", type: "line", source: "drive", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#4c9be8", "line-width": 5 } });
        map.addSource("ends", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "ends",
          type: "circle",
          source: "ends",
          paint: {
            "circle-radius": 8,
            "circle-color": ["match", ["get", "role"], "start", "#e8eef7", "#5fbf8f"],
            "circle-stroke-color": "#07090d",
            "circle-stroke-width": 3,
          },
        });
        setMapReady(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // draw the route
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !data) return;
    (map.getSource("drive") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: data.geometry },
    });
    (map.getSource("ends") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { role: "start" }, geometry: { type: "Point", coordinates: data.origin } },
        { type: "Feature", properties: { role: "end" }, geometry: { type: "Point", coordinates: data.destination } },
      ],
    });
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      const b = new maplibregl.LngLatBounds();
      data.geometry.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 40, duration: 600 });
    })();
  }, [data, mapReady]);

  function locateMe() {
    if (!navigator.geolocation) {
      setError(t.geoDenied);
      return;
    }
    setOrigin("me");
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => {
        setLoading(false);
        setOrigin("bishkek");
        setError(t.geoDenied);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  const [oLng, oLat] = data?.origin ?? [74.6037, 42.8766];
  const [dLng, dLat] = data?.destination ?? [0, 0];
  const links = data && {
    gis: `https://2gis.kg/bishkek/directions/points/${oLng}%2C${oLat}%7C${dLng}%2C${dLat}`,
    google: `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`,
  };
  const tab = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-white text-ink" : "text-muted hover:text-stone"}`;

  return (
    <section className="mt-6 rounded-3xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t.drive}</h2>
        <div role="radiogroup" className="flex gap-1 rounded-full border border-line bg-ink p-1">
          <button type="button" role="radio" aria-checked={origin === "bishkek"} className={tab(origin === "bishkek")} onClick={() => setOrigin("bishkek")}>
            {t.fromBishkek}
          </button>
          <button type="button" role="radio" aria-checked={origin === "me"} className={tab(origin === "me")} onClick={locateMe}>
            {t.fromMe}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div ref={container} className="h-72 overflow-hidden rounded-2xl border border-line md:h-80" />

        <div className="flex flex-col gap-4">
          <div aria-live="polite">
            {loading ? (
              <p className="text-muted">{origin === "me" && !coords ? t.locating : t.analyzing}</p>
            ) : error ? (
              <p className="text-ember">{error}</p>
            ) : data ? (
              <>
                <div className="font-display text-4xl font-semibold">{duration(data.duration_min, t)}</div>
                <div className="mt-1 text-muted">
                  {data.distance_km} {t.km} · {t.byCar}
                </div>
                <p className="mt-2 text-xs text-muted">{t.driveNote}</p>
              </>
            ) : null}
          </div>

          {links && (
            <div className="flex flex-wrap gap-2">
              <a href={links.gis} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#5fbf8f] px-4 py-2.5 text-sm font-bold text-ink hover:opacity-90">
                {t.openIn2gis} ↗
              </a>
              <a href={links.google} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
                {t.openInGoogle} ↗
              </a>
            </div>
          )}

          {data && data.steps.length > 0 && (
            <details className="rounded-2xl border border-line bg-ink p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {t.showSteps} ({data.steps.length})
              </summary>
              <ol className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1 text-sm">
                {data.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="w-5 shrink-0 text-center text-sky">{arrow(s)}</span>
                    <span className="flex-1">{instruction(s, t)}</span>
                    {s.distance_m > 0 && <span className="shrink-0 text-muted">{km(s.distance_m)}</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
