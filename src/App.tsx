import { useEffect, useState } from "react";
import { convertTemp, describe, findPlace, getWeather, iconFor, rangeBar, type Place, type Unit, type Weather } from "./weather";
import { loadLastCity, saveLastCity } from "./storage";

export default function App() {
  const [query, setQuery] = useState("Kathmandu");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<Unit>("C");
  const temp = (c: number) => Math.round(convertTemp(c, unit));

  async function runSearch(city: string) {
    setLoading(true);
    setError(null);
    try {
      const p = await findPlace(city);
      if (!p) throw new Error(`No place found for "${city}"`);
      setPlace(p);
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

  useEffect(() => {
    const last = loadLastCity();
    if (last) {
      setQuery(last);
      void runSearch(last);
    }
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    void runSearch(query);
  }

  return (
    <main>
      <h1>Weather Dashboard</h1>
      <form className="row card" onSubmit={search}>
        <input aria-label="City" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Search"}</button>
        <button type="button" disabled={loading} onClick={useMyLocation}>Use my location</button>
        <button type="button" onClick={() => setUnit(unit === "C" ? "F" : "C")}>Switch to °{unit === "C" ? "F" : "C"}</button>
      </form>
      <p className="muted" role="status" aria-live="polite">{loading ? "Loading weather…" : ""}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {place && weather && (
        <>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{place.country ? `${place.name}, ${place.country}` : place.name}</h2>
            <p style={{ fontSize: 40, margin: 0 }}>{temp(weather.temperature)}°{unit}</p>
            <p className="muted">{describe(weather.code)} · wind {weather.wind} km/h</p>
          </section>
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
      <p className="muted">Data: <a href="https://open-meteo.com/">Open-Meteo</a></p>
    </main>
  );
}
