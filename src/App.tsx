import { useEffect, useState } from "react";
import { convertTemp, describe, findPlace, getAirQuality, getWeather, aqiLevel, uvLevel, healthAdvice, rainSummary, iconFor, rangeBar, sceneFor, type AirQuality, type Place, type Unit, type Weather } from "./weather";
import { loadFavourites, saveFavourites, loadLastCity, saveLastCity } from "./storage";

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
      {error && <p className="error" role="alert">{error}</p>}
      {place && weather && (
        <>
          <section className="hero" aria-label="Current weather">
            <h2>{place.country ? `${place.name}, ${place.country}` : place.name}</h2>
            <p className="hero-temp">{temp(weather.temperature)}°{unit}</p>
            <p className="hero-cond">{describe(weather.code)} · wind {weather.wind} km/h</p>
            {weather.days[0] && <p className="hero-range">H:{temp(weather.days[0].max)}° L:{temp(weather.days[0].min)}°</p>}
            {place.name !== "My location" && !favourites.includes(place.name) && (
              <button type="button" aria-label={`Save ${place.name} to favourites`} onClick={() => updateFavourites([...favourites, place.name])}>☆ Save</button>
            )}
          </section>
          <section className="card" aria-label="Air quality and UV">
            <h2 style={{ marginTop: 0 }}>Air quality &amp; UV</h2>
            <p>
              {air ? (
                <span style={{ color: aqiLevel(air.aqi).color, fontWeight: 600 }}>
                  AQI {air.aqi} · {aqiLevel(air.aqi).label}{air.pm25 !== null && ` · PM2.5 ${air.pm25} µg/m³`}
                </span>
              ) : <span className="muted">Air quality unavailable</span>}
            </p>
            {weather.uv !== null && (
              <p><span style={{ color: uvLevel(weather.uv).color, fontWeight: 600 }}>UV {weather.uv} · {uvLevel(weather.uv).label}</span></p>
            )}
            <p className="muted">{healthAdvice(air?.aqi ?? null, weather.uv)}</p>
          </section>
          {rainSummary(weather.hours) && <p className="card">{rainSummary(weather.hours)}</p>}
          <table className="card">
            <caption>Hourly forecast</caption>
            <thead><tr><th scope="col">Hour</th><th scope="col">Temp</th></tr></thead>
            <tbody>
              {weather.hours.map((h) => (
                <tr key={h.time}>
                  <td>{h.time.slice(11, 16)}</td><td>{temp(h.temp)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="card">
            <caption>Daily forecast</caption>
            <thead><tr><th scope="col">Day</th><th scope="col">Conditions</th><th scope="col">Rain</th><th scope="col">Min</th><th scope="col">Range</th><th scope="col">Max</th></tr></thead>
            <tbody>
              {weather.days.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</td>
                  <td><span role="img" aria-label={describe(d.code)}>{iconFor(d.code)}</span> {describe(d.code)}</td>
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
        </>
      )}
      <p className="muted card">Data: <a href="https://open-meteo.com/">Open-Meteo</a></p>
    </main>
  );
}
