import { mergeSettings, syncOnce, readCode, writeCode, SHARED_CODE_KEY, type SyncSettings, type SyncTransport } from "./settingsSync";
import { newSyncCode } from "./sync";

const mk = (o: Partial<SyncSettings>): SyncSettings => ({ favourites: [], unit: "C", theme: null, updatedAt: 1, ...o });

test("merge unions favourites case-insensitively, newest device's order first", () => {
  const local = mk({ favourites: ["Oslo", "Pokhara"], updatedAt: 1 });
  const remote = mk({ favourites: ["pokhara", "Kathmandu", "Oslo"], updatedAt: 2 });
  expect(mergeSettings(local, remote).favourites).toEqual(["pokhara", "Kathmandu", "Oslo"]);
  expect(mergeSettings(remote, local).favourites).toEqual(["pokhara", "Kathmandu", "Oslo"]);
});

test("merge appends cities only the older device has", () => {
  const merged = mergeSettings(mk({ favourites: ["A", "B"], updatedAt: 5 }), mk({ favourites: ["C", "A"], updatedAt: 1 }));
  expect(merged.favourites).toEqual(["A", "B", "C"]);
});

test("merge takes unit and theme from the newest device", () => {
  const merged = mergeSettings(mk({ unit: "F", theme: "dark", updatedAt: 9 }), mk({ unit: "C", theme: "light", updatedAt: 3 }));
  expect(merged).toMatchObject({ unit: "F", theme: "dark", updatedAt: 9 });
});

const fake = (remote: SyncSettings | null, pushes: unknown[] = []): SyncTransport => ({
  pull: async <T,>() => (remote ? ({ version: 4, value: remote as T }) : null),
  push: async (v) => { pushes.push(v); return { ok: true, version: 5 }; },
});

test("syncOnce pushes the first value when the server is empty", async () => {
  const pushes: unknown[] = [];
  const local = mk({ favourites: ["Oslo"] });
  const r = await syncOnce(fake(null, pushes), local);
  expect(r).toMatchObject({ changedLocal: false, pushed: true });
  expect(pushes).toEqual([local]);
});

test("syncOnce adopts remote changes without pushing when remote is a superset", async () => {
  const pushes: unknown[] = [];
  const remote = mk({ favourites: ["Oslo", "Pokhara"], unit: "F", updatedAt: 2 });
  const r = await syncOnce(fake(remote, pushes), mk({ favourites: ["Oslo"] }));
  expect(r).toMatchObject({ merged: remote, changedLocal: true, pushed: false });
  expect(pushes).toEqual([]);
});

test("syncOnce retries on a conflict and throws on other errors", async () => {
  let n = 0;
  const t: SyncTransport = {
    pull: async () => null,
    push: async () => (n++ === 0 ? { ok: false, conflict: true, version: 2 } : { ok: true, version: 3 }),
  };
  expect((await syncOnce(t, mk({}))).pushed).toBe(true);
  const bad: SyncTransport = { pull: async () => null, push: async () => ({ ok: false, conflict: false, error: "boom" }) };
  await expect(syncOnce(bad, mk({}))).rejects.toThrow("boom");
});

test("readCode/writeCode use the shared Sabin Labs key and reject invalid codes", () => {
  localStorage.clear();
  expect(readCode()).toBeNull();
  const code = newSyncCode();
  writeCode(code);
  expect(localStorage.getItem(SHARED_CODE_KEY)).toBe(code);
  expect(readCode()).toBe(code);
  localStorage.setItem(SHARED_CODE_KEY, "garbage");
  expect(readCode()).toBeNull();
  writeCode(null);
  expect(localStorage.getItem(SHARED_CODE_KEY)).toBeNull();
});
