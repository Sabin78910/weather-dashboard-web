import { useState } from "react";
import { describe, findPlace, formatTemp, getWeather, type Place, type Unit, type Weather } from "./weather";

export default function App() {
  const [query, setQuery] = useState("Kathmandu");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("C");
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const p = await findPlace(query);
      if (!p) throw new Error(`No place found for "${query}"`);
      setPlace(p);
      setWeather(await getWeather(p));
    } catch (err) {
      setError((err as Error).message);
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Weather Dashboard</h1>
      <form className="row card" onSubmit={search}>
        <input aria-label="City" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Search"}</button>
        <button type="button" onClick={() => setUnit(unit === "C" ? "F" : "C")} aria-label="Toggle temperature unit">
          Switch to °{unit === "C" ? "F" : "C"}
        </button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {place && weather && (
        <>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{place.name}, {place.country}</h2>
            <p style={{ fontSize: 40, margin: 0 }}>{formatTemp(weather.temperature, unit)}</p>
            <p className="muted">{describe(weather.code)} · wind {weather.wind} km/h</p>
          </section>
          <table className="card">
            <thead><tr><th>Day</th><th>Conditions</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              {weather.days.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</td>
                  <td>{describe(d.code)}</td><td>{formatTemp(d.min, unit, false)}</td><td>{formatTemp(d.max, unit, false)}</td>
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
