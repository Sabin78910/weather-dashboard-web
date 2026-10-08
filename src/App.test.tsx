import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { loadLastCity, saveLastCity } from "./storage";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const mockFetch = () =>
  vi.fn((url: string) =>
    url.includes("geocoding")
      ? json({ results: [{ name: "Pokhara", country: "Nepal", latitude: 1, longitude: 2 }] })
      : json({
          current: { temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
          daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61] },
        }),
  );

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

test("auto-searches the saved city on load", async () => {
  saveLastCity("Pokhara");
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  render(<App />);
  expect(await screen.findByText("Pokhara, Nepal")).toBeInTheDocument();
  expect(String(f.mock.calls[0][0])).toContain("Pokhara");
});

test("does not search on load without a saved city", () => {
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  render(<App />);
  expect(f).not.toHaveBeenCalled();
});

test("saves the city after a successful search", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Pokhara, Nepal");
  expect(loadLastCity()).toBe("Kathmandu");
});

test("does not save a failed search", async () => {
  vi.stubGlobal("fetch", vi.fn(() => json({})));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("alert");
  expect(loadLastCity()).toBeNull();
});
