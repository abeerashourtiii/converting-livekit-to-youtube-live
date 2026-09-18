// Loads Leaflet 1.9.4 from a CDN directly in the browser DOM for the web
// build (RULE: OSM/Leaflet only, no Google Maps key — same as the native
// WebView pages in lib/leafletHtml.ts). This file has a ".web.ts" suffix
// so Metro never bundles it into the native app, matching the project's
// "web-only code lives only in .web files" rule; it isn't imported from
// any shared or .native file.
//
// Leaflet has no bundled npm/types package here, so this declares just
// the small slice of its API this app actually calls — enough to avoid
// reaching for `any` anywhere a Leaflet object is used.

export type LatLngLiteral = { lat: number; lng: number };

// A layer's addTo() target is either the map itself or a LayerGroup
// (Leaflet allows adding to either) — see PropertiesMapView.web.tsx, which
// adds circle markers to a LayerGroup rather than the map directly so they
// can all be cleared together on refresh.
export type LeafletLayerTarget = LeafletMap | LeafletLayerGroup;

export interface LeafletLayer {
  // `this` (not the base LeafletLayer) so calling .addTo() on a marker,
  // circle, etc. keeps its specific type — otherwise every subtype's own
  // methods (setLatLng, on, clearLayers, ...) disappear after chaining.
  addTo(target: LeafletLayerTarget): this;
  remove(): void;
}

export interface LeafletMarker extends LeafletLayer {
  setLatLng(latlng: LatLngLiteral | [number, number]): this;
  getLatLng(): LatLngLiteral;
  on(event: "dragend" | "click", handler: (e: { target: LeafletMarker }) => void): this;
}

export interface LeafletCircle extends LeafletLayer {
  setLatLng(latlng: LatLngLiteral | [number, number]): this;
  setRadius(radius: number): this;
}

export interface LeafletCircleMarker extends LeafletLayer {
  on(event: "click", handler: () => void): this;
}

export interface LeafletPolygon extends LeafletLayer {}

export interface LeafletLayerGroup extends LeafletLayer {
  clearLayers(): this;
}

export interface LeafletLatLngBounds {
  getNorth(): number;
  getSouth(): number;
  getEast(): number;
  getWest(): number;
}

export interface LeafletMouseEvent {
  latlng: LatLngLiteral;
}

export interface LeafletMap {
  setView(center: [number, number], zoom: number): this;
  getCenter(): LatLngLiteral;
  getZoom(): number;
  getBounds(): LeafletLatLngBounds;
  invalidateSize(): void;
  remove(): void;
  on(event: "click", handler: (e: LeafletMouseEvent) => void): this;
  on(event: "moveend", handler: () => void): this;
}

export interface LeafletStatic {
  map(element: HTMLElement, options?: { zoomControl?: boolean; attributionControl?: boolean }): LeafletMap;
  tileLayer(urlTemplate: string, options?: { maxZoom?: number; attribution?: string }): LeafletLayer;
  marker(latlng: [number, number], options?: { draggable?: boolean }): LeafletMarker;
  circle(latlng: [number, number], options?: { radius: number; color?: string; fillColor?: string; fillOpacity?: number; weight?: number }): LeafletCircle;
  circleMarker(latlng: [number, number], options?: { radius?: number; color?: string; weight?: number; fillColor?: string; fillOpacity?: number }): LeafletCircleMarker;
  polygon(points: [number, number][], options?: { color?: string; fillColor?: string; fillOpacity?: number; weight?: number }): LeafletPolygon;
  layerGroup(): LeafletLayerGroup;
}

type WindowWithLeaflet = Window & { L?: LeafletStatic };

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let loadPromise: Promise<LeafletStatic> | null = null;

export function loadLeaflet(): Promise<LeafletStatic> {
  const win = window as WindowWithLeaflet;

  if (win.L) {
    return Promise.resolve(win.L);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<LeafletStatic>((resolve, reject) => {
    if (!document.querySelector(`link[data-leaflet-css]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      link.setAttribute("data-leaflet-css", "true");
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[data-leaflet-js]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        const loaded = (window as WindowWithLeaflet).L;
        if (loaded) resolve(loaded);
        else reject(new Error("Leaflet failed to initialize"));
      });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet script")));
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.setAttribute("data-leaflet-js", "true");
    script.onload = () => {
      const loaded = (window as WindowWithLeaflet).L;
      if (loaded) resolve(loaded);
      else reject(new Error("Leaflet failed to initialize"));
    };
    script.onerror = () => reject(new Error("Failed to load Leaflet script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
