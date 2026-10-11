import { buildWidgetData, cityFromUrl, pushWidgetData } from "./widget";
import type { Place, Weather } from "./weather";

const place: Place = { name: "Pokhara", country: "NP", latitude: 28.2, longitude: 83.98 };
const weather = { temperature: 21.4, code: 61, isDay: true, days: [{ date: "2026-10-11", max: 25.6, min: 14.2, code: 61, rain: 80, precip: 2 }] } as unknown as Weather;

afterEach(() => { delete (window as { Capacitor?: unknown }).Capacitor; });

test("builds a rounded payload in the chosen unit", () => {
  const c = buildWidgetData(place, weather, "C", 5);
  expect(c).toMatchObject({ city: "Pokhara", temp: 21, high: 26, low: 14, unit: "C", icon: "rain", updatedAt: 5 });
  expect(c.condition).toBeTruthy();
  expect(buildWidgetData(place, weather, "F", 5).temp).toBe(71);
});

test("falls back to current temperature when no daily forecast", () => {
  const d = buildWidgetData(place, { ...weather, days: [] }, "C", 1);
  expect(d.high).toBe(21);
  expect(d.low).toBe(21);
});

test("reads the tapped city from the launch url", () => {
  expect(cityFromUrl("?city=Pokhara")).toBe("Pokhara");
  expect(cityFromUrl("?city=%20")).toBeNull();
  expect(cityFromUrl("")).toBeNull();
});

test("pushes to the native plugin only when present", async () => {
  await expect(pushWidgetData(buildWidgetData(place, weather, "C", 1))).resolves.toBe(false);
  const update = vi.fn().mockResolvedValue(undefined);
  (window as { Capacitor?: unknown }).Capacitor = { Plugins: { WeatherWidget: { update } } };
  await expect(pushWidgetData(buildWidgetData(place, weather, "C", 1))).resolves.toBe(true);
  expect(update).toHaveBeenCalledOnce();
});

test("swallows native plugin failures", async () => {
  (window as { Capacitor?: unknown }).Capacitor = { Plugins: { WeatherWidget: { update: () => Promise.reject(new Error("x")) } } };
  await expect(pushWidgetData(buildWidgetData(place, weather, "C", 1))).resolves.toBe(false);
});
