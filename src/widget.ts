import { convertTemp, describe, iconKind, type IconKind, type Place, type Unit, type Weather } from "./weather";

/** What the Android home-screen widget renders; no personal data, only the primary city's weather. */
export interface WidgetData { city: string; temp: number; high: number; low: number; unit: Unit; condition: string; icon: IconKind; updatedAt: number; }

export function buildWidgetData(place: Place, weather: Weather, unit: Unit, now: number): WidgetData {
  const today = weather.days[0];
  const r = (c: number) => Math.round(convertTemp(c, unit));
  return {
    city: place.name,
    temp: r(weather.temperature),
    high: r(today?.max ?? weather.temperature),
    low: r(today?.min ?? weather.temperature),
    unit,
    condition: describe(weather.code),
    icon: iconKind(weather.code, weather.isDay),
    updatedAt: now,
  };
}

/** City carried by the widget's tap intent (`?city=`), or null. */
export function cityFromUrl(search: string): string | null {
  return new URLSearchParams(search).get("city")?.trim() || null;
}

type WidgetPlugin = { update: (data: WidgetData) => Promise<unknown> };

/** Hands data to the native Capacitor plugin; a no-op (false) on the web. */
export async function pushWidgetData(data: WidgetData): Promise<boolean> {
  const plugin = (window as { Capacitor?: { Plugins?: { WeatherWidget?: WidgetPlugin } } }).Capacitor?.Plugins?.WeatherWidget;
  if (!plugin) return false;
  try {
    await plugin.update(data);
    return true;
  } catch {
    return false;
  }
}
