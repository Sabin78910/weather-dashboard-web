import sw from "../public/sw.js?raw";


test("service worker serves hashed /assets/ files cache-first (long cache lifetime)", () => {
  expect(sw).toContain("/assets/");
  expect(sw).toMatch(/caches\.match\(req\)\.then\(\s*\(hit\) =>\s*hit \|\|/);
});

test("service worker still falls back to the cache offline", () => {
  expect(sw).toContain('caches.match("./")');
});
