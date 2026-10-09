import { loadLastCity, saveLastCity, loadFavourites, saveFavourites } from "./storage";

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
