// GPS recording with jitter filtering and elevation smoothing.

export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function simplify(points, max = 600) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

const MAX_ACCURACY_M = 35;     // ignore fixes worse than this
const MAX_SPEED_MS = 12;       // ~43 km/h: anything faster is a GPS jump
const CLIMB_STEP_M = 4;        // hysteresis so altitude noise isn't counted as climbing

export class GpsTracker {
  constructor(onChange) {
    this.onChange = onChange;
    this.reset();
  }

  reset() {
    this.status = 'idle'; // idle | tracking | paused
    this.points = [];
    this.distance = 0;
    this.gain = 0;
    this.last = null;
    this.altSmooth = null;
    this.altBase = null;
    this.altSeen = false;
    this.activeMs = 0;
    this.segStart = null;
    this.startedAt = null;
    this.watchId = null;
    this.accuracy = null;
    this.position = null;
    this.error = null;
  }

  get elapsed() {
    return (this.activeMs + (this.segStart ? Date.now() - this.segStart : 0)) / 1000;
  }

  snapshot() {
    return {
      status: this.status,
      points: this.points,
      distance_m: this.distance,
      elevation_gain_m: this.gain,
      elapsed_s: this.elapsed,
      accuracy: this.accuracy,
      position: this.position,
      altSeen: this.altSeen,
      error: this.error,
      startedAt: this.startedAt,
    };
  }

  emit() { this.onChange?.(this.snapshot()); }

  watch() {
    if (!('geolocation' in navigator)) {
      this.error = 'This device or browser has no GPS access.';
      this.emit();
      return;
    }
    if (this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.onPosition(p),
      (e) => {
        this.error = e.code === 1
          ? 'Location permission is blocked. Allow location for this site in your browser settings.'
          : 'Waiting for a GPS signal… step outside for a clearer sky view.';
        this.emit();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  }

  unwatch() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  // Start listening for position before recording, so the map can show where you are
  warmUp() { this.watch(); }

  start() {
    this.watch();
    this.status = 'tracking';
    this.startedAt = new Date();
    this.segStart = Date.now();
    this.emit();
  }

  pause() {
    if (this.status !== 'tracking') return;
    this.activeMs += Date.now() - this.segStart;
    this.segStart = null;
    this.status = 'paused';
    this.last = null; // don't count the gap between pause and resume as distance
    this.emit();
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'tracking';
    this.segStart = Date.now();
    this.emit();
  }

  finish() {
    if (this.segStart) this.activeMs += Date.now() - this.segStart;
    this.segStart = null;
    const summary = {
      started_at: (this.startedAt || new Date()).toISOString(),
      duration_s: Math.round(this.activeMs / 1000),
      distance_m: Math.round(this.distance),
      elevation_gain_m: Math.round(this.gain),
      route: this.points.length > 1 ? simplify(this.points) : null,
      altSeen: this.altSeen,
    };
    this.unwatch();
    this.reset();
    this.emit();
    return summary;
  }

  discard() {
    this.unwatch();
    this.reset();
    this.emit();
  }

  onPosition(p) {
    const { latitude: lat, longitude: lng, accuracy, altitude } = p.coords;
    this.accuracy = accuracy;
    this.position = { lat, lng };
    this.error = null;

    if (this.status !== 'tracking' || accuracy > MAX_ACCURACY_M) return this.emit();

    const pt = { lat, lng, t: p.timestamp || Date.now() };
    if (this.last) {
      const d = haversine(this.last, pt);
      if (d < Math.max(3, accuracy * 0.4)) return this.emit(); // standing still / jitter
      const dt = (pt.t - this.last.t) / 1000;
      if (dt > 0 && d / dt > MAX_SPEED_MS) return this.emit(); // teleport glitch
      this.distance += d;
    }

    if (altitude != null && Number.isFinite(altitude)) {
      this.altSeen = true;
      this.altSmooth = this.altSmooth == null ? altitude : this.altSmooth * 0.75 + altitude * 0.25;
      if (this.altBase == null) this.altBase = this.altSmooth;
      const rise = this.altSmooth - this.altBase;
      if (rise >= CLIMB_STEP_M) {
        this.gain += rise;
        this.altBase = this.altSmooth;
      } else if (this.altSmooth < this.altBase) {
        this.altBase = this.altSmooth;
      }
    }

    this.last = pt;
    this.points.push([+lat.toFixed(6), +lng.toFixed(6)]);
    this.emit();
  }
}
