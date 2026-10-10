import { EN, num, t, type Key, type Lang } from "./i18n";

export interface Place { name: string; country: string; latitude: number; longitude: number; }
export interface DayForecast { date: string; max: number; min: number; code: number; rain: number | null; }
export interface HourForecast { time: string; temp: number; rain?: number; }
export interface Weather { temperature: number; wind: number; code: number; isDay: boolean; days: DayForecast[]; hours: HourForecast[]; uv: number | null; feelsLike: number | null; humidity: number | null; windDir: number | null; sunrise: string | null; sunset: string | null; now: string | null; }
export interface AirQuality { aqi: number; pm25: number | null; }

const HOURS_AHEAD = 12;

export const describe = (code: number, lang: Lang = "en"): string => (`wx${code}` in EN ? t(lang, `wx${code}` as Key) : t(lang, "unknown"));

export type IconKind = "sun" | "moon" | "partly-cloudy" | "cloud" | "rain" | "snow" | "storm" | "fog";

export function iconKind(code: number, isDay = true): IconKind {
  if (code === 0 || code === 1) return isDay ? "sun" : "moon";
  if (code === 2) return "partly-cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95 && code <= 99) return "storm";
  return "cloud";
}

export type Scene = `${"clear" | "cloudy" | "rain" | "snow" | "storm"}-${"day" | "night"}`;

/** Sky background scene for a weather code and time of day. */
export function sceneFor(code: number, isDay: boolean): Scene {
  const kind = code <= 1 ? "clear" : code >= 95 && code <= 99 ? "storm" : (code >= 51 && code <= 65) || (code >= 80 && code <= 82) ? "rain" : code >= 71 && code <= 77 ? "snow" : "cloudy";
  return `${kind}-${isDay ? "day" : "night"}`;
}

/** Position of a day's min–max span within the week's overall range, as percentages. */
export function rangeBar(day: { min: number; max: number }, days: { min: number; max: number }[]): { left: number; width: number } {
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  if (hi === lo) return { left: 0, width: 100 };
  return { left: ((day.min - lo) / (hi - lo)) * 100, width: ((day.max - day.min) / (hi - lo)) * 100 };
}

type Fetch = typeof fetch;

export async function findPlace(query: string, f: Fetch = fetch): Promise<Place | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(query)}`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  const r = data.results?.[0];
  return r ? { name: r.name, country: r.country ?? "", latitude: r.latitude, longitude: r.longitude } : null;
}

export async function getWeather(p: Place, f: Fetch = fetch): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,apparent_temperature,relative_humidity_2m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=7`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
  const d = await res.json();
  const times: string[] = d.hourly?.time ?? [];
  const nowHour: string = (d.current.time ?? times[0] ?? "").slice(0, 13);
  const start = Math.max(0, times.findIndex((t) => t.slice(0, 13) >= nowHour));
  const hours: HourForecast[] = times
    .map((time, i) => ({
      time, temp: d.hourly.temperature_2m[i] as number,
      ...(typeof d.hourly.precipitation_probability?.[i] === "number" && { rain: d.hourly.precipitation_probability[i] as number }),
    }))
    .slice(start, start + HOURS_AHEAD);
  return {
    temperature: d.current.temperature_2m,
    wind: d.current.wind_speed_10m,
    code: d.current.weather_code,
    isDay: d.current.is_day !== 0,
    days: d.daily.time.map((date: string, i: number) => ({
      date, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i],
      rain: d.daily.precipitation_probability_max?.[i] ?? null,
    })),
    hours,
    uv: d.daily.uv_index_max?.[0] ?? null,
    feelsLike: d.current.apparent_temperature ?? null,
    humidity: d.current.relative_humidity_2m ?? null,
    windDir: d.current.wind_direction_10m ?? null,
    sunrise: d.daily.sunrise?.[0] ?? null,
    sunset: d.daily.sunset?.[0] ?? null,
    now: d.current.time ?? null,
  };
}

export type Unit = "C" | "F";
export const convertTemp = (c: number, unit: Unit): number => (unit === "F" ? (c * 9) / 5 + 32 : c);

export interface Level { label: string; color: string; }
const lvl = (label: string, color: string, lang: Lang): Level => ({ label: t(lang, `lvl.${label}` as Key), color });
const pick = (v: number, steps: [number, Level][], last: Level): Level => steps.find(([max]) => v < max)?.[1] ?? last;

/** European AQI bands. */
export const aqiLevel = (aqi: number, lang: Lang = "en"): Level =>
  pick(aqi, [
    [20, lvl("Good", "#2e9e5b", lang)], [40, lvl("Fair", "#8ab82e", lang)], [60, lvl("Moderate", "#d4a017", lang)],
    [80, lvl("Poor", "#e0742b", lang)], [100, lvl("Very poor", "#d23f3f", lang)],
  ], lvl("Extremely poor", "#8e2a6b", lang));

export const uvLevel = (uv: number, lang: Lang = "en"): Level =>
  pick(uv, [
    [3, lvl("Low", "#2e9e5b", lang)], [6, lvl("Moderate", "#d4a017", lang)], [8, lvl("High", "#e0742b", lang)],
    [11, lvl("Very high", "#d23f3f", lang)],
  ], lvl("Extreme", "#8e2a6b", lang));

export function healthAdvice(aqi: number | null, uv: number | null, lang: Lang = "en"): string {
  const tips: string[] = [];
  if (aqi !== null && aqi >= 80) tips.push(t(lang, "adviceAqiVery"));
  else if (aqi !== null && aqi >= 60) tips.push(t(lang, "adviceAqiPoor"));
  if (uv !== null && uv >= 6) tips.push(t(lang, "adviceUvStrong"));
  else if (uv !== null && uv >= 3) tips.push(t(lang, "adviceUvModerate"));
  if (tips.length) return tips.join(" ");
  return aqi === null && uv === null ? "" : t(lang, "adviceGreat");
}

/** Current air quality, or null when unavailable (never throws). */
export async function getAirQuality(p: Place, f: Fetch = fetch): Promise<AirQuality | null> {
  try {
    const res = await f(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.latitude}&longitude=${p.longitude}&current=european_aqi,pm2_5`);
    if (!res.ok) return null;
    const c = (await res.json()).current;
    if (typeof c?.european_aqi !== "number") return null;
    return { aqi: c.european_aqi, pm25: typeof c.pm2_5 === "number" ? c.pm2_5 : null };
  } catch {
    return null;
  }
}

const RAIN_THRESHOLD = 50;

/** One-line "when does rain start" summary from hourly precipitation probability; "" when no data. */
export function rainSummary(hours: HourForecast[], lang: Lang = "en"): string {
  const known = hours.filter((h) => typeof h.rain === "number");
  if (!known.length) return "";
  const first = known.find((h) => (h.rain as number) >= RAIN_THRESHOLD);
  if (!first) return t(lang, "rainNone", { hours: num(lang, hours.length) });
  const hour = Number(first.time.slice(11, 13));
  const label = `${num(lang, hour % 12 || 12)} ${t(lang, hour < 12 ? "am" : "pm")}`;
  return t(lang, "rainAt", { time: label, pct: num(lang, first.rain as number) });
}

/** Fraction (0–1) of the daylight span elapsed at `now`; clamped, so 0 before sunrise and 1 after sunset. */
export function sunProgress(now: string, sunrise: string, sunset: string): number {
  const [n, r, s] = [now, sunrise, sunset].map((t) => new Date(t).getTime());
  if (!(s > r)) return 0;
  return Math.min(1, Math.max(0, (n - r) / (s - r)));
}

/** Point on a semicircular arc (centre cx,cy; radius r) for progress 0 (left) … 1 (right). */
export function arcPoint(progress: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, progress)));
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

/** Gauge fill fraction (0–1) of a value within 0…max. */
export function gaugeFraction(value: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
}

export const AQI_GAUGE_MAX = 120;
export const UV_GAUGE_MAX = 11;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** Compass point for a wind direction in degrees (direction the wind comes from). */
export const compassPoint = (deg: number, lang: Lang = "en"): string => t(lang, `dir.${COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]}` as Key);

export interface Tip { id: "umbrella" | "sunscreen" | "mask" | "jacket" | "great"; icon: string; text: string; }

const TIP_UV = 6;
const TIP_AQI = 60;
const TIP_DROP = 8;

/** Actionable tips for today from the forecast and (optional) air quality. */
export function dailyTips(w: Pick<Weather, "temperature" | "code" | "days" | "hours" | "uv">, aqi: number | null, lang: Lang = "en"): Tip[] {
  const tips: Tip[] = [];
  const today = w.days[0];
  if (today?.rain != null && today.rain >= RAIN_THRESHOLD) tips.push({ id: "umbrella", icon: "☂️", text: t(lang, "tipUmbrella", { pct: num(lang, today.rain) }) });
  if (w.uv !== null && w.uv >= TIP_UV) tips.push({ id: "sunscreen", icon: "🧴", text: t(lang, "tipSunscreen", { uv: num(lang, w.uv) }) });
  if (aqi !== null && aqi >= TIP_AQI) tips.push({ id: "mask", icon: "😷", text: t(lang, "tipMask") });
  if (w.hours.length && w.temperature - Math.min(...w.hours.map((h) => h.temp)) >= TIP_DROP) tips.push({ id: "jacket", icon: "🧥", text: t(lang, "tipJacket") });
  const pleasant = w.code <= 2 && !!today && today.max <= 30 && today.min >= 10;
  if (!tips.length && pleasant) tips.push({ id: "great", icon: "🌤️", text: t(lang, "tipGreat") });
  return tips;
}

export function shareSummary(place: Place, w: Pick<Weather, "temperature" | "code" | "days">, unit: Unit, lang: Lang = "en"): string {
  const tmp = (c: number) => Math.round(convertTemp(c, unit));
  const where = place.country ? `${place.name}, ${place.country}` : place.name;
  const day = w.days[0];
  const range = day ? ` ${t(lang, "hl", { max: num(lang, tmp(day.max)), min: num(lang, tmp(day.min)) })}` : "";
  return t(lang, "shareText", { where, cond: describe(w.code, lang), temp: num(lang, tmp(w.temperature)), unit, range });
}
