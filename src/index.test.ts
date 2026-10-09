import html from "../index.html?raw";

test("index.html loads no third-party font resources", () => {
  expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
});
