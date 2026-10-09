import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { loadLastCity, saveLastCity } from "./storage";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const mockFetch = () =>
  vi.fn((url: string) =>
    url.includes("geocoding")
      ? json({ results: [{ name: "Pokhara", country: "Nepal", latitude: 1, longitude: 2 }] })
      : json({
          current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2, wind_direction_10m: 90 },
          daily: { time: ["2026-10-08"], sunrise: ["2026-10-08T06:00"], sunset: ["2026-10-08T18:00"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], precipitation_probability_max: [80] },
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

test("fetches the default city (Kathmandu) on mount without a saved city", async () => {
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  render(<App />);
  expect(await screen.findByText("Pokhara, Nepal")).toBeInTheDocument();
  expect(String(f.mock.calls[0][0])).toContain("Kathmandu");
});

test("hero shows temperature, condition, high and low", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const hero = await screen.findByRole("region", { name: "Current weather" });
  expect(within(hero).getByText("21°C")).toBeInTheDocument();
  expect(within(hero).getByText(/H:25°/)).toBeInTheDocument();
  expect(within(hero).getByText(/L:14°/)).toBeInTheDocument();
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
  expect(f.mock.calls.some((c) => String(c[0]).includes("latitude=1"))).toBe(true);
});

test("my location shows a message when permission is denied", async () => {
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: (_: PositionCallback, err: PositionErrorCallback) => err({ code: 1 } as GeolocationPositionError) },
  });
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await screen.findByText("Pokhara, Nepal");
  await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/location/i);
});

test("my location shows a message when geolocation is unsupported", async () => {
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await screen.findByText("Pokhara, Nepal");
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

test("shows the next 12 hours in a strip and respects the unit", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const strip = await screen.findByRole("list", { name: "Hourly forecast" });
  expect(within(strip).getAllByRole("listitem")).toHaveLength(12);
  expect(within(strip).getByText("100°")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °F" }));
  expect(within(strip).getByText("212°")).toBeInTheDocument();
});

test("daily forecast table has a caption and scope=col headers", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const tables = await screen.findAllByRole("table");
  expect(tables).toHaveLength(1);
  expect(tables[0].querySelector("caption")).toBeInTheDocument();
  within(tables[0]).getAllByRole("columnheader").forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  expect(screen.getByRole("table", { name: "Daily forecast" })).toBeInTheDocument();
});

test("shows wind compass, sunrise/sunset and gauge cards", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const wind = await screen.findByRole("region", { name: "Wind" });
  expect(within(wind).getByText(/5 km\/h · E/)).toBeInTheDocument();
  const sun = screen.getByRole("region", { name: "Sunrise and sunset" });
  expect(within(sun).getByText(/06:00/)).toBeInTheDocument();
  expect(within(sun).getByText(/18:00/)).toBeInTheDocument();
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
  await screen.findByText("Pokhara, Nepal");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

test("live region says loading while a request is pending", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading weather…");
});

const withAir = (air: () => Promise<Response>) =>
  vi.fn((url: string) => {
    if (url.includes("air-quality")) return air();
    if (url.includes("geocoding")) return json({ results: [{ name: "Pokhara", country: "Nepal", latitude: 1, longitude: 2 }] });
    return json({
      current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 2 },
      daily: { time: ["2026-10-08"], temperature_2m_max: [25], temperature_2m_min: [14], weather_code: [61], uv_index_max: [8] },
    });
  });

test("shows an air quality and UV card with advice", async () => {
  vi.stubGlobal("fetch", withAir(() => json({ current: { european_aqi: 42, pm2_5: 11.5 } })));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const card = await screen.findByRole("region", { name: "Air quality" });
  expect(await within(card).findByText(/AQI 42/)).toBeInTheDocument();
  expect(within(card).getByText(/PM2\.5 11\.5/)).toBeInTheDocument();
  expect(within(card).getByRole("meter", { name: "Air quality index" })).toHaveAttribute("aria-valuenow", "42");
  const uv = screen.getByRole("region", { name: "UV index" });
  expect(within(uv).getByText(/UV 8/)).toBeInTheDocument();
  expect(within(uv).getByRole("meter", { name: "UV level" })).toHaveAttribute("aria-valuenow", "8");
  expect(within(uv).getByText(/sunscreen/i)).toBeInTheDocument();
});

test("still shows weather and UV when the air quality API fails", async () => {
  vi.stubGlobal("fetch", withAir(() => Promise.resolve({ ok: false, status: 500 } as Response)));
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const card = await screen.findByRole("region", { name: "Air quality" });
  expect(within(card).getByText(/Air quality unavailable/)).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "UV index" })).getByText(/UV 8/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("stars a city, persists it, switches via chip and removes it", async () => {
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await userEvent.click(await screen.findByRole("button", { name: "Save Pokhara to favourites" }));
  expect(JSON.parse(localStorage.getItem("favourites")!)).toEqual(["Pokhara"]);
  const chip = screen.getByRole("button", { name: "Pokhara" });
  const before = f.mock.calls.length;
  await userEvent.click(chip);
  await screen.findByText("Pokhara, Nepal");
  expect(f.mock.calls.length).toBeGreaterThan(before);
  await userEvent.click(screen.getByRole("button", { name: "Remove Pokhara from favourites" }));
  expect(screen.queryByRole("button", { name: "Pokhara" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("favourites")!)).toEqual([]);
});

test("loads favourites from storage", () => {
  localStorage.setItem("favourites", '["Oslo"]');
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  expect(screen.getByRole("button", { name: "Oslo" })).toBeInTheDocument();
});

test("renders a sky scene matching the weather", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  expect(screen.getByTestId("sky")).toHaveClass("none");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText(/Nepal/);
  expect(screen.getByTestId("sky")).toHaveClass("cloudy-day");
});

test("shows skeleton cards while loading, hidden from assistive tech", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<App />);
  const sk = await screen.findByTestId("skeleton");
  expect(sk).toHaveAttribute("aria-hidden", "true");
  expect(sk.querySelectorAll(".skeleton").length).toBeGreaterThan(2);
});

test("error card is friendly and Retry re-runs the search", async () => {
  vi.useFakeTimers();
  try {
    let fail = true;
    const ok = mockFetch();
    vi.stubGlobal("fetch", vi.fn((url: string) => (fail ? Promise.reject(new Error("Network down")) : ok(url))));
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(22000));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Can't reach the weather service right now");
    expect(alert).not.toHaveTextContent("Network down");
    expect(within(alert).getByRole("img")).toBeInTheDocument();
    fail = false;
    await act(async () => { within(alert).getByRole("button", { name: "Retry" }).click(); });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("retries with 2s, 5s and 15s backoff before showing the error", async () => {
  vi.useFakeTimers();
  try {
    const f = vi.fn(() => Promise.reject(new Error("boom")));
    vi.stubGlobal("fetch", f);
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(f).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/retrying/i)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(f).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(f).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(f).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(f).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(14999));
    expect(f).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(f).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the weather service right now");
  } finally {
    vi.useRealTimers();
  }
});

test("a later success during retries clears the error and keeps the forecast visible meanwhile", async () => {
  vi.useFakeTimers();
  try {
    const ok = mockFetch();
    let fail = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => (fail ? Promise.reject(new Error("boom")) : ok(url))));
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
    fail = true;
    await act(async () => { screen.getByRole("button", { name: "Search" }).click(); });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    fail = false;
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/retrying/i)).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("daily forecast renders an SVG icon labelled with the condition", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const table = await screen.findByRole("table");
  const icon = within(table).getByRole("img", { name: "Light rain" });
  expect(icon.tagName.toLowerCase()).toBe("svg");
  expect(icon).toHaveAttribute("data-icon", "rain");
});

test("shows tip cards for today", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  const tips = await screen.findByRole("region", { name: "Tips for today" });
  expect(within(tips).getByText(/umbrella/i)).toBeInTheDocument();
});

test("shows the cached forecast with a last-updated note when offline", async () => {
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  const { unmount } = render(<App />);
  expect(await screen.findByText("Pokhara, Nepal")).toBeInTheDocument();
  unmount();
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
  vi.useFakeTimers();
  try {
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(22000));
  } finally {
    vi.useRealTimers();
  }
  expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
  expect(screen.getByText(/Offline · last updated/)).toBeInTheDocument();
});

test("install button appears on beforeinstallprompt and triggers the prompt", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  await screen.findByText("Pokhara, Nepal");
  expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  const prompt = vi.fn(() => Promise.resolve());
  const ev = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  act(() => { window.dispatchEvent(ev); });
  await userEvent.click(await screen.findByRole("button", { name: "Install app" }));
  expect(prompt).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument());
});

test("share button uses the Web Share API with text and link", async () => {
  vi.stubGlobal("fetch", mockFetch());
  const share = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  render(<App />);
  await screen.findByText("Pokhara, Nepal");
  await userEvent.click(screen.getByRole("button", { name: "Share forecast" }));
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Pokhara, Nepal"), url: window.location.href }));
  delete (navigator as { share?: unknown }).share;
});

test("share button falls back to copying to the clipboard", async () => {
  vi.stubGlobal("fetch", mockFetch());
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<App />);
  await screen.findByText("Pokhara, Nepal");
  await userEvent.click(screen.getByRole("button", { name: "Share forecast" }));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Pokhara, Nepal"));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining(window.location.href));
  expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
});
