import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../lib/hooks.js';
import { initials } from '../lib/format.js';

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const DEFAULT_CENTER = [17.385, 78.4867];

/**
 * points:   [[lat,lng], ...] route to draw
 * position: {lat,lng} current location (blue-ish dot)
 * people:   [{id,name,color,lat,lng,label}] crew markers
 */
export default function RouteMap({ points = [], position, people = [], follow = false, height = 260 }) {
  const { theme } = useApp();
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const fitted = useRef(false);

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_CENTER, 13);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    map.current = m;
    layers.current.route = L.polyline([], { color: '#1D1F1C', weight: 7, opacity: 0.18, lineCap: 'round' }).addTo(m);
    layers.current.routeTop = L.polyline([], { color: theme === 'dark' ? '#DDF25A' : '#6E8F12', weight: 4, lineCap: 'round' }).addTo(m);
    layers.current.people = L.layerGroup().addTo(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (layers.current.tiles) m.removeLayer(layers.current.tiles);
    layers.current.tiles = L.tileLayer(TILES[theme] || TILES.light, { attribution: ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(m);
    layers.current.routeTop.setStyle({ color: theme === 'dark' ? '#DDF25A' : '#6E8F12' });
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.route.setLatLngs(points);
    layers.current.routeTop.setLatLngs(points);
    if (!follow && points.length > 1 && !fitted.current) {
      m.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
      fitted.current = true;
    }
    // points may be the same (mutated) array while recording, so also depend on its length
  }, [points, points.length, follow]);

  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    const ll = [position.lat, position.lng];
    if (!layers.current.me) {
      layers.current.me = L.marker(ll, { icon: L.divIcon({ className: 'me-marker', html: '<span></span>', iconSize: [22, 22] }) }).addTo(m);
      m.setView(ll, 16);
    } else {
      layers.current.me.setLatLng(ll);
      if (follow) m.panTo(ll, { animate: true });
    }
  }, [position, follow]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = layers.current.people;
    g.clearLayers();
    people.forEach((p) => {
      const html = `<span class="pm-dot" style="background:${p.color}">${initials(p.name)}</span><span class="pm-label">${p.label || p.name}</span>`;
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'person-marker', html, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(g);
    });
    if (people.length && !points.length && !position) {
      m.fitBounds(L.latLngBounds(people.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 15 });
    }
  }, [people, points.length, position]);

  return <div ref={el} className="route-map" style={{ height }} />;
}
