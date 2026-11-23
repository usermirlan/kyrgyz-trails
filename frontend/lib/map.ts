import type { Map as MLMap } from "maplibre-gl";

// Free vector tiles, no API key: https://openfreemap.org — one style per site theme
const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

export function currentTheme(): "dark" | "light" {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function mapStyle() {
  return STYLES[currentTheme()];
}

/**
 * Keep a map in step with the site theme. `onStyle` adds the map's own sources and
 * layers; it runs for the first style and again after every theme switch, because
 * setStyle() drops everything that was added.
 */
export function followTheme(map: MLMap, onStyle: () => void) {
  map.on("style.load", onStyle);
  const onTheme = () => map.setStyle(mapStyle());
  window.addEventListener("themechange", onTheme);
  map.once("remove", () => window.removeEventListener("themechange", onTheme));
}

/**
 * Start the compact attribution collapsed, so it does not cover map buttons on phones.
 * MapLibre only marks it compact once the sources' attributions arrive, so wait for
 * the first idle (everything loaded) before collapsing.
 */
export function collapseAttribution(map: MLMap) {
  map.once("idle", () => {
    map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  });
}
