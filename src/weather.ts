export interface Place { name: string; country: string; latitude: number; longitude: number; }
export interface DayForecast { date: string; max: number; min: number; code: number; rain: number | null; }
export interface HourForecast { time: string; temp: number; rain?: number; }
export interface Weather { temperature: number; wind: number; code: number; isDay: boolean; days: DayForecast[]; hours: HourForecast[]; uv: number | null; }
export interface AirQuality { aqi: number; pm25: number | null; }

const HOURS_AHEAD = 12;

const CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};
export const describe = (code: number): string => CODES[code] ?? "Unknown";

export const iconFor = (code: number): string => {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 65) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "❓";
};

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
    `&current=temperature_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=7`;
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
  };
}

export type Unit = "C" | "F";
export const convertTemp = (c: number, unit: Unit): number => (unit === "F" ? (c * 9) / 5 + 32 : c);

export interface Level { label: string; color: string; }
const pick = (v: number, steps: [number, Level][], last: Level): Level => steps.find(([max]) => v < max)?.[1] ?? last;

/** European AQI bands. */
export const aqiLevel = (aqi: number): Level =>
  pick(aqi, [
    [20, { label: "Good", color: "#2e9e5b" }], [40, { label: "Fair", color: "#8ab82e" }], [60, { label: "Moderate", color: "#d4a017" }],
    [80, { label: "Poor", color: "#e0742b" }], [100, { label: "Very poor", color: "#d23f3f" }],
  ], { label: "Extremely poor", color: "#8e2a6b" });

export const uvLevel = (uv: number): Level =>
  pick(uv, [
    [3, { label: "Low", color: "#2e9e5b" }], [6, { label: "Moderate", color: "#d4a017" }], [8, { label: "High", color: "#e0742b" }],
    [11, { label: "Very high", color: "#d23f3f" }],
  ], { label: "Extreme", color: "#8e2a6b" });

export function healthAdvice(aqi: number | null, uv: number | null): string {
  const tips: string[] = [];
  if (aqi !== null && aqi >= 80) tips.push("Air quality is very poor: limit outdoor activity.");
  else if (aqi !== null && aqi >= 60) tips.push("Air quality is poor: sensitive people should reduce outdoor exertion.");
  if (uv !== null && uv >= 6) tips.push("Strong UV: wear sunscreen and a hat, and seek shade at midday.");
  else if (uv !== null && uv >= 3) tips.push("Moderate UV: sunscreen is advisable.");
  if (tips.length) return tips.join(" ");
  return aqi === null && uv === null ? "" : "Conditions are great for being outdoors.";
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
export function rainSummary(hours: HourForecast[]): string {
  const known = hours.filter((h) => typeof h.rain === "number");
  if (!known.length) return "";
  const first = known.find((h) => (h.rain as number) >= RAIN_THRESHOLD);
  if (!first) return `No rain expected in the next ${hours.length} hours`;
  const hour = Number(first.time.slice(11, 13));
  const label = `${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}`;
  return `Rain likely around ${label} (${first.rain}%)`;
}
