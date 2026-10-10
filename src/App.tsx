import { useEffect, useRef, useState } from "react";
import { compareWithYesterday, convertTemp, formatPrecip, formatWind, formatPressure, formatVisibility, pressureTrend, describe, findPlace, getAirQuality, getWeather, aqiLevel, uvLevel, healthAdvice, dailyTips, rainSummary, rangeBar, sceneFor, shareSummary, sunProgress, arcPoint, gaugeFraction, compassPoint, AQI_GAUGE_MAX, UV_GAUGE_MAX, type AirQuality, type Place, type Unit, type Weather } from "./weather";
import { LANGS, detectLang, formatDateTime, formatWeekday, num, t, type Key, type Lang } from "./i18n";
import WeatherIcon from "./WeatherIcon";
import { loadFavourites, saveFavourites, loadLastCity, saveLastCity, loadForecast, saveForecast, loadLang, saveLang, type ForecastSnapshot } from "./storage";

function Gauge({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text: string }) {
  const f = gaugeFraction(value, max);
  const end = arcPoint(f, 50, 50, 40);
  return (
    <svg className="gauge" viewBox="0 0 100 60" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#ffffff33" strokeWidth="8" strokeLinecap="round" />
      {f > 0 && <path d={`M10 50 A40 40 0 0 1 ${end.x} ${end.y}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />}
      <text x="50" y="48" textAnchor="middle" fontSize="14" fill="currentColor">{text}</text>
    </svg>
  );
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// A failed fetch (rather than an HTTP/API error) means the network is unreachable.
const isOffline = (err: unknown) => !navigator.onLine || err instanceof TypeError;

export const RETRY_DELAYS_MS = [2000, 5000, 15000];
const MY_LOCATION = "My location";
class NotFoundError extends Error {}
type ErrorMsg = { key: Key; params?: Record<string, string> };

function ErrorIllustration({ label }: { label: string }) {
  return (
    <svg className="error-art" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label={label}>
      <path d="M18 46a12 12 0 0 1 1-24 16 16 0 0 1 30 4 10 10 0 0 1-2 20z" fill="#9aa5b8" />
      <path d="M34 28l-8 12h6l-3 10 11-14h-6z" fill="#ffd54a" />
    </svg>
  );
}

export default function App() {
  const [query, setQuery] = useState("Kathmandu");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [error, setError] = useState<ErrorMsg | null>(null);
  const [loading, setLoading] = useState(false);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [lang, setLang] = useState<Lang>(() => loadLang() ?? detectLang());
  const [unit, setUnit] = useState<Unit>("C");
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const runId = useRef(0);
  const L = (key: Key, params?: Record<string, string | number>) => t(lang, key, params);
  const n = (v: number | string) => num(lang, v);
  const temp = (c: number) => n(Math.round(convertTemp(c, unit)));
  const rawTemp = (c: number) => Math.round(convertTemp(c, unit));
  const changeLang = (next: Lang) => { setLang(next); saveLang(next); };

  async function fetchForecast(city: string) {
    const p = await findPlace(city);
    if (!p) throw new NotFoundError(city);
    return { p, w: await getWeather(p) };
  }

  async function runSearch(city: string) {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      let result: Awaited<ReturnType<typeof fetchForecast>> | undefined;
      let failure: unknown;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          result = await fetchForecast(city);
          break;
        } catch (err) {
          failure = err;
          if (err instanceof NotFoundError || attempt === RETRY_DELAYS_MS.length) break;
          setRetrying(true);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          if (id !== runId.current) return;
        }
      }
      if (id !== runId.current) return;
      if (!result) throw failure;
      const { p, w } = result;
      setPlace(p);
      setAir(null);
      void getAirQuality(p).then(setAir);
      setWeather(w);
      setCachedAt(null);
      setUpdatedAt(Date.now());
      saveLastCity(city);
      saveForecast({ place: p, weather: w, savedAt: Date.now() });
    } catch (err) {
      if (id !== runId.current) return;
      const cached: ForecastSnapshot | null = loadForecast();
      if (cached && isOffline(err)) {
        setPlace(cached.place);
        setWeather(cached.weather);
        setCachedAt(cached.savedAt);
        setError(null);
      } else {
        setError(err instanceof NotFoundError ? { key: "notFound", params: { city: err.message } } : { key: "friendlyError" });
        setWeather(null);
      }
    } finally {
      if (id === runId.current) {
        setLoading(false);
        setRetrying(false);
      }
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError({ key: "geoUnsupported" });
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const p: Place = { name: MY_LOCATION, country: "", latitude: coords.latitude, longitude: coords.longitude };
          setPlace(p);
          setAir(null);
          void getAirQuality(p).then(setAir);
          setWeather(await getWeather(p));
        } catch {
          setError({ key: "friendlyError" });
          setWeather(null);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError({ key: err.code === 1 ? "geoDenied" : "geoFailed" });
        setLoading(false);
      },
    );
  }

  function updateFavourites(next: string[]) {
    setFavourites(next);
    saveFavourites(next);
  }

  async function share() {
    if (!place || !weather) return;
    const text = shareSummary(place, weather, unit, lang);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: L("title"), text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareNote(L("copied"));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setShareNote(L("shareFail"));
    }
  }

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  useEffect(() => {
    const city = loadLastCity() ?? "Kathmandu";
    setQuery(city);
    void runSearch(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally invalidates the latest run on unmount
    return () => { runId.current++; };
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    void runSearch(query);
  }

  return (
    <main>
      <div className={`sky ${weather ? sceneFor(weather.code, weather.isDay) : "none"}`} data-testid="sky" aria-hidden="true" />
      <h1 className="sr-only">{L("title")}</h1>
      <div className="lang-switch" role="group" aria-label={L("language")}>
        {LANGS.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => changeLang(l)}>{l === "en" ? "EN" : "नेपाली"}</button>
        ))}
      </div>
      <form className="search" onSubmit={search} role="search">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input aria-label={L("city")} placeholder={L("searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="pill-btn" aria-label={L("search")} disabled={loading}>{loading ? "…" : L("go")}</button>
        <button type="button" className="icon-btn" aria-label={L("useLocation")} title={L("useLocation")} disabled={loading} onClick={useMyLocation}>📍</button>
        <button type="button" className="icon-btn" aria-label={L("switchUnit", { unit: unit === "C" ? "F" : "C" })} title={L("switchUnit", { unit: unit === "C" ? "F" : "C" })} onClick={() => setUnit(unit === "C" ? "F" : "C")}>°{unit === "C" ? "F" : "C"}</button>
        {installEvent && <button type="button" className="pill-btn" onClick={() => void install()}>{L("install")}</button>}
      </form>
      {favourites.length > 0 && (
        <ul className="row" aria-label={L("favourites")} style={{ listStyle: "none", padding: 0 }}>
          {favourites.map((c) => (
            <li key={c}>
              <button type="button" disabled={loading} onClick={() => { setQuery(c); void runSearch(c); }}>{c}</button>
              <button type="button" aria-label={L("removeFav", { city: c })} onClick={() => updateFavourites(favourites.filter((f) => f !== c))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted" role="status" aria-live="polite">{loading ? L("loading") : ""}</p>
      {error && (
        <div className="error-card" role="alert">
          {error.key === "friendlyError" && <ErrorIllustration label={L("errorArt")} />}
          <p>{L(error.key, error.params)}</p>
          <button type="button" disabled={loading} onClick={() => void runSearch(query)}>{L("retry")}</button>
        </div>
      )}
      {loading && !weather && (
        <div className="bento" data-testid="skeleton" aria-hidden="true">
          <div className="card skeleton hero-skeleton wide" />
          <div className="card skeleton" />
          <div className="card skeleton" />
          <div className="card skeleton" />
        </div>
      )}
      {retrying && <p className="muted" role="status">{L("retrying")}{updatedAt !== null && L("lastUpdated", { when: formatDateTime(lang, updatedAt) })}</p>}
      {cachedAt !== null && <p className="muted" role="status">{L("offline", { when: formatDateTime(lang, cachedAt) })}</p>}
      {place && weather && (
        <>
          <section className="hero" aria-label={L("currentWeather")}>
            <h2>{place.name === MY_LOCATION ? L("myLocation") : place.country ? `${place.name}, ${place.country}` : place.name}</h2>
            <WeatherIcon code={weather.code} isDay={weather.isDay} size={72} />
            <p className="hero-temp">{temp(weather.temperature)}°{unit}</p>
            {weather.days[0] && weather.yesterdayMax !== null && (() => {
              const c = compareWithYesterday(weather.days[0].max, weather.yesterdayMax);
              const diff = unit === "F" ? Math.round((c.diff * 9) / 5) : c.diff;
              return <p className="hero-range" aria-live="polite">{c.trend === "same" ? L("sameAsYesterday") : L(c.trend === "warmer" ? "warmerThanYesterday" : "coolerThanYesterday", { diff: n(diff) })}</p>;
            })()}
            <p className="hero-cond">{L("heroCond", { cond: describe(weather.code, lang), wind: n(formatWind(weather.wind, unit).value), unit: L(formatWind(weather.wind, unit).unit) })}</p>
            {weather.feelsLike !== null && <p className="hero-range">{L("feelsLike", { temp: temp(weather.feelsLike) })}</p>}
            {weather.humidity !== null && <p className="hero-range">{L("humidity", { pct: n(Math.round(weather.humidity)) })}</p>}
            {weather.days[0] && <p className="hero-range">{L("hl", { max: temp(weather.days[0].max), min: temp(weather.days[0].min) })}</p>}
            <button type="button" aria-label={L("shareAria")} onClick={() => { setShareNote(null); void share(); }}>{L("share")}</button>
            {shareNote && <p className="muted" role="status">{shareNote}</p>}
            {place.name !== MY_LOCATION && !favourites.includes(place.name) && (
              <button type="button" aria-label={L("saveFav", { city: place.name })} onClick={() => updateFavourites([...favourites, place.name])}>{L("save")}</button>
            )}
          </section>
          <div className="bento">
            {dailyTips(weather, air?.aqi ?? null, lang).length > 0 && (
              <section className="card wide" aria-label={L("tips")}>
                <h2>{L("tips")}</h2>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {dailyTips(weather, air?.aqi ?? null, lang).map((t) => <li key={t.id}><span aria-hidden="true">{t.icon}</span> {t.text}</li>)}
                </ul>
              </section>
            )}
            <section className="card" aria-label={L("air")}>
              <h2>{L("air")}</h2>
              {air ? (
                <>
                  <Gauge label={L("airIndex")} value={air.aqi} max={AQI_GAUGE_MAX} color={aqiLevel(air.aqi).color} text={n(air.aqi)} />
                  <p style={{ color: aqiLevel(air.aqi).color, fontWeight: 600 }}>
                    {L("aqi")} {n(air.aqi)} · {aqiLevel(air.aqi, lang).label}{air.pm25 !== null && ` · ${L("pm25")} ${n(air.pm25)} µg/m³`}
                  </p>
                </>
              ) : <p className="muted">{L("airUnavailable")}</p>}
            </section>
            <section className="card" aria-label={L("uvIndex")}>
              <h2>{L("uvIndex")}</h2>
              {weather.uv !== null && (
                <>
                  <Gauge label={L("uvLevel")} value={weather.uv} max={UV_GAUGE_MAX} color={uvLevel(weather.uv).color} text={n(weather.uv)} />
                  <p style={{ color: uvLevel(weather.uv).color, fontWeight: 600 }}>{L("uv")} {n(weather.uv)} · {uvLevel(weather.uv, lang).label}</p>
                </>
              )}
              <p className="muted">{healthAdvice(air?.aqi ?? null, weather.uv, lang)}</p>
            </section>
            <section className="card" aria-label={L("wind")}>
              <h2>{L("wind")}</h2>
              {weather.windDir !== null && (
                <svg className="compass" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff55" strokeWidth="2" />
                  <text x="50" y="16" textAnchor="middle" fontSize="10" fill="currentColor">N</text>
                  <polygon points="50,24 58,56 50,50 42,56" fill="currentColor" transform={`rotate(${(weather.windDir + 180) % 360} 50 50)`} />
                </svg>
              )}
              <p>{n(formatWind(weather.wind, unit).value)} {L(formatWind(weather.wind, unit).unit)}{weather.windDir !== null && ` · ${compassPoint(weather.windDir, lang)}`}</p>
            </section>
            {(weather.pressure !== null || weather.visibility !== null) && (
              <section className="card" aria-label={L("pressureCard")}>
                <h2>{L("pressure")}</h2>
                {weather.pressure !== null && (() => {
                  const p = formatPressure(weather.pressure, unit);
                  const trend = pressureTrend(weather.pressureDelta);
                  return (
                    <p>
                      <span>{n(p.value)} {L(p.unit)}</span>
                      {trend && <> <span aria-hidden="true">{trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→"}</span> <span aria-label={L("trendAria", { trend: L(trend) })}>{L(trend)}</span></>}
                    </p>
                  );
                })()}
                {weather.visibility !== null && (() => {
                  const v = formatVisibility(weather.visibility, unit);
                  return <p>{L("visibility")}: <span>{n(v.value)} {L(v.unit)}</span></p>;
                })()}
              </section>
            )}
            {weather.sunrise && weather.sunset && weather.now && (() => {
              const pt = arcPoint(sunProgress(weather.now, weather.sunrise, weather.sunset), 50, 50, 40);
              return (
                <section className="card" aria-label={L("sunAria")}>
                  <h2>{L("sun")}</h2>
                  <svg className="gauge" viewBox="0 0 100 60" aria-hidden="true">
                    <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#ffffff55" strokeWidth="2" strokeDasharray="3 3" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="#ffffff55" />
                    <circle cx={pt.x} cy={pt.y} r="5" fill="#ffe27a" />
                  </svg>
                  <p>↑ {n(weather.sunrise.slice(11, 16))} · ↓ {n(weather.sunset.slice(11, 16))}</p>
                </section>
              );
            })()}
            {rainSummary(weather.hours, lang) && <p className="card">{rainSummary(weather.hours, lang)}</p>}
            <section className="card wide" aria-label={L("hourly")}>
              <h2>{L("hourly")}</h2>
              <ul className="hourly" aria-label={L("hourly")}>
                {weather.hours.map((h) => (
                  <li key={h.time}><span>{n(h.time.slice(11, 16))}</span><strong>{temp(h.temp)}°</strong></li>
                ))}
              </ul>
            </section>
          <table className="card wide">
            <caption>{L("daily")}</caption>
            <thead><tr><th scope="col">{L("day")}</th><th scope="col">{L("conditions")}</th><th scope="col">{L("rain")}</th><th scope="col">{L("min")}</th><th scope="col">{L("range")}</th><th scope="col">{L("max")}</th></tr></thead>
            <tbody>
              {weather.days.map((d) => (
                <tr key={d.date}>
                  <td>{formatWeekday(lang, d.date)}</td>
                  <td><WeatherIcon code={d.code} /> {describe(d.code, lang)}</td>
                  <td>
                    {d.rain === null ? "–" : `${n(d.rain)}%`}
                    {(() => {
                      const p = formatPrecip(d.precip, unit);
                      if (!p) return null;
                      const amount = n(p.value), u = L(p.unit === "mm" ? "mm" : "inch");
                      return <> <span className="muted" aria-label={L("precipAria", { amount, unit: u })}>{amount} {u}</span></>;
                    })()}
                  </td>
                  <td>{temp(d.min)}°</td>
                  <td>
                    <div className="range" role="meter" aria-label={L("rangeAria", { min: temp(d.min), max: temp(d.max), unit })}
                      aria-valuemin={rawTemp(d.min)} aria-valuemax={rawTemp(d.max)} aria-valuenow={rawTemp(d.max)}>
                      <span style={{ left: `${rangeBar(d, weather.days).left}%`, width: `${rangeBar(d, weather.days).width}%` }} />
                    </div>
                  </td>
                  <td>{temp(d.max)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
      <p className="muted card">{L("data")} <a href="https://open-meteo.com/">Open-Meteo</a></p>
    </main>
  );
}
