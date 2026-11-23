"use client";

import { useEffect, useState } from "react";

type Props = {
  route: [number, number][] | null;
  lat: number;
  lng: number;
  labels: { idle: string; saving: string; done: string };
};

const PAD = 0.03; // ~3 km around the track

function bbox({ route, lat, lng }: Props): [number, number, number, number] {
  const pts = route?.length ? route : [[lng, lat] as [number, number]];
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const extra = route?.length ? PAD : 0.08;
  return [Math.min(...lngs) - extra, Math.min(...lats) - extra, Math.max(...lngs) + extra, Math.max(...lats) + extra];
}

const storageKey = (path: string) => `offline:${path}`;

export default function SaveOfflineButton(props: Props) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "unsupported">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return setState("unsupported");
    try {
      if (localStorage.getItem(storageKey(location.pathname))) setState("done");
    } catch {}
  }, []);

  async function save() {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    setState("saving");
    const channel = new MessageChannel();
    const reply = new Promise<{ ok: boolean }>((resolve) => {
      channel.port1.onmessage = (e) => resolve(e.data);
    });
    reg.active.postMessage({ type: "save-trail", pageUrl: location.pathname, bbox: bbox(props) }, [channel.port2]);
    const r = await reply;
    if (r.ok) {
      try {
        localStorage.setItem(storageKey(location.pathname), String(Date.now()));
      } catch {}
      setState("done");
    } else {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  return (
    <button
      type="button"
      onClick={save}
      disabled={state !== "idle"}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        state === "done" ? "border-moss bg-moss/10 text-moss" : "border-stone/15 bg-white hover:border-moss/50"
      }`}
    >
      {state === "done" ? props.labels.done : state === "saving" ? props.labels.saving : `⬇ ${props.labels.idle}`}
    </button>
  );
}
