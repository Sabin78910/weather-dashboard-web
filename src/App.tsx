import { useEffect, useState } from "react";
import { convertTemp, describe, findPlace, getWeather, type Place, type Unit, type Weather } from "./weather";
import { loadLastCity, saveLastCity } from "./storage";

export default function App() {
  const [query, setQuery] = useState("Kathmandu");
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<Unit>("C");
  const t = (c: number) => Math.round(convertTemp(c, unit));

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
        <button type="button" onClick={() => setUnit(unit === "C" ? "F" : "C")}>
          {`Switch to °${unit === "C" ? "F" : "C"}`}
        </button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {place && weather && (
        <>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{place.name}, {place.country}</h2>
            <p style={{ fontSize: 40, margin: 0 }}>{t(weather.temperature)}°{unit}</p>
            <p className="muted">{describe(weather.code)} · wind {weather.wind} km/h</p>
          </section>
          <table className="card">
            <thead><tr><th>Day</th><th>Conditions</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              {weather.days.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</td>
                  <td>{describe(d.code)}</td><td>{t(d.min)}°</td><td>{t(d.max)}°</td>
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
