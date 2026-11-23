import type { Map as MLMap } from "maplibre-gl";

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
