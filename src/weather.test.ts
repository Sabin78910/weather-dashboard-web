import { convertTemp, describe as describeCode, findPlace, formatTemp, getWeather } from "./weather";

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
    daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
  });
  const w = await getWeather({ name: "K", country: "N", latitude: 1, longitude: 2 }, f as unknown as typeof fetch);
  expect(w.days).toEqual([{ date: "2026-10-08", max: 25, min: 14, code: 61 }]);
});

test("convertTemp converts between units", () => {
  expect(convertTemp(0, "C")).toBe(0);
  expect(convertTemp(100, "F")).toBe(212);
  expect(convertTemp(-40, "F")).toBe(-40);
  expect(convertTemp(21, "C")).toBe(21);
});

test("formatTemp rounds and appends unit", () => {
  expect(formatTemp(21.4, "C")).toBe("21°C");
  expect(formatTemp(21.4, "F")).toBe("71°F");
  expect(formatTemp(21.4, "C", false)).toBe("21°");
});
