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
