import type { Key, Lang } from "../i18n";
import type { Unit } from "../weather";

/** Formatting helpers shared by the dashboard components (bound to the current language and unit). */
export interface Fmt {
  lang: Lang;
  unit: Unit;
  L: (key: Key, params?: Record<string, string | number>) => string;
  n: (v: number | string) => string;
  /** Rounded temperature in the current unit, with localised digits (no degree sign). */
  temp: (c: number) => string;
}
