export interface Place { name: string; country: string; latitude: number; longitude: number; }
export interface DayForecast { date: string; max: number; min: number; code: number; }
export interface Weather { temperature: number; wind: number; code: number; days: DayForecast[]; }

const CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};
export const describe = (code: number): string => CODES[code] ?? "Unknown";

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
    `&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
  const d = await res.json();
  return {
    temperature: d.current.temperature_2m,
    wind: d.current.wind_speed_10m,
    code: d.current.weather_code,
    days: d.daily.time.map((date: string, i: number) => ({
      date, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i],
    })),
  };
}

export type Unit = "C" | "F";
export const convertTemp = (c: number, unit: Unit): number => (unit === "F" ? (c * 9) / 5 + 32 : c);
export const formatTemp = (c: number, unit: Unit, withUnit = true): string =>
  `${Math.round(convertTemp(c, unit))}°${withUnit ? unit : ""}`;
