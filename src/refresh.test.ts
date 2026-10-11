import { REFRESH_MS, isStale, canPoll, nextRefreshDelay, modelTime } from "./refresh";

test("data is stale only once it is 15 minutes old", () => {
  expect(REFRESH_MS).toBe(15 * 60_000);
  expect(isStale(1000, 1000 + REFRESH_MS - 1)).toBe(false);
  expect(isStale(1000, 1000 + REFRESH_MS)).toBe(true);
  expect(isStale(null, 5)).toBe(false);
});

test("polling needs a visible tab and a network connection", () => {
  expect(canPoll(true, true)).toBe(true);
  expect(canPoll(false, true)).toBe(false);
  expect(canPoll(true, false)).toBe(false);
});

test("next refresh is due 15 minutes after the data, never negative", () => {
  expect(nextRefreshDelay(0, 0)).toBe(REFRESH_MS);
  expect(nextRefreshDelay(0, 5 * 60_000)).toBe(10 * 60_000);
  expect(nextRefreshDelay(0, 20 * 60_000)).toBe(0);
});

test("modelTime extracts HH:MM from the API timestamp", () => {
  expect(modelTime("2026-10-08T10:15")).toBe("10:15");
  expect(modelTime(null)).toBeNull();
  expect(modelTime("bad")).toBeNull();
});
