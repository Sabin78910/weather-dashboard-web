import { loadLastCity, saveLastCity, loadFavourites, saveFavourites, loadForecast, saveForecast } from "./storage";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test("round-trips the last city", () => {
  expect(loadLastCity()).toBeNull();
  saveLastCity("Pokhara");
  expect(loadLastCity()).toBe("Pokhara");
});

test("does not throw when storage fails", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(loadLastCity()).toBeNull();
  expect(() => saveLastCity("X")).not.toThrow();
});

test("round-trips favourites", () => {
  expect(loadFavourites()).toEqual([]);
  saveFavourites(["Pokhara", "Oslo"]);
  expect(loadFavourites()).toEqual(["Pokhara", "Oslo"]);
});

test("favourites ignore corrupt data and storage errors", () => {
  localStorage.setItem("favourites", "{bad");
  expect(loadFavourites()).toEqual([]);
  localStorage.setItem("favourites", '{"a":1}');
  expect(loadFavourites()).toEqual([]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(() => saveFavourites(["X"])).not.toThrow();
});

test("round-trips the last forecast and ignores corrupt data", () => {
  expect(loadForecast()).toBeNull();
  const snap = { place: { name: "Oslo", country: "Norway", latitude: 1, longitude: 2 }, weather: { temperature: 3 }, savedAt: 1000 };
  saveForecast(snap as never);
  expect(loadForecast()).toEqual(snap);
  localStorage.setItem("lastForecast", "{bad");
  expect(loadForecast()).toBeNull();
  localStorage.setItem("lastForecast", '{"foo":1}');
  expect(loadForecast()).toBeNull();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(() => saveForecast(snap as never)).not.toThrow();
});

test("per-city forecast cache is case-insensitive, keeps the newest 8 and survives storage errors", async () => {
  const { loadCityForecast, saveCityForecast, CITY_CACHE_MAX } = await import("./storage");
  const snap = (name: string, savedAt: number) => ({ place: { name, country: "", latitude: 0, longitude: 0 }, weather: { temperature: 1 }, savedAt }) as never;
  expect(loadCityForecast("Oslo")).toBeNull();
  saveCityForecast(["oslo ", "Oslo"], snap("Oslo", 1));
  expect(loadCityForecast("OSLO")).toEqual(snap("Oslo", 1));
  for (let i = 2; i <= CITY_CACHE_MAX + 1; i++) saveCityForecast([`c${i}`], snap(`c${i}`, i));
  expect(loadCityForecast("Oslo")).toBeNull();
  expect(loadCityForecast(`c${CITY_CACHE_MAX + 1}`)).not.toBeNull();
  localStorage.setItem("forecastCache", '{"x":{"bad":1},"y":5}');
  expect(loadCityForecast("x")).toBeNull();
  localStorage.setItem("forecastCache", "[1]");
  expect(loadCityForecast("x")).toBeNull();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(() => saveCityForecast(["a"], snap("a", 1))).not.toThrow();
});

test("unit and theme preferences persist and reject junk", async () => {
  const { loadUnit, saveUnit, loadTheme, saveTheme } = await import("./storage");
  expect(loadUnit()).toBeNull();
  saveUnit("F");
  expect(loadUnit()).toBe("F");
  localStorage.setItem("unit", "K");
  expect(loadUnit()).toBeNull();
  expect(loadTheme()).toBeNull();
  saveTheme("light");
  expect(loadTheme()).toBe("light");
  localStorage.setItem("theme", "neon");
  expect(loadTheme()).toBeNull();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  expect(loadUnit()).toBeNull();
  expect(loadTheme()).toBeNull();
});
