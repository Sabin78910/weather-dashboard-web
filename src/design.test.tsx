import { render, screen } from "@testing-library/react";
import css from "./index.css?raw";
import { celestialPos } from "./components/SkyCanvas";
import { AirCard, PressureCard, SunCard } from "./components/Cards";
import { t } from "./i18n";
import type { Fmt } from "./components/fmt";

const rule = (sel: string) => {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : "";
};

test("celestial bodies stay in the top band so they never sit behind the temperature", () => {
  const p = celestialPos(390, 844, 0.5, 1);
  expect(p.y).toBeLessThanOrEqual(96);
  expect(celestialPos(1280, 800, 0.5, 0).y).toBeLessThanOrEqual(96);
});

test("sky covers the full viewport and the page backdrop follows it", () => {
  expect(rule(".sky")).toMatch(/height:\s*100lvh/);
  expect(rule("html")).toMatch(/var\(--page-bottom/);
});

test("sync summary and light glass use theme-aware colours", () => {
  expect(rule(".sync-panel summary")).toMatch(/color:\s*(var\(--ink|#fff)/);
  expect(rule(".sync-panel")).toMatch(/background:\s*var\(--chrome\)/);
  expect(css).toMatch(/--glass:\s*rgba\(255, 255, 255, 0\.[78]\d?\)/);
  expect(css).toMatch(/--glass-tint/);
});

test("cards size to content instead of stretching", () => {
  expect(rule(".bento")).toMatch(/align-items:\s*start/);
  expect(rule(".card.small")).not.toMatch(/min-height:\s*1/);
  expect(rule(".daily-card")).not.toMatch(/grid-row/);
});

test("desktop hero is sticky and full height", () => {
  expect(css).toMatch(/\.hero \{[^}]*position: sticky[^}]*min-height: calc\(100svh/);
});

test("hero meta uses two tiers", () => {
  expect(rule(".hero-meta")).toMatch(/font-size:\s*13px/);
});

const f: Fmt = { lang: "en", unit: "C", L: (k, p) => t("en", k, p), n: (v) => String(v), temp: (c) => String(Math.round(c)) };

test("unavailable air quality collapses to a compact card", () => {
  render(<AirCard air={null} f={f} />);
  expect(screen.getByLabelText("Air quality")).toHaveClass("compact");
});

test("sun card spans full width", () => {
  const w = { now: "2026-06-01T12:00", sunrise: "2026-06-01T05:00", sunset: "2026-06-01T21:00", daylightMin: 960, daylightDeltaMin: 2 } as never;
  render(<SunCard weather={w} f={f} />);
  expect(screen.getByLabelText(/sun/i)).toHaveClass("wide");
});

test("pressure keeps its trend label with its value", () => {
  const w = { pressure: 1013, pressureDelta: 0, visibility: null } as never;
  const { container } = render(<PressureCard weather={w} f={f} />);
  const group = container.querySelector(".trend-group");
  expect(group?.textContent).toMatch(/→/);
});
