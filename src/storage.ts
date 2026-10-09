import type { Place, Weather } from "./weather";

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

export function loadForecast(): ForecastSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FORECAST_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && "place" in parsed && "weather" in parsed && "savedAt" in parsed && typeof parsed.savedAt === "number") {
      return parsed as ForecastSnapshot;
    }
    return null;
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
