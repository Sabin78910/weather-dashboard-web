import { useEffect, useState } from "react";
import { convertTemp, describe, findPlace, getAirQuality, getWeather, aqiLevel, uvLevel, healthAdvice, rainSummary, rangeBar, sceneFor, sunProgress, arcPoint, gaugeFraction, compassPoint, AQI_GAUGE_MAX, UV_GAUGE_MAX, type AirQuality, type Place, type Unit, type Weather } from "./weather";
import WeatherIcon from "./WeatherIcon";
import { loadFavourites, saveFavourites, loadLastCity, saveLastCity } from "./storage";

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

export default function App() {
  const [query, setQuery] = useState("Kathmandu");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [unit, setUnit] = useState<Unit>("C");
  const temp = (c: number) => Math.round(convertTemp(c, unit));

  async function runSearch(city: string) {
    setLoading(true);
    setError(null);
    try {
      const p = await findPlace(city);
      if (!p) throw new Error(`No place found for "${city}"`);
      setPlace(p);
      setAir(null);
      void getAirQuality(p).then(setAir);
      setWeather(await getWeather(p));
      saveLastCity(city);
    } catch (err) {
      setError((err as Error).message);
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const p: Place = { name: "My location", country: "", latitude: coords.latitude, longitude: coords.longitude };
          setPlace(p);
          setAir(null);
          void getAirQuality(p).then(setAir);
          setWeather(await getWeather(p));
        } catch (err) {
          setError((err as Error).message);
          setWeather(null);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.code === 1 ? "Location permission denied. Search for a city instead." : "Could not determine your location");
        setLoading(false);
      },
    );
  }

  function updateFavourites(next: string[]) {
    setFavourites(next);
    saveFavourites(next);
  }

  useEffect(() => {
    const city = loadLastCity() ?? "Kathmandu";
    setQuery(city);
    void runSearch(city);
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    void runSearch(query);
  }

  return (
    <main>
      <div className={`sky ${weather ? sceneFor(weather.code, weather.isDay) : "none"}`} data-testid="sky" aria-hidden="true" />
      <h1 className="sr-only">Weather Dashboard</h1>
      <form className="search" onSubmit={search} role="search">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input aria-label="City" placeholder="Search city" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="pill-btn" aria-label="Search" disabled={loading}>{loading ? "…" : "Go"}</button>
        <button type="button" className="icon-btn" aria-label="Use my location" title="Use my location" disabled={loading} onClick={useMyLocation}>📍</button>
        <button type="button" className="icon-btn" aria-label={`Switch to °${unit === "C" ? "F" : "C"}`} title={`Switch to °${unit === "C" ? "F" : "C"}`} onClick={() => setUnit(unit === "C" ? "F" : "C")}>°{unit === "C" ? "F" : "C"}</button>
      </form>
      {favourites.length > 0 && (
        <ul className="row" aria-label="Favourite cities" style={{ listStyle: "none", padding: 0 }}>
          {favourites.map((c) => (
            <li key={c}>
              <button type="button" disabled={loading} onClick={() => { setQuery(c); void runSearch(c); }}>{c}</button>
              <button type="button" aria-label={`Remove ${c} from favourites`} onClick={() => updateFavourites(favourites.filter((f) => f !== c))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted" role="status" aria-live="polite">{loading ? "Loading weather…" : ""}</p>
      {error && (
        <div className="error-card" role="alert">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={() => void runSearch(query)}>Retry</button>
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
      {place && weather && (
        <>
          <section className="hero" aria-label="Current weather">
            <h2>{place.country ? `${place.name}, ${place.country}` : place.name}</h2>
            <WeatherIcon code={weather.code} isDay={weather.isDay} size={72} />
            <p className="hero-temp">{temp(weather.temperature)}°{unit}</p>
            <p className="hero-cond">{describe(weather.code)} · wind {weather.wind} km/h</p>
            {weather.days[0] && <p className="hero-range">H:{temp(weather.days[0].max)}° L:{temp(weather.days[0].min)}°</p>}
            {place.name !== "My location" && !favourites.includes(place.name) && (
              <button type="button" aria-label={`Save ${place.name} to favourites`} onClick={() => updateFavourites([...favourites, place.name])}>☆ Save</button>
            )}
          </section>
          <div className="bento">
            <section className="card" aria-label="Air quality">
              <h2>Air quality</h2>
              {air ? (
                <>
                  <Gauge label="Air quality index" value={air.aqi} max={AQI_GAUGE_MAX} color={aqiLevel(air.aqi).color} text={String(air.aqi)} />
                  <p style={{ color: aqiLevel(air.aqi).color, fontWeight: 600 }}>
                    AQI {air.aqi} · {aqiLevel(air.aqi).label}{air.pm25 !== null && ` · PM2.5 ${air.pm25} µg/m³`}
                  </p>
                </>
              ) : <p className="muted">Air quality unavailable</p>}
            </section>
            <section className="card" aria-label="UV index">
              <h2>UV index</h2>
              {weather.uv !== null && (
                <>
                  <Gauge label="UV level" value={weather.uv} max={UV_GAUGE_MAX} color={uvLevel(weather.uv).color} text={String(weather.uv)} />
                  <p style={{ color: uvLevel(weather.uv).color, fontWeight: 600 }}>UV {weather.uv} · {uvLevel(weather.uv).label}</p>
                </>
              )}
              <p className="muted">{healthAdvice(air?.aqi ?? null, weather.uv)}</p>
            </section>
            <section className="card" aria-label="Wind">
              <h2>Wind</h2>
              {weather.windDir !== null && (
                <svg className="compass" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#ffffff55" strokeWidth="2" />
                  <text x="50" y="16" textAnchor="middle" fontSize="10" fill="currentColor">N</text>
                  <polygon points="50,24 58,56 50,50 42,56" fill="currentColor" transform={`rotate(${(weather.windDir + 180) % 360} 50 50)`} />
                </svg>
              )}
              <p>{weather.wind} km/h{weather.windDir !== null && ` · ${compassPoint(weather.windDir)}`}</p>
            </section>
            {weather.sunrise && weather.sunset && weather.now && (() => {
              const pt = arcPoint(sunProgress(weather.now, weather.sunrise, weather.sunset), 50, 50, 40);
              return (
                <section className="card" aria-label="Sunrise and sunset">
                  <h2>Sun</h2>
                  <svg className="gauge" viewBox="0 0 100 60" aria-hidden="true">
                    <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#ffffff55" strokeWidth="2" strokeDasharray="3 3" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="#ffffff55" />
                    <circle cx={pt.x} cy={pt.y} r="5" fill="#ffe27a" />
                  </svg>
                  <p>↑ {weather.sunrise.slice(11, 16)} · ↓ {weather.sunset.slice(11, 16)}</p>
                </section>
              );
            })()}
            {rainSummary(weather.hours) && <p className="card">{rainSummary(weather.hours)}</p>}
            <section className="card wide" aria-label="Hourly forecast">
              <h2>Hourly forecast</h2>
              <ul className="hourly" aria-label="Hourly forecast">
                {weather.hours.map((h) => (
                  <li key={h.time}><span>{h.time.slice(11, 16)}</span><strong>{temp(h.temp)}°</strong></li>
                ))}
              </ul>
            </section>
          <table className="card wide">
            <caption>Daily forecast</caption>
            <thead><tr><th scope="col">Day</th><th scope="col">Conditions</th><th scope="col">Rain</th><th scope="col">Min</th><th scope="col">Range</th><th scope="col">Max</th></tr></thead>
            <tbody>
              {weather.days.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</td>
                  <td><WeatherIcon code={d.code} /> {describe(d.code)}</td>
                  <td>{d.rain === null ? "–" : `${d.rain}%`}</td>
                  <td>{temp(d.min)}°</td>
                  <td>
                    <div className="range" role="meter" aria-label={`${temp(d.min)}° to ${temp(d.max)}°${unit}`}
                      aria-valuemin={temp(d.min)} aria-valuemax={temp(d.max)} aria-valuenow={temp(d.max)}>
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
      <p className="muted card">Data: <a href="https://open-meteo.com/">Open-Meteo</a></p>
    </main>
  );
}
