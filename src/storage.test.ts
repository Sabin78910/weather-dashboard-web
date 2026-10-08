import { loadLastCity, saveLastCity } from "./storage";

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
