import { describe, formatPrecip, rangeBar, convertTemp, type Weather } from "../weather";
import { tempColor } from "../sky";
import { formatWeekday } from "../i18n";
import WeatherIcon from "../WeatherIcon";
import type { Fmt } from "./fmt";

/** 10-day forecast as a semantic table styled like Apple's range-bar list. */
export default function Daily({ weather, f }: { weather: Weather; f: Fmt }) {
  const { L, n, temp, lang, unit } = f;
  const days = weather.days;
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const nowPos = hi > lo ? Math.min(100, Math.max(0, ((weather.temperature - lo) / (hi - lo)) * 100)) : 50;
  const raw = (c: number) => Math.round(convertTemp(c, unit));
  return (
    <div className="card daily-card">
    <table className="daily">
      <caption>{L("daily")}</caption>
      <thead className="sr-only-head"><tr><th scope="col">{L("day")}</th><th scope="col">{L("conditions")}</th><th scope="col">{L("rain")}</th><th scope="col">{L("min")}</th><th scope="col">{L("range")}</th><th scope="col">{L("max")}</th></tr></thead>
      <tbody>
        {days.map((d, i) => {
          const bar = rangeBar(d, days);
          const p = formatPrecip(d.precip, unit);
          return (
            <tr key={d.date}>
              <td className="d-day">{i === 0 ? L("today") : formatWeekday(lang, d.date)}</td>
              <td className="d-cond"><WeatherIcon code={d.code} lang={lang} /> <span className="d-desc">{describe(d.code, lang)}</span></td>
              <td className="d-rain">
                {d.rain === null ? "–" : `${n(d.rain)}%`}
                {p && <> <span className="muted" aria-label={L("precipAria", { amount: n(p.value), unit: L(p.unit === "mm" ? "mm" : "inch") })}>{n(p.value)} {L(p.unit === "mm" ? "mm" : "inch")}</span></>}
              </td>
              <td className="d-min">{temp(d.min)}°</td>
              <td className="d-range">
                <div className="range" role="meter" aria-label={L("rangeAria", { min: temp(d.min), max: temp(d.max), unit })}
                  aria-valuemin={raw(d.min)} aria-valuemax={raw(d.max)} aria-valuenow={raw(d.max)}>
                  <span style={{ left: `${bar.left}%`, width: `${bar.width}%`, background: `linear-gradient(90deg, ${tempColor(d.min)}, ${tempColor(d.max)})`, animationDelay: `${i * 40}ms` }} />
                  {i === 0 && <i className="range-now" style={{ left: `${nowPos}%` }} />}
                </div>
              </td>
              <td className="d-max">{temp(d.max)}°</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
