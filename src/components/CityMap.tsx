import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 runs its tile worker from a separate module; after bundling its default URL no longer resolves.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Map as MLMap, StyleSpecification, MapLayerMouseEvent, MapMouseEvent } from 'maplibre-gl';
import type { Unit } from '../lib/data';
import { toFeatureCollection } from '../lib/data';

maplibregl.setWorkerUrl(workerUrl);

export type Basemap = 'light' | 'dark' | 'satellite';

const SAT: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Esri, Maxar, Earthstar Geographics' } },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
};
const styleOf = (b: Basemap) => (b === 'satellite' ? SAT : `https://tiles.openfreemap.org/styles/${b === 'dark' ? 'dark' : 'positron'}`);

interface Props {
  units: Unit[];
  colors: (string | null)[];
  heights?: (number | null)[];
  extrude?: boolean;
  basemap?: Basemap;
  opacity?: number;
  selected?: number | null;
  onHover?: (i: number | null) => void;
  onSelect?: (i: number | null) => void;
  label?: (i: number) => string;
}

export default function CityMap({ units, colors, heights, extrude = false, basemap = 'light', opacity = 0.78, selected = null, onHover, onSelect, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(0);
  const hovered = useRef<number | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const cb = useRef({ onHover, onSelect, label });
  cb.current = { onHover, onSelect, label };

  // create once
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!, style: styleOf(basemap), center: [34.655, 31.8], zoom: 11.6, pitch: 0, bearing: -18,
      attributionControl: { compact: true }, maxBounds: [[34.45, 31.65], [34.85, 31.95]], dragRotate: true,
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.current = m;
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'kr-pop' });
    const onLoad = () => setReady(r => r + 1);
    m.on('style.load', onLoad);
    m.on('mousemove', 'u-fill', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const i = Number(f.id);
      if (hovered.current !== i) {
        if (hovered.current != null) m.setFeatureState({ source: 'units', id: hovered.current }, { hover: false });
        hovered.current = i;
        m.setFeatureState({ source: 'units', id: i }, { hover: true });
        cb.current.onHover?.(i);
      }
      m.getCanvas().style.cursor = 'pointer';
      if (cb.current.label) popup.current!.setLngLat(e.lngLat).setHTML(cb.current.label(i)).addTo(m);
    });
    m.on('mouseleave', 'u-fill', () => {
      if (hovered.current != null) m.setFeatureState({ source: 'units', id: hovered.current }, { hover: false });
      hovered.current = null; cb.current.onHover?.(null); m.getCanvas().style.cursor = ''; popup.current!.remove();
    });
    m.on('click', (e: MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: m.getLayer('u-fill') ? ['u-fill'] : [] })[0];
      cb.current.onSelect?.(f ? Number(f.id) : null);
    });
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // basemap switch keeps our layers: they are re-added on style.load
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) { firstStyle.current = false; return; }
    map.current?.setStyle(styleOf(basemap));
  }, [basemap]);

  // data + layers
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const fc = toFeatureCollection(units, (_, i) => ({ color: colors[i] ?? 'rgba(0,0,0,0)', has: colors[i] ? 1 : 0, h: heights?.[i] ?? 0 }));
    const src = m.getSource('units') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    else {
      m.addSource('units', { type: 'geojson', data: fc });
      const firstSymbol = m.getStyle().layers.find(l => l.type === 'symbol')?.id;
      m.addLayer({ id: 'u-fill', type: 'fill', source: 'units', paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], Math.min(1, opacity + 0.15), ['==', ['get', 'has'], 0], 0.05, opacity],
      } }, firstSymbol);
      m.addLayer({ id: 'u-ext', type: 'fill-extrusion', source: 'units', layout: { visibility: 'none' }, paint: {
        'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['*', ['get', 'h'], 2200], 'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      } });
      m.addLayer({ id: 'u-line', type: 'line', source: 'units', paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#111', ['boolean', ['feature-state', 'sel'], false], '#111', 'rgba(40,46,50,.35)'],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.4, ['boolean', ['feature-state', 'sel'], false], 3, 0.6],
      } });
    }
    m.setPaintProperty('u-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], Math.min(1, opacity + 0.15), ['==', ['get', 'has'], 0], 0.05, opacity]);
  }, [units, colors, heights, ready, opacity]);

  // 3D mode
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer('u-ext')) return;
    m.setLayoutProperty('u-ext', 'visibility', extrude ? 'visible' : 'none');
    m.setLayoutProperty('u-fill', 'visibility', extrude ? 'none' : 'visible');
    m.easeTo({ pitch: extrude ? 58 : 0, bearing: extrude ? -28 : -18, duration: 1200 });
  }, [extrude, ready]);

  // selection
  const prevSel = useRef<number | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getSource('units')) return;
    if (prevSel.current != null) m.setFeatureState({ source: 'units', id: prevSel.current }, { sel: false });
    if (selected != null) m.setFeatureState({ source: 'units', id: selected }, { sel: true });
    prevSel.current = selected;
  }, [selected, ready, units]);

  return <div ref={box} style={{ position: 'absolute', inset: 0 }} data-testid="map" />;
}
