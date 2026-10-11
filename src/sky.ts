// Pure model for the living sky: gradient colours, sun position and weather effects from
// condition code + time of day. The canvas renderer (SkyCanvas.tsx) only draws what this returns.

export type Rgb = [number, number, number];

export const parseHex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
export const toHex = (c: Rgb): string =>
  `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Colour at x along sorted [position, hex] stops (clamped at the ends). */
export function ramp(stops: [number, string][], x: number): Rgb {
  if (x <= stops[0][0]) return parseHex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (x <= p1) return mix(parseHex(c0), parseHex(c1), (x - p0) / (p1 - p0));
  }
  return parseHex(stops[stops.length - 1][1]);
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Apple-style temperature colour (°C): violet when freezing through teal, green, yellow to red when hot. */
export const tempColor = (c: number): string =>
  toHex(ramp([[-15, "#8a7dff"], [-5, "#5a8dff"], [3, "#45b4ff"], [10, "#3fd1c0"], [17, "#8fdc5a"], [23, "#ffd23f"], [29, "#ff9f43"], [35, "#ff6b4a"], [42, "#e8455d"]], c));

export interface WeatherFx { cloud: number; rain: number; snow: number; fog: number; storm: boolean; }

/** Intensity (0–1) of each sky effect for a WMO weather code. */
export function weatherFx(code: number): WeatherFx {
  const fx: WeatherFx = { cloud: 0, rain: 0, snow: 0, fog: 0, storm: false };
  if (code === 1) fx.cloud = 0.2;
  else if (code === 2) fx.cloud = 0.5;
  else if (code === 3) fx.cloud = 0.95;
  else if (code === 45 || code === 48) Object.assign(fx, { cloud: 0.5, fog: 0.85 });
  else if (code >= 51 && code <= 57) Object.assign(fx, { cloud: 0.85, rain: 0.25 });
  else if (code >= 61 && code <= 67) Object.assign(fx, { cloud: 0.9, rain: [0.45, 0.7, 1][Math.min(2, Math.floor((code - 61) / 2))] });
  else if (code >= 71 && code <= 77) Object.assign(fx, { cloud: 0.85, snow: code === 71 ? 0.4 : code === 73 ? 0.7 : 1 });
  else if (code >= 80 && code <= 82) Object.assign(fx, { cloud: 0.75, rain: [0.5, 0.8, 1][code - 80] });
  else if (code === 85 || code === 86) Object.assign(fx, { cloud: 0.8, snow: code === 85 ? 0.6 : 1 });
  else if (code >= 95 && code <= 99) Object.assign(fx, { cloud: 1, rain: 0.9, storm: true });
  return fx;
}

export const TWILIGHT_MIN = 80;

/** Sun elevation proxy in [-1, 1]: 0 at sunrise/sunset, 1 at solar noon, -1 after TWILIGHT_MIN of darkness. */
export function sunElevation(nowMin: number, riseMin: number, setMin: number): number {
  if (!(setMin > riseMin)) return 0.6;
  if (nowMin >= riseMin && nowMin <= setMin) return Math.sin((Math.PI * (nowMin - riseMin)) / (setMin - riseMin));
  const dark = nowMin < riseMin ? Math.min(riseMin - nowMin, nowMin + 1440 - setMin) : Math.min(nowMin - setMin, riseMin + 1440 - nowMin);
  return -clamp(dark / TWILIGHT_MIN);
}

const minuteOfDay = (iso: string | null): number | null => {
  const m = iso?.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Clear-sky gradient stops by elevation, tuned so white text keeps >= 3:1 contrast on the top colour.
const TOP: [number, string][] = [[-1, "#050a1e"], [-0.45, "#141d47"], [-0.12, "#2f3570"], [0, "#47508f"], [0.15, "#2f62ad"], [0.45, "#2464bd"], [1, "#1f5fbb"]];
const BOTTOM: [number, string][] = [[-1, "#101a3c"], [-0.45, "#272a5c"], [-0.12, "#8a4f78"], [0, "#e07f5c"], [0.15, "#e6a578"], [0.45, "#6fa9e0"], [1, "#62a3e0"]];
// Condition overlays: [day top, day bottom, night top, night bottom].
const OVERLAY = {
  overcast: ["#536277", "#8794a6", "#141a26", "#262f40"],
  rain: ["#435167", "#68778b", "#0d121c", "#1d2531"],
  storm: ["#2a3141", "#485161", "#06080e", "#181d29"],
  snow: ["#5f7089", "#b9c5d3", "#1c2436", "#3b4660"],
  fog: ["#66727f", "#acb5bf", "#1e242e", "#373e49"],
} as const;

export interface SkyInput { code: number; isDay: boolean; time: string | null; sunrise: string | null; sunset: string | null; }
export interface SkyState {
  top: string; bottom: string; elevation: number;
  /** 0 (sunrise, left) … 1 (sunset, right). */
  sunX: number;
  /** Star visibility 0–1. */
  stars: number;
  fx: WeatherFx;
}

/** Everything the sky renderer needs for a condition at a moment. */
export function skyFor({ code, isDay, time, sunrise, sunset }: SkyInput): SkyState {
  const [now, rise, set] = [minuteOfDay(time), minuteOfDay(sunrise), minuteOfDay(sunset)];
  const known = now !== null && rise !== null && set !== null && set > rise;
  const elevation = known ? sunElevation(now, rise, set) : isDay ? 0.6 : -1;
  const sunX = known ? clamp((now - rise) / (set - rise)) : 0.7;
  const fx = weatherFx(code);
  const kind = fx.storm ? "storm" : fx.snow ? "snow" : fx.rain ? "rain" : fx.fog ? "fog" : "overcast";
  const amount = fx.storm ? 0.85 : fx.snow ? 0.45 + 0.35 * fx.snow : fx.rain ? 0.5 + 0.35 * fx.rain : fx.fog ? 0.75 : fx.cloud * 0.75;
  const dayness = clamp((elevation + 0.3) / 0.6);
  const o = OVERLAY[kind].map(parseHex);
  const top = mix(ramp(TOP, elevation), mix(o[2], o[0], dayness), amount);
  const bottom = mix(ramp(BOTTOM, elevation), mix(o[3], o[1], dayness), amount);
  return { top: toHex(top), bottom: toHex(bottom), elevation, sunX, stars: clamp(-elevation * 1.4 - 0.2) * (1 - fx.cloud * 0.9), fx };
}
