import { POLLEN_SPECIES, pollenLevel, type PollenSpecies } from "./pollen";

export type BandShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "cross";
export interface AqiBand { index: number; name: "Good" | "Fair" | "Moderate" | "Poor" | "Very poor" | "Extremely poor"; color: string; shape: BandShape; }

/** European AQI bands; each has its own shape and name so colour is never the only cue. */
export const AQI_BANDS: (AqiBand & { max: number })[] = [
  { index: 0, max: 20, name: "Good", color: "#2e9e5b", shape: "circle" },
  { index: 1, max: 40, name: "Fair", color: "#8ab82e", shape: "square" },
  { index: 2, max: 60, name: "Moderate", color: "#d4a017", shape: "triangle" },
  { index: 3, max: 80, name: "Poor", color: "#e0742b", shape: "diamond" },
  { index: 4, max: 100, name: "Very poor", color: "#d23f3f", shape: "hexagon" },
  { index: 5, max: Infinity, name: "Extremely poor", color: "#8e2a6b", shape: "cross" },
];

export const aqiBand = (aqi: number): AqiBand => {
  const { index, name, color, shape } = AQI_BANDS.find((b) => aqi < b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
  return { index, name, color, shape };
};

export type PollutantId = "pm2_5" | "pm10" | "nitrogen_dioxide" | "ozone" | "sulphur_dioxide";
/** Upper bound (µg/m³) of the European AQI "Fair" band per pollutant; values are compared against it. */
const FAIR_LIMIT: Record<PollutantId, number> = { pm2_5: 20, pm10: 40, nitrogen_dioxide: 90, ozone: 100, sulphur_dioxide: 200 };
export const POLLUTANTS = Object.keys(FAIR_LIMIT) as PollutantId[];
export interface Pollutant { id: PollutantId; value: number }

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The pollutant furthest above its Fair limit, or null when no concentration is available. */
export function dominantPollutant(current: Record<string, unknown> | undefined): Pollutant | null {
  let best: Pollutant | null = null;
  let score = -1;
  for (const id of POLLUTANTS) {
    const value = current?.[id];
    if (!isNum(value)) continue;
    if (value / FAIR_LIMIT[id] > score) { score = value / FAIR_LIMIT[id]; best = { id, value }; }
  }
  return best;
}

/** Numeric hourly AQI values in order; gaps are dropped. */
export const parseTrend = (arr: unknown): number[] => (Array.isArray(arr) ? arr.filter(isNum) : []);

export interface SpeciesPollen { species: PollenSpecies; value: number; level: 0 | 1 | 2 | 3 }

/** Today's peak per pollen species that Open-Meteo returned numbers for. */
export function pollenBySpecies(hourly: Record<string, unknown> | undefined): SpeciesPollen[] {
  const out: SpeciesPollen[] = [];
  for (const species of POLLEN_SPECIES) {
    const nums = parseTrend(hourly?.[`${species}_pollen`]);
    if (!nums.length) continue;
    const value = Math.max(...nums);
    out.push({ species, value, level: pollenLevel(species, value) });
  }
  return out;
}
