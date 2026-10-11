import { useId, useState } from "react";
import {
  aqiLevel, uvLevel, uvWindow, healthAdvice, gaugeFraction, arcPoint, formatWind, visibleGust, compassPoint,
  formatPressure, pressureTrend, formatVisibility, sunProgress, moonPhase, nowcast, rainSummary, feelsReason,
  AQI_GAUGE_MAX, UV_GAUGE_MAX, type AirQuality, type Weather, type Tip, type SevereOutlook,
} from "../weather";
import { t, formatWeekday, type Key } from "../i18n";
import AirSheet, { BandMark } from "./AirSheet";
import { aqiBand } from "../air";
import Icon, { type IconName } from "./icons";
import type { Fmt } from "./fmt";

const AQI_STOPS = ["#2e9e5b", "#8ab82e", "#d4a017", "#e0742b", "#d23f3f", "#8e2a6b"];
const UV_STOPS = ["#2e9e5b", "#d4a017", "#e0742b", "#d23f3f", "#8e2a6b"];

function Card({ label, title, icon, className = "", children }: { label: string; title: string; icon: IconName; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card ${className}`} aria-label={label}>
      <h2><Icon name={icon} size={16} /> {title}</h2>
      {children}
    </section>
  );
}

/** Semicircle gauge with a gradient track, animated fill and a knob at the value. */
export function Gauge({ label, value, max, color, text, stops }: { label: string; value: number; max: number; color: string; text: string; stops: string[] }) {
  const id = useId().replace(/:/g, "");
  const f = gaugeFraction(value, max);
  const end = arcPoint(f, 50, 50, 40);
  const arc = "M10 50 A40 40 0 0 1 90 50";
  return (
    <svg className="gauge" viewBox="0 0 100 60" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1">
          {stops.map((c, i) => <stop key={c} offset={i / (stops.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <path d={arc} fill="none" stroke={`url(#g${id})`} strokeOpacity="0.28" strokeWidth="9" strokeLinecap="round" />
      <path className="gauge-fill" d={arc} pathLength={1} strokeDasharray={`${f} 1`} fill="none" stroke={`url(#g${id})`} strokeWidth="9" strokeLinecap="round" />
      <circle cx={end.x} cy={end.y} r="5.5" fill="#fff" stroke={color} strokeWidth="3" />
      <text x="50" y="49" textAnchor="middle" fontSize="17" fontWeight="650" fill="currentColor">{text}</text>
    </svg>
  );
}

export function TipsCard({ tips, f }: { tips: Tip[]; f: Fmt }) {
  return (
    <Card label={f.L("tips")} title={f.L("tips")} icon="bulb" className="wide tips">
      <ul>{tips.map((tip) => <li key={tip.id}><span aria-hidden="true">{tip.icon}</span> {tip.text}</li>)}</ul>
    </Card>
  );
}

export function AirCard({ air, f }: { air: AirQuality | null; f: Fmt }) {
  const { L, n, lang } = f;
  const [open, setOpen] = useState(false);
  return (
    <Card label={L("air")} title={L("air")} icon="leaf" className="small">
      {air ? (
        <>
          <Gauge label={L("airIndex")} value={air.aqi} max={AQI_GAUGE_MAX} color={aqiLevel(air.aqi).color} text={n(air.aqi)} stops={AQI_STOPS} />
          <p className="strong">
            <BandMark band={aqiBand(air.aqi)} /> {L("aqi")} {n(air.aqi)} · {aqiLevel(air.aqi, lang).label}{air.pm25 !== null && ` · ${L("pm25")} ${n(air.pm25)} µg/m³`}
          </p>
          <button type="button" className="link-btn" onClick={() => setOpen(true)}>{L("airDetails")}</button>
          {open && <AirSheet air={air} f={f} onClose={() => setOpen(false)} />}
        </>
      ) : <p className="muted">{L("airUnavailable")}</p>}
    </Card>
  );
}

export function PollenCard({ air, f }: { air: AirQuality; f: Fmt }) {
  if (!air.pollen) return null;
  const { level, species } = air.pollen;
  const name = ["Low", "Moderate", "High", "Very high"][level];
  return (
    <Card label={f.L("pollen")} title={f.L("pollen")} icon="leaf" className="small">
      <div className="pollen-bars" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= level ? `on l${level}` : ""} />)}</div>
      <p className="strong">{f.L("pollenLine", { level: t(f.lang, `lvl.${name}` as Key), species: species ? t(f.lang, `pollen.${species}` as Key) : f.L("pollenNone") })}</p>
    </Card>
  );
}

export function UvCard({ weather, air, f }: { weather: Weather; air: AirQuality | null; f: Fmt }) {
  const { L, n, lang } = f;
  const win = weather.uvHours.length > 0 ? uvWindow(weather.uvHours) : undefined;
  return (
    <Card label={L("uvIndex")} title={L("uvIndex")} icon="sun" className="small">
      {weather.uv !== null && (
        <>
          <Gauge label={L("uvLevel")} value={weather.uv} max={UV_GAUGE_MAX} color={uvLevel(weather.uv).color} text={n(Math.round(weather.uv * 10) / 10)} stops={UV_STOPS} />
          <p className="strong">{L("uv")} {n(Math.round(weather.uv * 10) / 10)} · {uvLevel(weather.uv, lang).label}</p>
        </>
      )}
      {win !== undefined && <p>{win ? L("uvWindow", { start: n(win.start), end: n(win.end) }) : L("uvLow")}</p>}
      <p className="muted">{healthAdvice(air?.aqi ?? null, weather.uv, lang)}</p>
    </Card>
  );
}

export function WindCard({ weather, f }: { weather: Weather; f: Fmt }) {
  const { L, n, unit, lang } = f;
  const w = formatWind(weather.wind, unit);
  const g = visibleGust(weather.wind, weather.gust);
  const gw = g === null ? null : formatWind(g, unit);
  return (
    <Card label={L("wind")} title={L("wind")} icon="wind" className="small">
      {weather.windDir !== null && (
        <svg className="compass" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1="60" y1={i % 9 === 0 ? 10 : 12} x2="60" y2="17" stroke="currentColor" strokeOpacity={i % 9 === 0 ? 0.9 : 0.35} strokeWidth={i % 9 === 0 ? 2 : 1} transform={`rotate(${i * 10} 60 60)`} />
          ))}
          {(["N", "E", "S", "W"] as const).map((d, i) => (
            <text key={d} x={60 + 33 * Math.sin((i * Math.PI) / 2)} y={64 - 33 * Math.cos((i * Math.PI) / 2)} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" opacity={d === "N" ? 1 : 0.7}>{t(lang, `dir.${d}` as Key)}</text>
          ))}
          <g className="compass-needle" style={{ transform: `rotate(${(weather.windDir + 180) % 360}deg)` }}>
            <path d="M60 14 L66 30 L60 27 L54 30 Z" fill="currentColor" />
            <line x1="60" y1="27" x2="60" y2="104" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <circle cx="60" cy="60" r="19" className="compass-hub" />
          <text x="60" y="63" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{n(w.value)}</text>
          <text x="60" y="74" textAnchor="middle" fontSize="7.5" fill="currentColor" opacity="0.8">{L(w.unit)}</text>
        </svg>
      )}
      <p>{n(w.value)} {L(w.unit)}{weather.windDir !== null && ` · ${compassPoint(weather.windDir, lang)}`}</p>
      {gw && <p>{L("gusts", { value: n(gw.value), unit: L(gw.unit) })}</p>}
    </Card>
  );
}

export function FeelsCard({ weather, f }: { weather: Weather; f: Fmt }) {
  if (weather.feelsLike === null) return null;
  const reason = feelsReason(weather.temperature, weather.feelsLike);
  return (
    <Card label={f.L("feelsTitle")} title={f.L("feelsTitle")} icon="thermo" className="small">
      <p className="big-value">{f.temp(weather.feelsLike)}°</p>
      <p className="muted">{f.L(reason === "wind" ? "feelsWind" : reason === "humid" ? "feelsHumid" : "feelsSimilar")}</p>
    </Card>
  );
}

export function PressureCard({ weather, f }: { weather: Weather; f: Fmt }) {
  const { L, n, unit } = f;
  if (weather.pressure === null && weather.visibility === null) return null;
  const p = weather.pressure === null ? null : formatPressure(weather.pressure, unit);
  const trend = pressureTrend(weather.pressureDelta);
  const v = weather.visibility === null ? null : formatVisibility(weather.visibility, unit);
  return (
    <Card label={L("pressureCard")} title={L("pressure")} icon="gauge" className="small">
      {p && (
        <p className="pressure">
          <span className="big-value sm">{n(p.value)} {L(p.unit)}</span>
          {trend && <> <span aria-hidden="true" className={`trend ${trend}`}>{trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→"}</span> <span aria-label={L("trendAria", { trend: L(trend) })}>{L(trend)}</span></>}
        </p>
      )}
      {v && <p>{L("visibility")}: <span>{n(v.value)} {L(v.unit)}</span></p>}
    </Card>
  );
}

export function SunCard({ weather, f }: { weather: Weather; f: Fmt }) {
  const { L, n } = f;
  if (!weather.sunrise || !weather.sunset || !weather.now) return null;
  const prog = sunProgress(weather.now, weather.sunrise, weather.sunset);
  const pt = arcPoint(prog, 60, 54, 46);
  const moon = moonPhase(new Date(`${weather.now.slice(0, 10)}T12:00:00Z`));
  const waxing = moon.phase < 0.5;
  const rx = (7 * Math.abs(Math.cos(2 * Math.PI * moon.phase))).toFixed(2);
  const arc = "M14 54 A46 46 0 0 1 106 54";
  return (
    <Card label={L("sunAria")} title={L("sun")} icon="sun" className="small">
      <svg className="sun-arc" viewBox="0 0 120 64" aria-hidden="true">
        <defs>
          <linearGradient id="sun-g" x1="0" x2="1"><stop offset="0" stopColor="#ff9f43" /><stop offset="1" stopColor="#ffe27a" /></linearGradient>
          <radialGradient id="sun-glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.9" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        </defs>
        <path d={arc} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4" />
        <path d={arc} pathLength={1} strokeDasharray={`${prog} 1`} fill="none" stroke="url(#sun-g)" strokeWidth="3" strokeLinecap="round" />
        <line x1="4" y1="54" x2="116" y2="54" stroke="currentColor" strokeOpacity="0.35" />
        <circle cx={pt.x} cy={pt.y} r="13" fill="url(#sun-glow)" />
        <circle cx={pt.x} cy={pt.y} r="5.5" fill="#ffe27a" />
      </svg>
      <p className="sun-times"><span>↑ {L("sunrise")} {n(weather.sunrise.slice(11, 16))}</span><span>↓ {L("sunset")} {n(weather.sunset.slice(11, 16))}</span></p>
      {weather.daylightMin !== null && (
        <p>
          {L("daylight", { len: `${n(Math.floor(weather.daylightMin / 60))}h ${n(weather.daylightMin % 60)}m` })}
          {weather.daylightDeltaMin !== null && ` · ${weather.daylightDeltaMin === 0 ? L("daylightSame") : L(weather.daylightDeltaMin > 0 ? "daylightLonger" : "daylightShorter", { m: n(Math.abs(weather.daylightDeltaMin)) })}`}
        </p>
      )}
      <p className="moon">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#333a" />
          <path d={`M8 1 A7 7 0 0 ${waxing ? 1 : 0} 8 15 A${rx} 7 0 0 ${waxing === moon.illumination < 0.5 ? 0 : 1} 8 1`} fill="#f4f1de" />
        </svg>{" "}
        {L(`moon_${moon.name}` as Key)} · {L("moonIllum", { pct: n(Math.round(moon.illumination * 100)) })}
      </p>
    </Card>
  );
}

/** "Rain starts in N min" sentence from the 15-minute nowcast, or null when it is not worth a headline. */
export function nowcastText(weather: Weather, f: Fmt, always = false): string | null {
  const nc = weather.now ? nowcast(weather.minutely ?? [], weather.now) : null;
  if (!nc || (!always && nc.kind === "dry")) return null;
  if (nc.minutes >= 90 && (nc.kind === "dry" || nc.kind === "continues"))
    return f.L(nc.kind === "dry" ? "nowDryHours" : "nowContinuesHours", { h: f.n(Math.round(nc.minutes / 60)) });
  const key = { starts: "nowStarts", stops: "nowStops", continues: "nowContinues", dry: "nowDry" } as const;
  return f.L(key[nc.kind], { min: f.n(nc.minutes) });
}

export function PrecipCard({ weather, f }: { weather: Weather; f: Fmt }) {
  const line = nowcastText(weather, f, true);
  const summary = rainSummary(weather.hours, f.lang);
  const slots = weather.minutely ?? [];
  if (!line && !summary) return null;
  const peak = Math.max(1.5, ...slots.map((s) => s.mm));
  return (
    <Card label={f.L("precipCard")} title={f.L("precipCard")} icon="drop" className="wide precip">
      {line && <p className="nowcast-line">{line}</p>}
      {slots.length > 1 && slots.some((s) => s.mm >= 0.1) && (
        <>
          <div className="nowbars" role="img" aria-label={f.L("nowChart")}>
            {slots.map((s) => <span key={s.time} className={s.mm >= 0.1 ? "wet" : ""} style={{ height: `${Math.max(6, (s.mm / peak) * 100)}%` }} />)}
          </div>
          <div className="nowbars-axis" aria-hidden="true"><span>{f.L("now")}</span><span>{f.L("plus1h")}</span><span>{f.L("plus2h")}</span></div>
        </>
      )}
      {summary && <p className="muted">{summary}</p>}
    </Card>
  );
}

export function SevereBanner({ sev, f, onDismiss }: { sev: SevereOutlook; f: Fmt; onDismiss: () => void }) {
  const msg = { storm: "severeStorm", snow: "severeSnow", heat: "severeHeat", cold: "severeCold" } as const;
  return (
    <div className={`severe severe-${sev.kind}`} role="status" aria-label={f.L("severeLabel")}>
      <span className="severe-icon" aria-hidden="true"><Icon name="warn" size={22} /></span>
      <div>
        <p className="severe-text">{f.L(msg[sev.kind], { day: formatWeekday(f.lang, sev.date), temp: sev.temp === null ? "" : f.n(sev.temp) })}</p>
        <p className="severe-note">{f.L("severeNote")}</p>
      </div>
      <button type="button" className="chip-btn" onClick={onDismiss}>{f.L("dismiss")}</button>
    </div>
  );
}
