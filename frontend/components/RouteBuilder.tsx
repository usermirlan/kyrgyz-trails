"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import Link from "next/link";
import { analyzeRoute, deleteRoute, saveRoute } from "@/app/actions";
import ElevationProfile from "@/components/ElevationProfile";
import type { LngLat, RouteStats, UserRoute } from "@/lib/api";
import type { Dict } from "@/lib/i18n";

const STYLE = "https://tiles.openfreemap.org/styles/dark";
const START: LngLat = [74.5, 42.6]; // Bishkek and the Ala-Archa gorge
// Free terrain tiles (AWS Open Data, Terrarium encoding, no key) for hillshading
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

type FC = GeoJSON.FeatureCollection;

function pointsFC(points: LngLat[]): FC {
  return {
    type: "FeatureCollection",
    features: points.map((c, i) => ({
      type: "Feature",
      properties: { role: i === 0 ? "start" : i === points.length - 1 ? "end" : "mid" },
      geometry: { type: "Point", coordinates: c },
    })),
  };
}

function lineFC(points: LngLat[]): FC {
  return {
    type: "FeatureCollection",
    features:
      points.length > 1
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } }]
        : [],
  };
}

function formatDuration(h: number, t: Dict) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return hh ? `${hh} ${t.hoursShort} ${mm ? `${mm} ${t.minutesShort}` : ""}`.trim() : `${mm} ${t.minutesShort}`;
}

function toGpx(name: string, path: RouteStats["path"]) {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const pts = path.map(([lng, lat, ele]) => `      <trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Too Arna" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export default function RouteBuilder({
  t,
  loggedIn,
  routes,
}: {
  t: Dict;
  loggedIn: boolean;
  routes: UserRoute[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [points, setPoints] = useState<LngLat[]>([]);
  const [stats, setStats] = useState<RouteStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [ready, setReady] = useState(false);
  const [followTrails, setFollowTrails] = useState(true);

  // Map: created once; clicks append a waypoint
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !container.current) return;
      const map = new maplibregl.Map({ container: container.current, style: STYLE, center: START, zoom: 10 });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.getCanvas().style.cursor = "crosshair";
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("dem", {
          type: "raster-dem",
          tiles: [DEM_TILES],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
          attribution: "Terrain: Mapzen / AWS Open Data",
        });
        // under the first symbol layer so place names stay readable
        const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
        map.addLayer(
          {
            id: "hillshade",
            type: "hillshade",
            source: "dem",
            paint: {
              "hillshade-exaggeration": 0.6,
              "hillshade-shadow-color": "#000000",
              "hillshade-highlight-color": "#5b6b80",
              "hillshade-accent-color": "#1c2230",
            },
          },
          firstSymbol,
        );
        map.addSource("preview", { type: "geojson", data: lineFC([]) });
        map.addSource("line", { type: "geojson", data: lineFC([]), attribution: "Routing: BRouter" });
        map.addLayer({
          id: "preview",
          type: "line",
          source: "preview",
          paint: { "line-color": "#e8eef7", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [2, 2] },
        });
        map.addSource("pts", { type: "geojson", data: pointsFC([]) });
        map.addLayer({
          id: "line-casing",
          type: "line",
          source: "line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#07090d", "line-width": 7 },
        });
        map.addLayer({
          id: "line",
          type: "line",
          source: "line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#f08a5d", "line-width": 4 },
        });
        map.addLayer({
          id: "pts",
          type: "circle",
          source: "pts",
          paint: {
            "circle-radius": ["match", ["get", "role"], "mid", 5, 8],
            "circle-color": ["match", ["get", "role"], "start", "#5fbf8f", "end", "#f08a5d", "#e8eef7"],
            "circle-stroke-color": "#07090d",
            "circle-stroke-width": 2,
          },
        });
        setReady(true);
      });
      map.on("click", (e) => {
        setPoints((p) => (p.length >= 300 ? p : [...p, [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]]));
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw + recalculate (debounced) whenever the waypoints change
  useEffect(() => {
    const map = mapRef.current;
    const src = (id: string) => (ready ? (map?.getSource(id) as GeoJSONSource | undefined) : undefined);
    src("pts")?.setData(pointsFC(points));
    // dashed straight preview while the real path is being calculated
    src("preview")?.setData(lineFC(points));
    setSaveMsg(null);
    if (points.length < 2) {
      src("line")?.setData(lineFC([]));
      setStats(null);
      setError(null);
      return;
    }
    let stale = false;
    setLoading(true);
    const id = setTimeout(async () => {
      const r = await analyzeRoute(points, followTrails);
      if (stale) return;
      setLoading(false);
      setError(r.error ?? null);
      if (r.stats) {
        setStats(r.stats);
        src("line")?.setData(lineFC(r.stats.path.map(([lng, lat]) => [lng, lat] as LngLat)));
        src("preview")?.setData(lineFC([]));
      }
    }, 450);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [points, ready, followTrails]);

  // Ctrl/Cmd+Z removes the last point
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && tag !== "INPUT") {
        e.preventDefault();
        setPoints((p) => p.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openRoute(r: UserRoute) {
    setPoints(r.waypoints);
    setTitle(r.title);
    setFollowTrails(r.follow_trails);
    const map = mapRef.current;
    if (!map) return;
    const maplibregl = (await import("maplibre-gl")).default;
    const b = new maplibregl.LngLatBounds();
    r.waypoints.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: 80, maxZoom: 14 });
    container.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function download() {
    if (!stats) return;
    const name = title.trim() || "too-arna-route";
    const blob = new Blob([toGpx(name, stats.path)], { type: "application/gpx+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}.gpx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function save() {
    const name = title.trim();
    if (!name || points.length < 2) return;
    startSave(async () => {
      const r = await saveRoute(name, points, followTrails);
      setSaveMsg(r.error ?? t.savedOk);
    });
  }

  const stat = "rounded-2xl border border-line bg-ink p-4";
  const btn = "rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="relative">
        <div ref={container} className="h-[480px] w-full overflow-hidden rounded-3xl border border-line lg:h-[calc(100vh-9rem)]" />
        {points.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-ink/85 px-4 py-2 text-sm font-semibold">
            👆 {t.builderHint}
          </div>
        )}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length} className={`${btn} bg-ink/85`}>
            ↶ {t.undo}
          </button>
          <button
            type="button"
            onClick={() => {
              setPoints([]);
              setTitle("");
            }}
            disabled={!points.length}
            className={`${btn} bg-ink/85`}
          >
            {t.clearRoute}
          </button>
          <span className="self-center rounded-full bg-ink/85 px-3 py-2 text-sm text-muted">
            {points.length} {t.points}
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div role="radiogroup" aria-label={t.followTrailsHint} className="mb-2 grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={followTrails === v}
                onClick={() => setFollowTrails(v)}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${followTrails === v ? "bg-white text-ink" : "text-muted hover:text-stone"}`}
              >
                {v ? t.followTrails : t.straightLine}
              </button>
            ))}
          </div>
          <p className="mb-4 text-xs text-muted">{followTrails ? t.followTrailsHint : "\u00a0"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className={stat}>
              <div className="text-xs text-muted">{t.distance}</div>
              <div className="font-display text-2xl font-semibold">{stats ? stats.distance_km.toFixed(1) : "—"} <span className="text-sm text-muted">{t.km}</span></div>
            </div>
            <div className={stat}>
              <div className="text-xs text-muted">{t.maxElev}</div>
              <div className="font-display text-2xl font-semibold">{stats ? stats.max_elevation_m : "—"} <span className="text-sm text-muted">{t.m}</span></div>
            </div>
            <div className={stat}>
              <div className="text-xs text-muted">{t.ascent}</div>
              <div className="font-display text-2xl font-semibold text-moss">↑ {stats ? stats.ascent_m : "—"} <span className="text-sm text-muted">{t.m}</span></div>
            </div>
            <div className={stat}>
              <div className="text-xs text-muted">{t.descent}</div>
              <div className="font-display text-2xl font-semibold text-ember">↓ {stats ? stats.descent_m : "—"} <span className="text-sm text-muted">{t.m}</span></div>
            </div>
            <div className={`${stat} col-span-2`}>
              <div className="text-xs text-muted">{t.timeEst}</div>
              <div className="font-display text-2xl font-semibold">{stats ? formatDuration(stats.duration_h, t) : "—"}</div>
              <div className="mt-1 text-xs text-muted">{t.timeNote}</div>
            </div>
          </div>

          <div className="mt-4 min-h-6 text-sm" aria-live="polite">
            {loading ? (
              <span className="text-muted">{t.analyzing}</span>
            ) : error ? (
              <span className="text-ember">{error}</span>
            ) : stats && stats.straight_legs > 0 ? (
              <span className="text-[#f0c35d]">⚠ {stats.straight_legs} {t.straightLegs}</span>
            ) : null}
          </div>
          {stats && <ElevationProfile profile={stats.profile} labels={{ km: t.km, m: t.m }} />}

          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t.routeName}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={t.routeNamePh}
                className="rounded-xl border border-line bg-ink px-3 py-2.5 outline-none focus:border-sky"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {loggedIn ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={!stats || !title.trim() || saving}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-40"
                >
                  {saving ? "…" : t.saveRoute}
                </button>
              ) : (
                <Link href="/login?next=/builder" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink">
                  {t.loginToSave}
                </Link>
              )}
              <button type="button" onClick={download} disabled={!stats} className={btn}>
                ⬇ {t.downloadGpx}
              </button>
            </div>
            {saveMsg && <p className="text-sm text-moss" role="status">{saveMsg}</p>}
          </div>
        </div>

        {loggedIn && (
          <div className="rounded-3xl border border-line bg-panel p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">{t.myRoutes}</h2>
            {routes.length === 0 ? (
              <p className="text-sm text-muted">{t.noRoutes}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {routes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.title}</div>
                      <div className="text-xs text-muted">
                        {Number(r.distance_km).toFixed(1)} {t.km} · ↑ {r.ascent_m} {t.m} · {formatDuration(r.duration_h, t)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => openRoute(r)} className={btn}>{t.open}</button>
                      <button
                        type="button"
                        onClick={() => deleteRoute(r.id)}
                        aria-label={`${t.remove}: ${r.title}`}
                        className="rounded-full px-3 py-2 text-sm text-muted hover:bg-white/10 hover:text-ember"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
