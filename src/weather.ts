import { EN, num, t, type Key, type Lang } from "./i18n";

export interface Place { name: string; country: string; latitude: number; longitude: number; }
export interface DayForecast { date: string; max: number; min: number; code: number; rain: number | null; precip: number | null; }
export interface HourForecast { time: string; temp: number; rain?: number; }
export interface UvHour { time: string; uv: number | null; }
export interface Weather { temperature: number; wind: number; code: number; isDay: boolean; days: DayForecast[]; hours: HourForecast[]; uv: number | null; feelsLike: number | null; humidity: number | null; windDir: number | null; sunrise: string | null; sunset: string | null; now: string | null; yesterdayMax: number | null; pressure: number | null; visibility: number | null; pressureDelta: number | null; gust: number | null; daylightMin: number | null; daylightDeltaMin: number | null; uvHours: UvHour[]; }
export interface AirQuality { aqi: number; pm25: number | null; pollen: Pollen | null; }

const HOURS_AHEAD = 12;
const PRESSURE_TREND_HOURS = 3;

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
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,apparent_temperature,relative_humidity_2m,pressure_msl,visibility,wind_gusts_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum,uv_index_max&hourly=temperature_2m,precipitation_probability,pressure_msl,uv_index&timezone=auto&forecast_days=7&past_days=1`;
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
  const found: number = d.current.time ? d.daily.time.indexOf(String(d.current.time).slice(0, 10)) : -1;
  const ti = Math.max(0, found);
  const yesterdayMax: unknown = ti > 0 ? d.daily.temperature_2m_max[ti - 1] : null;
  const hp: unknown[] = d.hourly?.pressure_msl ?? [];
  const [pNow, pBefore] = [d.current.pressure_msl ?? hp[start], hp[start - PRESSURE_TREND_HOURS]];
  const pressureDelta = times.length && typeof pNow === "number" && typeof pBefore === "number" ? pNow - pBefore : null;
  const today = String(d.current.time ?? times[0] ?? "").slice(0, 10);
  const uvHours: UvHour[] = times
    .map((time, i) => ({ time, uv: typeof d.hourly.uv_index?.[i] === "number" ? (d.hourly.uv_index[i] as number) : null }))
    .filter((h) => h.time.startsWith(today) && h.uv !== null);
  return {
    temperature: d.current.temperature_2m,
    wind: d.current.wind_speed_10m,
    code: d.current.weather_code,
    isDay: d.current.is_day !== 0,
    days: d.daily.time.map((date: string, i: number) => ({
      date, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i],
      rain: d.daily.precipitation_probability_max?.[i] ?? null,
      precip: d.daily.precipitation_sum?.[i] ?? null,
    })).slice(ti),
    hours,
    uv: d.daily.uv_index_max?.[ti] ?? null,
    feelsLike: d.current.apparent_temperature ?? null,
    humidity: d.current.relative_humidity_2m ?? null,
    windDir: d.current.wind_direction_10m ?? null,
    gust: d.current.wind_gusts_10m ?? null,
    sunrise: d.daily.sunrise?.[ti] ?? null,
    sunset: d.daily.sunset?.[ti] ?? null,
    now: d.current.time ?? null,
    pressure: d.current.pressure_msl ?? null,
    visibility: d.current.visibility ?? null,
    daylightMin: dayLength(d.daily.sunrise?.[ti], d.daily.sunset?.[ti]),
    daylightDeltaMin: ti > 0 ? daylightChange(dayLength(d.daily.sunrise?.[ti], d.daily.sunset?.[ti]), dayLength(d.daily.sunrise?.[ti - 1], d.daily.sunset?.[ti - 1])) : null,
    uvHours,
    pressureDelta,
    yesterdayMax: typeof yesterdayMax === "number" ? yesterdayMax : null,
  };
}

export type Trend = "warmer" | "cooler" | "same";

/** Today's max vs yesterday's (in °C): "same" when the difference is under 1°, else the rounded difference. */
export function compareWithYesterday(todayMax: number, yesterdayMax: number): { trend: Trend; diff: number } {
  const delta = todayMax - yesterdayMax;
  if (Math.abs(delta) < 1) return { trend: "same", diff: 0 };
  return { trend: delta > 0 ? "warmer" : "cooler", diff: Math.round(Math.abs(delta)) };
}

export type Unit = "C" | "F";
export const convertTemp = (c: number, unit: Unit): number => (unit === "F" ? (c * 9) / 5 + 32 : c);

const MM_PER_INCH = 25.4;
const KMH_PER_MPH = 1.609344;
/** Precipitation total in the unit's system (mm for °C, in for °F), rounded to 1 decimal (2 for inches < 1); null when zero or missing. */
export function formatPrecip(mm: number | null, unit: Unit): { value: number; unit: "mm" | "in" } | null {
  if (mm === null || !(mm > 0)) return null;
  const r = (v: number) => Math.round(v * 10) / 10;
  return unit === "F" ? { value: r(mm / MM_PER_INCH), unit: "in" } : { value: r(mm), unit: "mm" };
}

/** Gust speed (km/h) worth showing: null when missing or under 5 km/h above sustained wind. */
export function visibleGust(wind: number, gust: number | null): number | null {
  return gust !== null && gust - wind >= 5 ? gust : null;
}

/** Wind speed in the unit's system (km/h for °C, mph for °F), rounded to a whole number. */
export function formatWind(kmh: number, unit: Unit): { value: number; unit: "kmh" | "mph" } {
  return unit === "F" ? { value: Math.round(kmh / KMH_PER_MPH), unit: "mph" } : { value: Math.round(kmh), unit: "kmh" };
}

const HPA_PER_INHG = 33.8639;
const M_PER_MILE = 1609.344;
/** Sea-level pressure in the unit's system (hPa for °C, inHg for °F). */
export function formatPressure(hpa: number, unit: Unit): { value: number; unit: "hPa" | "inHg" } {
  return unit === "F" ? { value: Math.round((hpa / HPA_PER_INHG) * 100) / 100, unit: "inHg" } : { value: Math.round(hpa), unit: "hPa" };
}

/** Visibility from metres in the unit's system (km for °C, mi for °F), rounded to 1 decimal. */
export function formatVisibility(m: number, unit: Unit): { value: number; unit: "km" | "mi" } {
  const r = (v: number) => Math.round(v * 10) / 10;
  return unit === "F" ? { value: r(m / M_PER_MILE), unit: "mi" } : { value: r(m / 1000), unit: "km" };
}

export type PressureTrend = "rising" | "falling" | "steady";
/** Trend from the 3-hour pressure change in hPa: steady when under 1 hPa; null when unknown. */
export function pressureTrend(delta: number | null): PressureTrend | null {
  if (delta === null) return null;
  return Math.abs(delta) < 1 ? "steady" : delta > 0 ? "rising" : "falling";
}

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

export const POLLEN_SPECIES = ["grass", "birch", "alder", "ragweed"] as const;
export type PollenSpecies = (typeof POLLEN_SPECIES)[number];
export interface Pollen { level: 0 | 1 | 2 | 3; species: PollenSpecies | null; value: number; }

/** Lower bounds (grains/m³) of Moderate, High and Very high per species, after Foreca's pollen scale: grass/ragweed 5/20/50, birch/alder 10/50/200. */
const POLLEN_STEPS: Record<PollenSpecies, [number, number, number]> = {
  grass: [5, 20, 50], ragweed: [5, 20, 50], birch: [10, 50, 200], alder: [10, 50, 200],
};
/** Level 0 (Low) to 3 (Very high) for a species concentration in grains/m³. */
export const pollenLevel = (species: PollenSpecies, grains: number): 0 | 1 | 2 | 3 =>
  POLLEN_STEPS[species].filter((min) => grains >= min).length as 0 | 1 | 2 | 3;

/** Today's peak pollen level and its dominant species from hourly arrays; null when no numeric data. */
export function todaysPollen(hourly: Record<string, unknown> | undefined): Pollen | null {
  let best: (Pollen & { species: PollenSpecies }) | null = null;
  let score = -1;
  for (const species of POLLEN_SPECIES) {
    const arr = hourly?.[`${species}_pollen`];
    if (!Array.isArray(arr)) continue;
    const nums = arr.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!nums.length) continue;
    const value = Math.max(...nums);
    const s = pollenLevel(species, value) + value / POLLEN_STEPS[species][2] / 10;
    if (s > score) { score = s; best = { level: pollenLevel(species, value), species, value }; }
  }
  if (!best) return null;
  return best.value > 0 ? best : { level: 0, species: null, value: 0 };
}

/** Current air quality, or null when unavailable (never throws). */
export async function getAirQuality(p: Place, f: Fetch = fetch): Promise<AirQuality | null> {
  try {
    const res = await f(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.latitude}&longitude=${p.longitude}&current=european_aqi,pm2_5&hourly=${POLLEN_SPECIES.map((k) => `${k}_pollen`).join(",")}&timezone=auto&forecast_days=1`);
    if (!res.ok) return null;
    const body = await res.json();
    const c = body.current;
    if (typeof c?.european_aqi !== "number") return null;
    return { aqi: c.european_aqi, pm25: typeof c.pm2_5 === "number" ? c.pm2_5 : null, pollen: todaysPollen(body.hourly) };
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

/** Whole minutes between sunrise and sunset; null when either is missing/invalid or sunset is not after sunrise. */
export function dayLength(sunrise: unknown, sunset: unknown): number | null {
  if (typeof sunrise !== "string" || typeof sunset !== "string") return null;
  const [r, s] = [sunrise, sunset].map((t) => new Date(t).getTime());
  return s > r ? Math.round((s - r) / 60000) : null;
}

/** Minutes today's daylight differs from yesterday's (positive = longer); null if either is missing. */
export function daylightChange(today: number | null, yesterday: number | null): number | null {
  return today === null || yesterday === null ? null : today - yesterday;
}

/** Fraction (0–1) of the daylight span elapsed at `now`; clamped, so 0 before sunrise and 1 after sunset. */
export function sunProgress(now: string, sunrise: string, sunset: string): number {
  const [n, r, s] = [now, sunrise, sunset].map((t) => new Date(t).getTime());
  if (!(s > r)) return 0;
  return Math.min(1, Math.max(0, (n - r) / (s - r)));
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
export type MoonPhaseName = "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous" | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";
const MOON_NAMES: MoonPhaseName[] = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];

/** Moon phase for a date: cycle fraction (0 = new, 0.5 = full), illumination (0–1) and one of 8 named phases. */
export function moonPhase(date: Date): { phase: number; illumination: number; name: MoonPhaseName } {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  const phase = (((days / SYNODIC) % 1) + 1) % 1;
  return { phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2, name: MOON_NAMES[Math.floor(phase * 8 + 0.5) % 8] };
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

/** Forecast-derived severe-weather thresholds (°C) and look-ahead window. */
export const SEVERE_HEAT_C = 40;
export const SEVERE_COLD_C = -15;
export const SEVERE_OUTLOOK_DAYS = 7;
export type SevereKind = "storm" | "snow" | "heat" | "cold";
export interface SevereOutlook { date: string; kind: SevereKind; temp: number | null; }

/** First severe day in the next 7: thunderstorm (95–99), heavy snow/freezing rain (67, 75, 77, 86), extreme heat/cold. Temp is in the unit's scale. */
export function severeOutlook(daily: DayForecast[], unit: Unit): SevereOutlook | null {
  for (const d of daily.slice(0, SEVERE_OUTLOOK_DAYS)) {
    const at = (kind: SevereKind, c: number | null): SevereOutlook => ({ date: d.date, kind, temp: c === null ? null : Math.round(convertTemp(c, unit)) });
    if (d.code >= 95 && d.code <= 99) return at("storm", null);
    if (d.code === 66 || d.code === 67 || d.code === 75 || d.code === 77 || d.code === 86) return at("snow", null);
    if (d.max >= SEVERE_HEAT_C) return at("heat", d.max);
    if (d.min <= SEVERE_COLD_C) return at("cold", d.min);
  }
  return null;
}

export const UV_PROTECT = 3;

/** First and last "HH:MM" hour where UV >= 3 (WHO sun-protection threshold); null if none. */
export function uvWindow(hours: UvHour[]): { start: string; end: string } | null {
  const hit = hours.filter((h) => h.uv !== null && h.uv >= UV_PROTECT);
  return hit.length ? { start: hit[0].time.slice(11, 16), end: hit[hit.length - 1].time.slice(11, 16) } : null;
}
