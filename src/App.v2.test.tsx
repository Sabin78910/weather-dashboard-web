import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const hours = Array.from({ length: 48 }, (_, i) => `2026-10-0${i < 24 ? 8 : 9}T${String(i % 24).padStart(2, "0")}:00`);
const forecast = () => ({
  current: { time: "2026-10-08T10:15", temperature_2m: 21, wind_speed_10m: 5, weather_code: 1, is_day: 1, apparent_temperature: 17 },
  daily: { time: ["2026-10-08", "2026-10-09"], sunrise: ["2026-10-08T06:00", "2026-10-09T06:00"], sunset: ["2026-10-08T18:00", "2026-10-09T18:00"], temperature_2m_max: [25, 26], temperature_2m_min: [14, 15], weather_code: [1, 3] },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 10 + (i % 24)),
    precipitation_probability: hours.map((_, i) => (i === 15 ? 80 : 0)),
    weather_code: hours.map((_, i) => (i === 15 ? 63 : 1)),
    is_day: hours.map((_, i) => (i % 24 >= 6 && i % 24 < 18 ? 1 : 0)),
  },
  minutely_15: { time: ["2026-10-08T10:00", "2026-10-08T10:15", "2026-10-08T10:30", "2026-10-08T10:45", "2026-10-08T11:00"], precipitation: [0, 0, 0, 0.5, 0.8] },
});
const mockFetch = () =>
  vi.fn((url: string) => {
    if (url.includes("geocoding")) {
      const oslo = url.includes("Oslo");
      return json({ results: [{ name: oslo ? "Oslo" : "Pokhara", country: oslo ? "Norway" : "Nepal", latitude: 1, longitude: 2 }] });
    }
    if (url.includes("air-quality")) return json({});
    return json(forecast());
  });

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; });

test("instant paint: a cached city shows at once while it refreshes, then becomes the live hero", async () => {
  vi.stubGlobal("fetch", mockFetch());
  const { unmount } = render(<App />);
  await screen.findByRole("region", { name: "Current weather" });
  unmount();
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<App />);
  expect(screen.getByText("Pokhara, Nepal")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Current weather" })).not.toBeInTheDocument();
  expect(screen.getByTestId("skeleton")).toBeInTheDocument();
});

test("first visit shows the default city name with a skeleton, never an empty page", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<App />);
  expect(screen.getByText("Kathmandu")).toBeInTheDocument();
  expect(screen.getByTestId("skeleton")).toBeInTheDocument();
});

test("nowcast says when rain starts, in the hero and the precipitation card", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const hero = await screen.findByRole("region", { name: "Current weather" });
  expect(within(hero).getByText(/Rain starting in ~30 min/)).toBeInTheDocument();
  const card = screen.getByRole("region", { name: "Precipitation" });
  expect(within(card).getByText("Rain starting in ~30 min")).toBeInTheDocument();
  expect(within(card).getByRole("img", { name: "Rain intensity over the next 2 hours" })).toBeInTheDocument();
});

test("scrubbing the 24-hour timeline updates the readout and the sky, and Back to now resets", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const slider = await screen.findByRole("slider", { name: "Scrub through the next 24 hours" });
  expect(screen.getByTestId("sky")).toHaveClass("clear-day");
  fireEvent.change(slider, { target: { value: "5" } });
  expect(slider).toHaveAttribute("aria-valuetext", "15:00: 25°, Rain, rain 80%");
  expect(screen.getByTestId("sky")).toHaveClass("rain-day");
  await userEvent.click(screen.getByRole("button", { name: "Back to now" }));
  expect(screen.getByTestId("sky")).toHaveClass("clear-day");
  await userEvent.click(within(screen.getByRole("list", { name: "Hourly forecast" })).getAllByRole("button")[2]);
  expect(slider).toHaveValue("2");
});

test("favourites are swipeable city pages: next button and a left swipe both open the next city", async () => {
  localStorage.setItem("favourites", '["Oslo"]');
  const f = mockFetch();
  vi.stubGlobal("fetch", f);
  const { unmount } = render(<App />);
  await screen.findByText("Pokhara, Nepal");
  await userEvent.click(screen.getByRole("button", { name: "Next city" }));
  expect(await screen.findByText("Oslo, Norway")).toBeInTheDocument();
  expect(f.mock.calls.some((c) => String(c[0]).includes("name=Oslo"))).toBe(true);
  unmount();
  localStorage.setItem("lastCity", "Pokhara");
  render(<App />);
  const hero = await screen.findByRole("region", { name: "Current weather" });
  fireEvent.pointerDown(hero, { clientX: 300, clientY: 100, pointerType: "touch" });
  fireEvent.pointerMove(hero, { clientX: 220, clientY: 102, pointerType: "touch" });
  fireEvent.pointerUp(hero, { clientX: 150, clientY: 104, pointerType: "touch" });
  expect(await screen.findByText("Oslo, Norway")).toBeInTheDocument();
});

test("theme toggle and unit choice persist", async () => {
  vi.stubGlobal("fetch", mockFetch());
  const { unmount } = render(<App />);
  await screen.findByText("Pokhara, Nepal");
  await userEvent.click(screen.getByRole("button", { name: "Use light theme" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("button", { name: "Use dark theme" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch to °F" }));
  unmount();
  render(<App />);
  expect(await screen.findByText("70°F")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("10-day list starts with Today and the feels-like card explains the difference", async () => {
  vi.stubGlobal("fetch", mockFetch());
  render(<App />);
  const table = await screen.findByRole("table", { name: "Daily forecast" });
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent(/^Today/);
  const feels = screen.getByRole("region", { name: "Feels like" });
  expect(within(feels).getByText("17°")).toBeInTheDocument();
  expect(within(feels).getByText("Wind is making it feel cooler.")).toBeInTheDocument();
});
