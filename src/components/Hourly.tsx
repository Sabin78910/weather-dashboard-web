import { useRef, type PointerEvent } from "react";
import { convertTemp, describe, formatWind, type Weather } from "../weather";
import { tempColor } from "../sky";
import WeatherIcon from "../WeatherIcon";
import Icon from "./icons";
import type { Fmt } from "./fmt";

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: [number, number][]): string {
  return pts.reduce((d, p, i) => {
    if (!i) return `M${p[0]} ${p[1]}`;
    const [a, b, c] = [pts[i - 2] ?? pts[i - 1], pts[i - 1], pts[i + 1] ?? p];
    return `${d} C${b[0] + (p[0] - a[0]) / 6} ${b[1] + (p[1] - a[1]) / 6} ${p[0] - (c[0] - b[0]) / 6} ${p[1] - (c[1] - b[1]) / 6} ${p[0]} ${p[1]}`;
  }, "");
}

/** Hourly card: a 24-hour scrubber (drag and the sky follows) above the 12-hour strip. */
export default function Hourly({ weather, f, scrub, onScrub }: { weather: Weather; f: Fmt; scrub: number; onScrub: (i: number) => void }) {
  const { L, n, temp, lang, unit } = f;
  const tl = weather.timeline ?? [];
  const area = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const last = tl.length - 1;
  const si = Math.max(0, Math.min(scrub, last));
  const sel = tl[si];
  const label = (i: number, time: string) => (i === 0 ? L("now") : n(time.slice(11, 16)));

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = area.current?.getBoundingClientRect();
    if (!r || !r.width || last < 1) return;
    onScrub(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * last));
  };

  let chart = null;
  if (last >= 2 && sel) {
    const temps = tl.map((h) => convertTemp(h.temp, unit));
    const [lo, hi] = [Math.min(...temps), Math.max(...temps)];
    const y = (v: number) => 14 + (1 - (v - lo) / (hi - lo || 1)) * 52;
    const pts = temps.map((v, i): [number, number] => [i * 10, y(v)]);
    const line = smooth(pts);
    const W = last * 10;
    const pct = (si / last) * 100;
    const wind = sel.wind !== null ? formatWind(sel.wind, unit) : null;
    const windText = wind ? L("scrubWind", { v: n(wind.value), unit: L(wind.unit) }) : "";
    const uvText = sel.uv !== null ? L("scrubUv", { uv: n(Math.round(sel.uv * 10) / 10) }) : "";
    const valueText = L("scrubValue", {
      time: label(si, sel.time), temp: temp(sel.temp), cond: describe(sel.code ?? weather.code, lang),
      rain: sel.rain !== null ? L("rainPct", { pct: n(sel.rain) }) : "",
    }) + [windText, uvText].filter(Boolean).map((x) => `, ${x}`).join("");
    chart = (
      <>
        <div className="scrub-readout">
          <span className="scrub-time">{label(si, sel.time)}</span>
          {sel.code !== null && <WeatherIcon code={sel.code} isDay={sel.isDay ?? true} size={22} lang={lang} />}
          <span className="scrub-temp">{temp(sel.temp)}°</span>
          <span className="scrub-cond">{describe(sel.code ?? weather.code, lang)}{sel.rain ? ` · ${n(sel.rain)}%` : ""}</span>
          {windText && <span className="scrub-cond">{n(wind!.value)} {L(wind!.unit)}</span>}
          {uvText && <span className="scrub-cond">{uvText}</span>}
          {scrub > 0 && <button type="button" className="chip-btn" onClick={() => onScrub(0)}>{L("backToNow")}</button>}
        </div>
        <div
          className="scrubber" ref={area}
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); pick(e); }}
          onPointerMove={(e) => dragging.current && pick(e)}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
        >
          <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="hl-stroke" x1="0" x2="1">
                {tl.map((h, i) => <stop key={h.time} offset={i / last} stopColor={tempColor(h.temp)} />)}
              </linearGradient>
              <linearGradient id="hl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {tl.map((h, i) => h.isDay === false && <rect key={`n${h.time}`} className="hl-night" x={i * 10 - 5} y="0" width="10" height="100" />)}
            <path d={`${line} L${W} 76 L0 76 Z`} fill="url(#hl-fill)" />
            <path d={line} fill="none" stroke="url(#hl-stroke)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {tl.map((h, i) => (h.rain ?? 0) > 0 && <rect key={`r${h.time}`} className="hl-rain" x={i * 10 - 3} y={100 - (h.rain ?? 0) * 0.2} width="6" height={(h.rain ?? 0) * 0.2} rx="1" />)}
          </svg>
          <span className="scrub-cursor" style={{ left: `${pct}%` }} />
          <span className="scrub-dot" style={{ left: `${pct}%`, top: `${pts[si][1]}%`, background: tempColor(sel.temp) }} />
          <div className="scrub-axis" aria-hidden="true">
            {tl.map((h, i) => i % 6 === 0 && <span key={h.time} style={{ left: `${(i / last) * 100}%` }}>{label(i, h.time)}</span>)}
          </div>
          <input
            className="scrub-input" type="range" min={0} max={last} step={1} value={si}
            aria-label={L("scrub")} aria-valuetext={valueText}
            onChange={(e) => onScrub(Number(e.target.value))}
          />
        </div>
      </>
    );
  }

  return (
    <section className="card wide hourly-card" aria-label={L("hourly")}>
      <h2><Icon name="clock" size={16} /> {chart ? L("next24") : L("hourly")}</h2>
      {chart}
      <ul className="hourly" aria-label={L("hourly")}>
        {weather.hours.map((h, i) => {
          const code = tl[i]?.time === h.time ? tl[i].code : null;
          return (
            <li key={h.time}>
              <button type="button" aria-pressed={tl.length > i ? scrub === i : undefined} onClick={() => tl.length > i && onScrub(i)}>
                <span>{label(i, h.time)}</span>
                {code !== null && <WeatherIcon code={code} isDay={tl[i].isDay ?? true} size={22} lang={lang} />}
                <strong>{temp(h.temp)}°</strong>
                {(h.rain ?? 0) >= 20 && <small>{n(h.rain as number)}%</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
