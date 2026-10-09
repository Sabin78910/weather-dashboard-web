import { describe as describeCode, findPlace, getWeather, convertTemp, iconFor, rangeBar } from "./weather";

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

test("maps weather codes", () => {
  expect(describeCode(0)).toBe("Clear sky");
  expect(describeCode(1234)).toBe("Unknown");
});

test("findPlace parses geocoding result", async () => {
  const f = vi.fn(() => ok({ results: [{ name: "Kathmandu", country: "Nepal", latitude: 27.7, longitude: 85.3 }] }));
  expect(await findPlace("Kathmandu", f as unknown as typeof fetch)).toEqual({ name: "Kathmandu", country: "Nepal", latitude: 27.7, longitude: 85.3 });
  expect(await findPlace("x", (() => ok({})) as unknown as typeof fetch)).toBeNull();
});

test("getWeather builds daily forecast", async () => {
  const f = () => ok({
    current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], precipitation_probability_max: [80] },
  });
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.days).toEqual([{ date: "2026-10-08", max: 25, min: 14, code: 61, rain: 80 }]);
});

test("getWeather requests hourly temperature and returns the next 12 hours", async () => {
  const time = Array.from({ length: 24 }, (_, i) => `2026-10-08T${String(i).padStart(2, "0")}:00`);
  const f = vi.fn(() => ok({
    current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
    hourly: { time, temperature_2m: time.map((_, i) => i) },
  }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(String((f.mock.calls[0] as unknown[])[0])).toContain("hourly=temperature_2m");
  expect(w.hours).toHaveLength(12);
  expect(w.hours[0]).toEqual({ time: "2026-10-08T10:00", temp: 10 });
  expect(w.hours[11]).toEqual({ time: "2026-10-08T21:00", temp: 21 });
});

test("getWeather returns fewer hours when data runs out", async () => {
  const f = () => ok({
    current: { time: "2026-10-08T22:00", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] },
    hourly: { time: ["2026-10-08T21:00", "2026-10-08T22:00", "2026-10-08T23:00"], temperature_2m: [1, 2, 3] },
  });
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.hours).toEqual([{ time: "2026-10-08T22:00", temp: 2 }, { time: "2026-10-08T23:00", temp: 3 }]);
});

test("convertTemp converts between units", () => {
  expect(convertTemp(0, "F")).toBe(32);
  expect(convertTemp(100, "F")).toBe(212);
  expect(convertTemp(-40, "F")).toBe(-40);
  expect(convertTemp(21, "C")).toBe(21);
});

test("getWeather requests 7 days with rain chance and tolerates missing rain data", async () => {
  const f = vi.fn(() => ok({
    current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
  }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  const url = String((f.mock.calls[0] as unknown[])[0]);
  expect(url).toContain("precipitation_probability_max");
  expect(url).toContain("forecast_days=7");
  expect(w.days[0].rain).toBeNull();
});

test("iconFor maps codes to icons", () => {
  expect(iconFor(0)).toBe("☀️");
  expect(iconFor(63)).toBe("🌧️");
  expect(iconFor(73)).toBe("❄️");
  expect(iconFor(95)).toBe("⛈️");
  expect(iconFor(1234)).toBe("❓");
});

test("rangeBar positions a day within the week's range", () => {
  const days = [{ min: 0, max: 10 }, { min: 5, max: 20 }];
  expect(rangeBar(days[0], days)).toEqual({ left: 0, width: 50 });
  expect(rangeBar(days[1], days)).toEqual({ left: 25, width: 75 });
  expect(rangeBar({ min: 3, max: 3 }, [{ min: 3, max: 3 }])).toEqual({ left: 0, width: 100 });
});
