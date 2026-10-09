import { describe as describeCode, findPlace, getWeather, convertTemp, iconFor, rangeBar, getAirQuality, aqiLevel, uvLevel, healthAdvice, rainSummary, sceneFor } from "./weather";

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

test("aqiLevel and uvLevel classify values", () => {
  expect(aqiLevel(10).label).toBe("Good");
  expect(aqiLevel(45).label).toBe("Moderate");
  expect(aqiLevel(75).label).toBe("Poor");
  expect(aqiLevel(90).label).toBe("Very poor");
  expect(aqiLevel(120).label).toBe("Extremely poor");
  expect(uvLevel(2).label).toBe("Low");
  expect(uvLevel(4).label).toBe("Moderate");
  expect(uvLevel(7).label).toBe("High");
  expect(uvLevel(9).label).toBe("Very high");
  expect(uvLevel(12).label).toBe("Extreme");
});

test("healthAdvice picks the worse of air quality and UV", () => {
  expect(healthAdvice(10, 1)).toMatch(/great/i);
  expect(healthAdvice(10, 8)).toMatch(/sunscreen/i);
  expect(healthAdvice(110, 1)).toMatch(/outdoor/i);
  expect(healthAdvice(null, null)).toBe("");
  expect(healthAdvice(null, 8)).toMatch(/sunscreen/i);
});

test("getAirQuality parses european AQI and PM2.5", async () => {
  const f = vi.fn(() => ok({ current: { european_aqi: 42, pm2_5: 11.5 } }));
  expect(await getAirQuality({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch)).toEqual({ aqi: 42, pm25: 11.5 });
  expect(String((f.mock.calls[0] as unknown[])[0])).toContain("air-quality-api.open-meteo.com");
});

test("getAirQuality returns null on failure or missing data", async () => {
  const p = { name: "K", country: "N", latitude: 1, longitude: 2 };
  expect(await getAirQuality(p, (() => Promise.resolve({ ok: false, status: 500 } as Response)) as unknown as typeof fetch)).toBeNull();
  expect(await getAirQuality(p, (() => Promise.reject(new Error("net"))) as unknown as typeof fetch)).toBeNull();
  expect(await getAirQuality(p, (() => ok({})) as unknown as typeof fetch)).toBeNull();
});

test("getWeather reads today's UV index", async () => {
  const f = vi.fn(() => ok({
    current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], uv_index_max: [7.4] },
  }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.uv).toBe(7.4);
  expect(String((f.mock.calls[0] as unknown[])[0])).toContain("uv_index_max");
});

const hr = (h: number, rain?: number) => ({ time: `2026-10-08T${String(h).padStart(2, "0")}:00`, temp: 10, rain });

test("rainSummary reports the first likely rain hour", () => {
  expect(rainSummary([hr(13, 10), hr(14, 20), hr(15, 70), hr(16, 90)])).toBe("Rain likely around 3 pm (70%)");
  expect(rainSummary([hr(0, 50)])).toBe("Rain likely around 12 am (50%)");
});

test("rainSummary handles dry and missing data", () => {
  expect(rainSummary(Array.from({ length: 12 }, (_, i) => hr(i, 10)))).toBe("No rain expected in the next 12 hours");
  expect(rainSummary([hr(1), hr(2)])).toBe("");
  expect(rainSummary([])).toBe("");
});

test("getWeather includes hourly rain probability", async () => {
  const time = ["2026-10-08T10:00", "2026-10-08T11:00"];
  const f = () => ok({
    current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
    hourly: { time, temperature_2m: [1, 2], precipitation_probability: [5, 60] },
  });
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.hours.map((h) => h.rain)).toEqual([5, 60]);
});

test("sceneFor maps weather codes and time of day to a scene", () => {
  expect(sceneFor(0, true)).toBe("clear-day");
  expect(sceneFor(1, false)).toBe("clear-night");
  expect(sceneFor(2, true)).toBe("cloudy-day");
  expect(sceneFor(3, false)).toBe("cloudy-night");
  expect(sceneFor(45, true)).toBe("cloudy-day");
  expect(sceneFor(53, true)).toBe("rain-day");
  expect(sceneFor(82, false)).toBe("rain-night");
  expect(sceneFor(73, true)).toBe("snow-day");
  expect(sceneFor(77, false)).toBe("snow-night");
  expect(sceneFor(95, true)).toBe("storm-day");
  expect(sceneFor(99, false)).toBe("storm-night");
  expect(sceneFor(1234, true)).toBe("cloudy-day");
});

test("getWeather reads is_day, defaulting to day", async () => {
  const body = (current: object) => ({ current: { temperature_2m: 1, wind_speed_10m: 1, weather_code: 0, ...current }, daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [] } });
  const p = { name: "K", country: "N", latitude: 1, longitude: 2 };
  expect((await getWeather(p, (() => ok(body({ is_day: 0 }))) as unknown as typeof fetch)).isDay).toBe(false);
  expect((await getWeather(p, (() => ok(body({}))) as unknown as typeof fetch)).isDay).toBe(true);
});
