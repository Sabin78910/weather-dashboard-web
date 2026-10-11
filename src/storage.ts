import type { Lang } from "./i18n";
import type { Place, Unit, Weather } from "./weather";

const KEY = "lastCity";

export function loadLastCity(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastCity(city: string): void {
  try {
    localStorage.setItem(KEY, city);
  } catch {
    // storage unavailable (private mode, quota); ignore
  }
}

const FAV_KEY = "favourites";

export function loadFavourites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavourites(cities: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(cities));
  } catch {
    // storage unavailable; ignore
  }
}

const FORECAST_KEY = "lastForecast";

export type ForecastSnapshot = { place: Place; weather: Weather; savedAt: number };

const isSnapshot = (v: unknown): v is ForecastSnapshot =>
  !!v && typeof v === "object" && "place" in v && "weather" in v && "savedAt" in v && typeof v.savedAt === "number";

export function loadForecast(): ForecastSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FORECAST_KEY) ?? "null");
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveForecast(snapshot: ForecastSnapshot): void {
  try {
    localStorage.setItem(FORECAST_KEY, JSON.stringify(snapshot));
  } catch {
    // storage unavailable; ignore
  }
}

const LANG_KEY = "lang";

export function loadLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ne" ? v : null;
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // storage unavailable; ignore
  }
}

const CITY_CACHE_KEY = "forecastCache";
export const CITY_CACHE_MAX = 8;
const cacheKey = (city: string) => city.trim().toLowerCase();

function readCityCache(): Record<string, ForecastSnapshot> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CITY_CACHE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isSnapshot(v)));
  } catch {
    return {};
  }
}

/** Last forecast seen for a city (by search text or place name, case-insensitive), for instant paint. */
export function loadCityForecast(city: string): ForecastSnapshot | null {
  return readCityCache()[cacheKey(city)] ?? null;
}

/** Caches a forecast under each given name, keeping the CITY_CACHE_MAX most recent entries. */
export function saveCityForecast(names: string[], snapshot: ForecastSnapshot): void {
  const cache = readCityCache();
  for (const n of names) if (n.trim()) cache[cacheKey(n)] = snapshot;
  const kept = Object.entries(cache).sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, CITY_CACHE_MAX);
  try {
    localStorage.setItem(CITY_CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // storage unavailable; ignore
  }
}

const UNIT_KEY = "unit";
export function loadUnit(): Unit | null {
  try {
    const v = localStorage.getItem(UNIT_KEY);
    return v === "C" || v === "F" ? v : null;
  } catch {
    return null;
  }
}
export function saveUnit(unit: Unit): void {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // storage unavailable; ignore
  }
}

export type Theme = "light" | "dark";
const THEME_KEY = "theme";
export function loadTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable; ignore
  }
}
