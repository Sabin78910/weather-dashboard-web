import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { loadLastCity, saveLastCity } from "./storage";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const mockFetch = () =>
  vi.fn((url: string) =>
    url.includes("geocoding")
      ? json({ results: [{ name: "Pokhara", country: "Nepal", latitude: 1, longitude: 2 }] })
      : json({
          current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
          daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], precipitation_probability_max: [80] },
          hourly: {
            time: Array.from({ length: 24 }, (_, i) => `2026-10-08T${String(i).padStart(2, "0")}:00`),
            temperature_2m: Array.from({ length: 24 }, (_, i) => i * 10),
          },
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

test("my location button loads weather for current position", async () => {
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition) },
  });
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(await screen.findByText("My location")).toBeInTheDocument();
  expect(String(f.mock.calls[0][0])).toContain("latitude=1");
});

test("my location shows a message when permission is denied", async () => {
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: (_: PositionCallback, err: PositionErrorCallback) => err({ code: 1 } as GeolocationPositionError) },
  });
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/location/i);
});

test("my location shows a message when geolocation is unsupported", async () => {
  vi.stubGlobal("navigator", {});
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/not supported/i);
});

test("unit toggle switches all temperatures between °C and °F", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByText("21°C")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °F" }));
  expect(screen.getByText("70°F")).toBeInTheDocument();
  expect(screen.getByText("77°")).toBeInTheDocument();
  expect(screen.getByText("57°")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °C" }));
  expect(screen.getByText("21°C")).toBeInTheDocument();
});

test("shows the next 12 hours in a table and respects the unit", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const table = await screen.findByRole("table", { name: "Hourly forecast" });
  expect(within(table).getAllByRole("row")).toHaveLength(13);
  expect(within(table).getByText("100°")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °F" }));
  expect(within(table).getByText("212°")).toBeInTheDocument();
});

test("forecast tables have captions and scope=col headers", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const tables = await screen.findAllByRole("table");
  expect(tables).toHaveLength(2);
  for (const t of tables) {
    expect(t.querySelector("caption")).toBeInTheDocument();
    const headers = within(t).getAllByRole("columnheader");
    headers.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  }
  expect(screen.getByRole("table", { name: "Hourly forecast" })).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Daily forecast" })).toBeInTheDocument();
});

test("daily forecast shows icon, rain chance and a range bar, in the chosen unit", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const table = await screen.findByRole("table", { name: "Daily forecast" });
  expect(within(table).getByText("80%")).toBeInTheDocument();
  expect(within(table).getByRole("img", { name: "Light rain" })).toBeInTheDocument();
  expect(within(table).getByRole("meter", { name: "14° to 25°C" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °F" }));
  expect(within(table).getByRole("meter", { name: "57° to 77°F" })).toBeInTheDocument();
});

test("loading state is announced via a polite live region", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toBeEmptyDOMElement();
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Pokhara, Nepal");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

test("live region says loading while a request is pending", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading weather…");
});
