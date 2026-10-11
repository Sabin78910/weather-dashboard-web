import { useEffect, useRef } from "react";
import { aqiBand, type AqiBand, type BandShape } from "../air";
import { pollenLevel } from "../pollen";
import { t, type Key } from "../i18n";
import type { AirQuality } from "../weather";
import type { Fmt } from "./fmt";

const POINTS: Record<BandShape, string> = {
  circle: "", square: "3,3 17,3 17,17 3,17", triangle: "10,2 18,17 2,17", diamond: "10,1 19,10 10,19 1,10",
  hexagon: "5,2 15,2 19,10 15,18 5,18 1,10", cross: "7,2 13,2 13,7 18,7 18,13 13,13 13,18 7,18 7,13 2,13 2,7 7,7",
};

/** Band marker: shape plus fill, decorative because the band name always sits beside it. */
export function BandMark({ band, size = 16 }: { band: Pick<AqiBand, "shape" | "color">; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="band-mark">
      {band.shape === "circle" ? <circle cx="10" cy="10" r="8" fill={band.color} /> : <polygon points={POINTS[band.shape]} fill={band.color} />}
    </svg>
  );
}

const LEVEL_NAMES = ["Low", "Moderate", "High", "Very high"] as const;

function Trend({ values, f }: { values: number[]; f: Fmt }) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * 200 : 100);
  const y = (v: number) => 46 - ((v - min) / span) * 40;
  return (
    <svg className="air-trend" viewBox="0 0 200 52" role="img" aria-label={f.L("airTrend", { min: f.n(Math.round(min)), max: f.n(Math.round(max)) })}>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={aqiBand(v).color} stroke="currentColor" strokeWidth="0.8" />)}
    </svg>
  );
}

/** Modal sheet with the band, a plain health line, the main pollutant, the 24-hour trend and pollen by type. */
export default function AirSheet({ air, f, onClose }: { air: AirQuality; f: Fmt; onClose: () => void }) {
  const { L, n, lang } = f;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const band = aqiBand(air.aqi);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={L("airDetails")} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{L("airDetails")}</h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose}>{L("close")}</button>
        </div>
        <p className="strong band-line"><BandMark band={band} size={20} /> {L("aqi")} {n(air.aqi)} · {t(lang, `lvl.${band.name}` as Key)}</p>
        <p>{L(`airHealth${band.index}` as Key)}</p>
        {air.dominant && <p>{L("airMain", { name: L(`pollutant.${air.dominant.id}` as Key), value: n(Math.round(air.dominant.value * 10) / 10) })}</p>}
        {air.trend.length > 1 && (
          <>
            <h3>{L("airTrendTitle")}</h3>
            <Trend values={air.trend} f={f} />
          </>
        )}
        {air.species.length > 0 && (
          <>
            <h3>{L("pollenByType")}</h3>
            <ul className="pollen-list">
              {air.species.map((s) => (
                <li key={s.species}>
                  <span>{t(lang, `pollen.${s.species}` as Key)}</span>
                  <span className="pollen-bars" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= pollenLevel(s.species, s.value) ? `on l${s.level}` : ""} />)}</span>
                  <span>{L("pollenValue", { level: t(lang, `lvl.${LEVEL_NAMES[s.level]}` as Key), value: n(Math.round(s.value)) })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">{L("airNote")}</p>
      </div>
    </div>
  );
}
