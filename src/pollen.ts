export const POLLEN_SPECIES = ["grass", "birch", "alder", "ragweed"] as const;
export type PollenSpecies = (typeof POLLEN_SPECIES)[number];
export interface Pollen { level: 0 | 1 | 2 | 3; species: PollenSpecies | null; value: number; }

/** Lower bounds (grains/m³) of Moderate, High and Very high per species, after Foreca's pollen scale: grass/ragweed 5/20/50, birch/alder 10/50/200. */
export const POLLEN_STEPS: Record<PollenSpecies, [number, number, number]> = {
  grass: [5, 20, 50], ragweed: [5, 20, 50], birch: [10, 50, 200], alder: [10, 50, 200],
};
/** Level 0 (Low) to 3 (Very high) for a species concentration in grains/m³. */
export const pollenLevel = (species: PollenSpecies, grains: number): 0 | 1 | 2 | 3 =>
  POLLEN_STEPS[species].filter((min) => grains >= min).length as 0 | 1 | 2 | 3;

