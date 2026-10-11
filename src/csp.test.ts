import { CSP, injectCsp } from "./csp";
import html from "../index.html?raw";

test("CSP allows only same-origin code the Open-Meteo APIs and the sync API", () => {
  expect(CSP).toContain("script-src 'self'");
  expect(CSP).toContain("object-src 'none'");
  expect(CSP).not.toMatch(/unsafe-(inline|eval)/);
  const hosts = CSP.match(/https:\/\/[^\s;]+/g);
  expect(hosts).toEqual(["https://api.open-meteo.com", "https://geocoding-api.open-meteo.com", "https://air-quality-api.open-meteo.com", "https://sync-api.sabin-apps.workers.dev"]);
});

test("the built index.html gets the CSP meta right after the charset", () => {
  const out = injectCsp(html);
  expect(out).toMatch(/<meta charset="UTF-8" \/>\s*<meta http-equiv="Content-Security-Policy"/);
  expect(out.match(/Content-Security-Policy/g)).toHaveLength(1);
});

test("index.html paints a sky and hero skeleton before the app script runs", () => {
  expect(html).toMatch(/<div id="root">\s*<div class="app boot"/);
  expect(html).toContain("hero is-skeleton");
});
