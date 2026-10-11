import { aqiBand, AQI_BANDS, dominantPollutant, pollenBySpecies, parseTrend } from "./air";

test("aqiBand maps European AQI to an index, shape and label", () => {
  expect(aqiBand(0).index).toBe(0);
  expect(aqiBand(19.9).index).toBe(0);
  expect(aqiBand(20).index).toBe(1);
  expect(aqiBand(79).index).toBe(3);
  expect(aqiBand(100).index).toBe(5);
  expect(aqiBand(250).index).toBe(5);
});

test("every band has a distinct shape and label so colour is never the only cue", () => {
  expect(new Set(AQI_BANDS.map((b) => b.shape)).size).toBe(AQI_BANDS.length);
  expect(new Set(AQI_BANDS.map((b) => b.name)).size).toBe(AQI_BANDS.length);
});

test("dominantPollutant picks the pollutant furthest above its Fair limit", () => {
  expect(dominantPollutant({ pm2_5: 12, pm10: 15, nitrogen_dioxide: 30, ozone: 40, sulphur_dioxide: 5 })).toEqual({ id: "pm2_5", value: 12 });
  expect(dominantPollutant({ pm2_5: 5, ozone: 150 })).toEqual({ id: "ozone", value: 150 });
});

test("dominantPollutant ignores missing values and returns null when none", () => {
  expect(dominantPollutant({ pm2_5: null, ozone: undefined, pm10: "x" })).toBeNull();
  expect(dominantPollutant(undefined)).toBeNull();
  expect(dominantPollutant({ pm10: 30, ozone: null })).toEqual({ id: "pm10", value: 30 });
});

test("parseTrend keeps numbers in order and drops gaps", () => {
  expect(parseTrend([10, null, 25, "x", 30])).toEqual([10, 25, 30]);
  expect(parseTrend(undefined)).toEqual([]);
});

test("pollenBySpecies lists each species with its peak and level", () => {
  const out = pollenBySpecies({ grass_pollen: [1, 30, null], birch_pollen: [0, 0], alder_pollen: [60] });
  expect(out).toEqual([
    { species: "grass", value: 30, level: 2 },
    { species: "birch", value: 0, level: 0 },
    { species: "alder", value: 60, level: 2 },
  ]);
  expect(pollenBySpecies({})).toEqual([]);
  expect(pollenBySpecies(undefined)).toEqual([]);
});
