import { contrast, luminance, mix, parseHex, ramp, skyFor, sunElevation, tempColor, toHex, weatherFx } from "./sky";

const at = (hhmm: string, code = 0) => skyFor({ code, isDay: true, time: `2026-10-08T${hhmm}`, sunrise: "2026-10-08T06:00", sunset: "2026-10-08T18:00" });

test("colour helpers round-trip and interpolate", () => {
  expect(toHex(parseHex("#1f5fbb"))).toBe("#1f5fbb");
  expect(toHex(mix([0, 0, 0], [255, 255, 255], 0.5))).toBe("#808080");
  expect(toHex(ramp([[0, "#000000"], [10, "#ffffff"]], -5))).toBe("#000000");
  expect(toHex(ramp([[0, "#000000"], [10, "#ffffff"]], 99))).toBe("#ffffff");
  expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 0);
});

test("sun elevation peaks at solar noon, is 0 at the horizon and -1 in deep night", () => {
  expect(sunElevation(720, 360, 1080)).toBeCloseTo(1);
  expect(sunElevation(360, 360, 1080)).toBeCloseTo(0);
  expect(sunElevation(1080 + 40, 360, 1080)).toBeCloseTo(-0.5);
  expect(sunElevation(0, 360, 1080)).toBe(-1);
  expect(sunElevation(300, 360, 360)).toBe(0.6);
});

test("weather codes map to sky effects", () => {
  expect(weatherFx(0)).toEqual({ cloud: 0, rain: 0, snow: 0, fog: 0, storm: false });
  expect(weatherFx(3).cloud).toBeGreaterThan(0.9);
  expect(weatherFx(65).rain).toBe(1);
  expect(weatherFx(61).rain).toBeLessThan(weatherFx(63).rain);
  expect(weatherFx(75).snow).toBe(1);
  expect(weatherFx(45).fog).toBeGreaterThan(0.5);
  expect(weatherFx(95).storm).toBe(true);
});

test("sky darkens at night and under storms, and shows stars only on clear nights", () => {
  expect(luminance(at("23:00").top)).toBeLessThan(luminance(at("12:00").top));
  expect(luminance(at("12:00", 95).top)).toBeLessThan(luminance(at("12:00").top));
  expect(at("23:00").stars).toBeGreaterThan(0.9);
  expect(at("23:00", 3).stars).toBeLessThan(0.2);
  expect(at("12:00").stars).toBe(0);
  expect(at("09:00").sunX).toBeCloseTo(0.25);
});

test("falls back to isDay when sunrise/sunset are unknown", () => {
  expect(skyFor({ code: 0, isDay: false, time: null, sunrise: null, sunset: null }).elevation).toBe(-1);
  expect(skyFor({ code: 0, isDay: true, time: "2026-10-08T12:00", sunrise: null, sunset: null }).elevation).toBe(0.6);
});

test("white hero text keeps at least 3:1 contrast on every sky (large-text AA)", () => {
  for (const code of [0, 1, 2, 3, 45, 53, 61, 65, 71, 75, 82, 95])
    for (const time of ["00:00", "05:30", "06:00", "07:00", "09:00", "12:00", "16:00", "18:00", "18:40", "21:00"])
      expect(contrast("#ffffff", at(time, code).top), `${code} ${time}`).toBeGreaterThanOrEqual(3);
});

test("temperature colours run cold-blue to hot-red and clamp at the ends", () => {
  expect(tempColor(-40)).toBe(tempColor(-15));
  expect(tempColor(60)).toBe(tempColor(42));
  const [r0, , b0] = parseHex(tempColor(0));
  const [r1, , b1] = parseHex(tempColor(35));
  expect(b0).toBeGreaterThan(r0);
  expect(r1).toBeGreaterThan(b1);
});
