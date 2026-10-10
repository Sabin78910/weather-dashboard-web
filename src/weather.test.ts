import { shareSummary, describe as describeCode, findPlace, getWeather, convertTemp, iconKind, rangeBar, getAirQuality, aqiLevel, uvLevel, healthAdvice, rainSummary, sceneFor, dailyTips, formatPrecip, formatWind, visibleGust, formatPressure, formatVisibility, pressureTrend, compareWithYesterday, moonPhase, severeOutlook, uvWindow, SEVERE_HEAT_C, SEVERE_COLD_C, type DayForecast } from "./weather";

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
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], precipitation_probability_max: [80], precipitation_sum: [5.2] },
  });
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.days).toEqual([{ date: "2026-10-08", max: 25, min: 14, code: 61, rain: 80, precip: 5.2 }]);
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
  expect(url).toContain("precipitation_sum");
  expect(w.days[0].rain).toBeNull();
  expect(w.days[0].precip).toBeNull();
});

test("formatPrecip converts mm to inches and hides zero or missing", () => {
  expect(formatPrecip(5.24, "C")).toEqual({ value: 5.2, unit: "mm" });
  expect(formatPrecip(25.4, "F")).toEqual({ value: 1, unit: "in" });
  expect(formatPrecip(5, "F")).toEqual({ value: 0.2, unit: "in" });
  expect(formatPrecip(0, "C")).toBeNull();
  expect(formatPrecip(null, "C")).toBeNull();
});

test("iconKind maps codes and day/night to icon kinds", () => {
  expect(iconKind(0, true)).toBe("sun");
  expect(iconKind(1, false)).toBe("moon");
  expect(iconKind(2, true)).toBe("partly-cloudy");
  expect(iconKind(3, true)).toBe("cloud");
  expect(iconKind(45, true)).toBe("fog");
  expect(iconKind(63, true)).toBe("rain");
  expect(iconKind(81, true)).toBe("rain");
  expect(iconKind(73, true)).toBe("snow");
  expect(iconKind(95, true)).toBe("storm");
  expect(iconKind(1234, true)).toBe("cloud");
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

test("getWeather reads feels-like and humidity, null when missing", async () => {
  const body = (cur: object) => ({ current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2, ...cur }, daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] } });
  const p = { name: "K", country: "N", latitude: 1, longitude: 2 };
  const f = vi.fn(() => ok(body({ apparent_temperature: 19.5, relative_humidity_2m: 63 })));
  const w = await getWeather(p, f as unknown as typeof fetch);
  expect(w.feelsLike).toBe(19.5);
  expect(w.humidity).toBe(63);
  const url = String((f.mock.calls[0] as unknown[])[0]);
  expect(url).toContain("apparent_temperature");
  expect(url).toContain("relative_humidity_2m");
  const m = await getWeather(p, (() => ok(body({}))) as unknown as typeof fetch);
  expect(m.feelsLike).toBeNull();
  expect(m.humidity).toBeNull();
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

import { sunProgress, arcPoint, gaugeFraction, compassPoint } from "./weather";

test("sunProgress maps time to daylight fraction and clamps", () => {
  const [r, s] = ["2026-10-08T06:00", "2026-10-08T18:00"];
  expect(sunProgress("2026-10-08T05:00", r, s)).toBe(0);
  expect(sunProgress("2026-10-08T09:00", r, s)).toBe(0.25);
  expect(sunProgress("2026-10-08T12:00", r, s)).toBe(0.5);
  expect(sunProgress("2026-10-08T23:00", r, s)).toBe(1);
  expect(sunProgress("2026-10-08T12:00", s, r)).toBe(0);
});

test("arcPoint places the sun on the semicircle", () => {
  const left = arcPoint(0, 50, 50, 40);
  const mid = arcPoint(0.5, 50, 50, 40);
  const right = arcPoint(1, 50, 50, 40);
  expect(left.x).toBeCloseTo(10);
  expect(left.y).toBeCloseTo(50);
  expect(mid.x).toBeCloseTo(50);
  expect(mid.y).toBeCloseTo(10);
  expect(right.x).toBeCloseTo(90);
  expect(right.y).toBeCloseTo(50);
});

test("gaugeFraction maps values to 0–1", () => {
  expect(gaugeFraction(0, 11)).toBe(0);
  expect(gaugeFraction(5.5, 11)).toBe(0.5);
  expect(gaugeFraction(20, 11)).toBe(1);
  expect(gaugeFraction(-3, 11)).toBe(0);
  expect(gaugeFraction(3, 0)).toBe(0);
});

test("compassPoint names wind directions", () => {
  expect(compassPoint(0)).toBe("N");
  expect(compassPoint(350)).toBe("N");
  expect(compassPoint(90)).toBe("E");
  expect(compassPoint(225)).toBe("SW");
  expect(compassPoint(-90)).toBe("W");
});

describe("dailyTips", () => {
  const base: Parameters<typeof dailyTips>[0] = { temperature: 20, code: 1, days: [{ date: "d", max: 24, min: 16, code: 1, rain: 10, precip: null }], hours: [{ time: "2026-10-08T10:00", temp: 20 }, { time: "2026-10-08T11:00", temp: 19 }], uv: 2 };
  const ids = (w: Partial<typeof base>, aqi: number | null = 20) => dailyTips({ ...base, ...w }, aqi).map((t) => t.id);

  test("umbrella when today's rain chance is 50%+", () => {
    expect(ids({ days: [{ ...base.days[0], rain: 50 }] })).toContain("umbrella");
    expect(ids({ days: [{ ...base.days[0], rain: 49 }] })).not.toContain("umbrella");
  });
  test("sunscreen when UV is 6+", () => {
    expect(ids({ uv: 6 })).toContain("sunscreen");
    expect(ids({ uv: 5.9 })).not.toContain("sunscreen");
    expect(ids({ uv: null })).not.toContain("sunscreen");
  });
  test("mask when air quality is poor (AQI 60+)", () => {
    expect(ids({}, 60)).toContain("mask");
    expect(ids({}, 59)).not.toContain("mask");
    expect(ids({}, null)).not.toContain("mask");
  });
  test("jacket when temperature drops 8°+ in the coming hours", () => {
    const hours = [{ time: "t1", temp: 20 }, { time: "t2", temp: 12 }];
    expect(ids({ hours })).toContain("jacket");
    expect(ids({ hours: [{ time: "t1", temp: 20 }, { time: "t2", temp: 13 }] })).not.toContain("jacket");
  });
  test("great day outside only when nothing else applies and weather is pleasant", () => {
    expect(ids({})).toEqual(["great"]);
    expect(ids({ uv: 7 })).not.toContain("great");
    expect(ids({ code: 61 })).not.toContain("great");
    expect(ids({ temperature: 35, days: [{ ...base.days[0], max: 36 }] })).not.toContain("great");
  });
});

test("shareSummary builds a text summary in the chosen unit", () => {
  const w = { temperature: 21, code: 2, days: [{ date: "d", max: 25, min: 14, code: 61, rain: 80, precip: null }] };
  const p = { name: "Pokhara", country: "Nepal", latitude: 1, longitude: 2 };
  expect(shareSummary(p, w, "C")).toBe("Today in Pokhara, Nepal: Partly cloudy, 21°C. H:25° L:14°");
  expect(shareSummary(p, w, "F")).toBe("Today in Pokhara, Nepal: Partly cloudy, 70°F. H:77° L:57°");
});

test("getWeather requests wind_gusts_10m and exposes gust (null when missing)", async () => {
  const daily = { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] };
  const f = vi.fn(() => ok({ current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2, wind_gusts_10m: 45 }, daily }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(String((f.mock.calls[0] as unknown[])[0])).toContain("wind_gusts_10m");
  expect(w.gust).toBe(45);
  const g = vi.fn(() => ok({ current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 }, daily }));
  expect((await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, g as unknown as typeof fetch)).gust).toBeNull();
});

test("visibleGust needs data and at least 5 km/h above sustained wind", () => {
  expect(visibleGust(10, null)).toBeNull();
  expect(visibleGust(10, 14.9)).toBeNull();
  expect(visibleGust(10, 15)).toBe(15);
  expect(visibleGust(10, 45)).toBe(45);
});

test("formatWind converts km/h to rounded mph for °F and rounds km/h for °C", () => {
  expect(formatWind(0, "F")).toEqual({ value: 0, unit: "mph" });
  expect(formatWind(16.09344, "F")).toEqual({ value: 10, unit: "mph" });
  expect(formatWind(10, "F")).toEqual({ value: 6, unit: "mph" });
  expect(formatWind(5, "C")).toEqual({ value: 5, unit: "kmh" });
  expect(formatWind(5.4, "C")).toEqual({ value: 5, unit: "kmh" });
});

test("getWeather requests past_days=1 and keeps today first with yesterday's max", async () => {
  const f = vi.fn(() => ok({
    current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: {
      time: ["2026-10-07", "2026-10-08", "2026-10-09"], sunrise: ["a", "b", "c"], sunset: ["d", "e", "f"], uv_index_max: [1, 7, 3],
      temperature_2m_max: [20, 25, 26], temperature_2m_min: [10, 14, 15], weather_code: [1, 61, 2],
    },
  }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(String((f.mock.calls[0] as unknown[])[0])).toContain("past_days=1");
  expect(w.days.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-09"]);
  expect(w.yesterdayMax).toBe(20);
  expect(w.sunrise).toBe("b");
  expect(w.sunset).toBe("e");
  expect(w.uv).toBe(7);
});

test("getWeather yesterdayMax is null without past data", async () => {
  const f = () => ok({
    current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
  });
  expect((await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch)).yesterdayMax).toBeNull();
});

test("compareWithYesterday classifies and rounds the difference", () => {
  expect(compareWithYesterday(25, 22)).toEqual({ trend: "warmer", diff: 3 });
  expect(compareWithYesterday(20, 22.4)).toEqual({ trend: "cooler", diff: 2 });
  expect(compareWithYesterday(22.9, 22)).toEqual({ trend: "same", diff: 0 });
  expect(compareWithYesterday(21.1, 22)).toEqual({ trend: "same", diff: 0 });
  expect(compareWithYesterday(23, 22)).toEqual({ trend: "warmer", diff: 1 });
  expect(compareWithYesterday(21, 22)).toEqual({ trend: "cooler", diff: 1 });
  expect(compareWithYesterday(23.4, 22)).toEqual({ trend: "warmer", diff: 1 });
});

test("formatPressure gives whole hPa for °C and 2-decimal inHg for °F", () => {
  expect(formatPressure(1013.4, "C")).toEqual({ value: 1013, unit: "hPa" });
  expect(formatPressure(1013.25, "F")).toEqual({ value: 29.92, unit: "inHg" });
});

test("formatVisibility converts metres to km or miles with 1 decimal", () => {
  expect(formatVisibility(10000, "C")).toEqual({ value: 10, unit: "km" });
  expect(formatVisibility(8450, "C")).toEqual({ value: 8.5, unit: "km" });
  expect(formatVisibility(10000, "F")).toEqual({ value: 6.2, unit: "mi" });
  expect(formatVisibility(0, "C")).toEqual({ value: 0, unit: "km" });
});

test("pressureTrend: steady under 1 hPa change, rising/falling at the boundary, null when unknown", () => {
  expect(pressureTrend(null)).toBeNull();
  expect(pressureTrend(0.9)).toBe("steady");
  expect(pressureTrend(-0.9)).toBe("steady");
  expect(pressureTrend(1)).toBe("rising");
  expect(pressureTrend(-1)).toBe("falling");
});

test("getWeather reads pressure, visibility and 3h pressure change, null when missing", async () => {
  const p = { name: "K", country: "N", latitude: 1, longitude: 2 };
  const body = (cur: object, hourly: object) => ({
    current: { time: "2026-10-08T05:10", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2, ...cur },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
    hourly: { time: Array.from({ length: 6 }, (_, i) => `2026-10-08T0${i}:00`), temperature_2m: [1, 2, 3, 4, 5, 6], ...hourly },
  });
  const f = vi.fn(() => ok(body({ pressure_msl: 1015, visibility: 24000 }, { pressure_msl: [1010, 1011, 1012, 1013, 1014, 1015] })));
  const w = await getWeather(p, f as unknown as typeof fetch);
  expect(w.pressure).toBe(1015);
  expect(w.visibility).toBe(24000);
  expect(w.pressureDelta).toBe(3);
  const url = String((f.mock.calls[0] as unknown[])[0]);
  expect(url).toContain("pressure_msl");
  expect(url).toContain("visibility");
  const m = await getWeather(p, (() => ok(body({}, {}))) as unknown as typeof fetch);
  expect(m.pressure).toBeNull();
  expect(m.visibility).toBeNull();
  expect(m.pressureDelta).toBeNull();
});

test("moonPhase matches known new and full moons and wraps the cycle", () => {
  const newMoon = moonPhase(new Date("2024-01-11T11:57:00Z"));
  expect(newMoon.name).toBe("new");
  expect(newMoon.illumination).toBeLessThan(0.01);
  const full = moonPhase(new Date("2024-01-25T17:54:00Z"));
  expect(full.name).toBe("full");
  expect(full.illumination).toBeGreaterThan(0.99);
  expect(moonPhase(new Date("2024-01-18T03:53:00Z")).name).toBe("firstQuarter");
  expect(moonPhase(new Date("2024-02-02T23:18:00Z")).name).toBe("lastQuarter");
  expect(moonPhase(new Date("2024-01-08T00:00:00Z")).name).toBe("waningCrescent");
  for (const d of ["1990-05-05T00:00:00Z", "2000-01-06T18:14:00Z", "2030-12-31T00:00:00Z"]) {
    const { phase } = moonPhase(new Date(d));
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  }
});

const day = (date: string, o: Partial<DayForecast> = {}): DayForecast => ({ date, max: 20, min: 10, code: 1, rain: null, precip: null, ...o });

test("severeOutlook returns null when nothing is severe", () => {
  expect(severeOutlook([day("2026-10-08"), day("2026-10-09", { code: 63 })], "C")).toBeNull();
  expect(severeOutlook([], "C")).toBeNull();
});

test("severeOutlook detects each severe type and returns the first day", () => {
  expect(severeOutlook([day("a"), day("b", { code: 96 })], "C")).toEqual({ date: "b", kind: "storm", temp: null });
  expect(severeOutlook([day("a", { code: 75 })], "C")?.kind).toBe("snow");
  expect(severeOutlook([day("a", { code: 67 })], "C")?.kind).toBe("snow");
  expect(severeOutlook([day("a", { code: 86 })], "C")?.kind).toBe("snow");
  expect(severeOutlook([day("a"), day("b", { max: SEVERE_HEAT_C })], "C")).toEqual({ date: "b", kind: "heat", temp: SEVERE_HEAT_C });
  expect(severeOutlook([day("a", { min: SEVERE_COLD_C })], "C")).toEqual({ date: "a", kind: "cold", temp: SEVERE_COLD_C });
  expect(severeOutlook([day("a", { max: SEVERE_HEAT_C - 1, min: SEVERE_COLD_C + 1 })], "C")).toBeNull();
  expect(severeOutlook([day("a", { code: 95, max: 45 }), day("b", { code: 75 })], "C")?.kind).toBe("storm");
});

test("severeOutlook only looks at the next 7 days and converts temperature for °F", () => {
  const days = Array.from({ length: 8 }, (_, i) => day(`d${i}`, i === 7 ? { code: 99 } : {}));
  expect(severeOutlook(days, "C")).toBeNull();
  expect(severeOutlook([day("a", { max: 40 })], "F")).toEqual({ date: "a", kind: "heat", temp: 104 });
  expect(severeOutlook([day("a", { min: -20 })], "F")).toEqual({ date: "a", kind: "cold", temp: -4 });
});

import { dayLength, daylightChange } from "./weather";
test("dayLength gives whole minutes, null when missing or inverted", () => {
  expect(dayLength("2026-10-08T06:00", "2026-10-08T17:42")).toBe(702);
  expect(dayLength(undefined, "2026-10-08T17:42")).toBeNull();
  expect(dayLength("2026-10-08T06:00", "x")).toBeNull();
  expect(dayLength("2026-10-08T18:00", "2026-10-08T06:00")).toBeNull();
});
test("daylightChange is longer, shorter, equal or null", () => {
  expect(daylightChange(702, 700)).toBe(2);
  expect(daylightChange(698, 700)).toBe(-2);
  expect(daylightChange(700, 700)).toBe(0);
  expect(daylightChange(null, 700)).toBeNull();
  expect(daylightChange(700, null)).toBeNull();
});

test("uvWindow returns the span where UV >= 3, or null", () => {
  const h = (uvs: (number | null)[]) => uvs.map((uv, i) => ({ time: `2026-10-08T${String(i + 8).padStart(2, "0")}:00`, uv }));
  expect(uvWindow([])).toBeNull();
  expect(uvWindow(h([0, 1, 2.9]))).toBeNull();
  expect(uvWindow(h([1, 3, 2]))).toEqual({ start: "09:00", end: "09:00" });
  expect(uvWindow(h([1, 3, 5, 7, 4, 2]))).toEqual({ start: "09:00", end: "12:00" });
  expect(uvWindow(h([null, 4, null, 3, 1]))).toEqual({ start: "09:00", end: "11:00" });
});

test("getWeather requests hourly uv_index and keeps only today's values", async () => {
  const f = vi.fn(() => ok({
    current: { time: "2026-10-08T10:00", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
    hourly: { time: ["2026-10-08T09:00", "2026-10-08T10:00", "2026-10-09T10:00"], temperature_2m: [1, 2, 3], uv_index: [2, 4, 9] },
  }));
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(String((f.mock.calls[0] as unknown[])[0])).toMatch(/hourly=[^&]*uv_index/);
  expect(w.uvHours).toEqual([{ time: "2026-10-08T09:00", uv: 2 }, { time: "2026-10-08T10:00", uv: 4 }]);
});
