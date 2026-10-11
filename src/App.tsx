import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { compareWithYesterday, convertTemp, formatWind, describe, findPlace, getAirQuality, getWeather, dailyTips, severeOutlook, sceneFor, shareSummary, type AirQuality, type Place, type Unit, type Weather } from "./weather";
import { skyFor } from "./sky";
import { LANGS, detectLang, formatDateTime, freshnessLabel, num, t, type Key, type Lang } from "./i18n";
import { loadFavourites, saveFavourites, moveItem, loadLastCity, saveLastCity, loadForecast, saveForecast, loadLang, saveLang, loadCityForecast, saveCityForecast, loadUnit, saveUnit, loadTheme, saveTheme, loadSettingsUpdatedAt, saveSettingsUpdatedAt, type ForecastSnapshot, type Theme } from "./storage";
import SyncPanel from "./components/SyncPanel";
import { useSettingsSync, type SyncSettings } from "./settingsSync";
import SkyCanvas from "./components/SkyCanvas";
import Hourly from "./components/Hourly";
import Daily from "./components/Daily";
import { AirCard, FeelsCard, PollenCard, PrecipCard, PressureCard, SevereBanner, SunCard, TipsCard, UvCard, WindCard, nowcastText } from "./components/Cards";
import Icon from "./components/icons";
import { motionOK, tick, useCountUp } from "./components/motion";
import type { Fmt } from "./components/fmt";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// A failed fetch (rather than an HTTP/API error) means the network is unreachable.
const isOffline = (err: unknown) => !navigator.onLine || err instanceof TypeError;

export const STALE_MS = 10 * 60_000;
export const RETRY_DELAYS_MS = [2000, 5000, 15000];
const MY_LOCATION = "My location";
const SWIPE_PX = 56;
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

const systemTheme = (): Theme => (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** Big temperature that counts up; renders a bare text node so "21°C" stays one string. */
function CountUp({ value, n }: { value: number; n: (v: number) => string }) {
  return <>{n(useCountUp(value))}</>;
}

export default function App() {
  const [boot] = useState(() => {
    const city = loadLastCity() ?? "Kathmandu";
    return { city, preview: loadCityForecast(city) };
  });
  const [query, setQuery] = useState(boot.city);
  const [preview, setPreview] = useState<ForecastSnapshot | null>(boot.preview);
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [error, setError] = useState<ErrorMsg | null>(null);
  const [loading, setLoading] = useState(false);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [fresh, setFresh] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => loadLang() ?? detectLang());
  const [unit, setUnit] = useState<Unit>(() => loadUnit() ?? "C");
  const [theme, setTheme] = useState<Theme | null>(loadTheme);
  const [settingsAt, setSettingsAt] = useState(loadSettingsUpdatedAt);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [dismissedSevere, setDismissedSevere] = useState<string[]>([]);
  const [scrub, setScrub] = useState(0);
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const runId = useRef(0);
  const refreshOnFocus = useRef<() => void>(() => {});
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const heroRef = useRef<HTMLElement>(null);

  const L = (key: Key, params?: Record<string, string | number>) => t(lang, key, params);
  const n = (v: number | string) => num(lang, v);
  const rawTemp = (c: number) => Math.round(convertTemp(c, unit));
  const temp = (c: number) => n(rawTemp(c));
  const f: Fmt = { lang, unit, L, n, temp };
  const changeLang = (next: Lang) => { setLang(next); saveLang(next); };
  const resolvedTheme = theme ?? systemTheme();
  const applySynced = useCallback((m: SyncSettings) => {
    setFavourites(m.favourites); saveFavourites(m.favourites);
    setUnit(m.unit); saveUnit(m.unit);
    setTheme(m.theme); if (m.theme) saveTheme(m.theme);
    setSettingsAt(m.updatedAt); saveSettingsUpdatedAt(m.updatedAt);
  }, []);
  const sync = useSettingsSync({ favourites, unit, theme, updatedAt: settingsAt }, applySynced);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  async function fetchForecast(city: string) {
    const p = await findPlace(city);
    if (!p) throw new NotFoundError(city);
    // Air quality runs in parallel so its card fills in with the forecast, not after it.
    const airReq = getAirQuality(p);
    return { p, w: await getWeather(p), airReq };
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
      const { p, w, airReq } = result;
      setPlace(p);
      setAir(null);
      void airReq.then((a) => { if (id === runId.current) setAir(a); });
      setWeather(w);
      setPreview(null);
      setCachedAt(null);
      setUpdatedAt(Date.now());
      saveLastCity(city);
      const snap = { place: p, weather: w, savedAt: Date.now() };
      saveForecast(snap);
      saveCityForecast([city, p.name], snap);
    } catch (err) {
      if (id !== runId.current) return;
      const cached: ForecastSnapshot | null = loadCityForecast(city) ?? loadForecast();
      setPreview(null);
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

  function locateMe() {
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
          setCachedAt(null);
          setUpdatedAt(Date.now());
          setScrub(0);
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

  function touchSettings() {
    const at = Date.now();
    setSettingsAt(at);
    saveSettingsUpdatedAt(at);
  }

  function updateFavourites(next: string[]) {
    setFavourites(next);
    saveFavourites(next);
    touchSettings();
  }

  /** Switch city page: paint the cached forecast instantly, then refresh. */
  function goToCity(city: string, dir: "next" | "prev" | null = null) {
    if (city === MY_LOCATION) return locateMe();
    const cached = loadCityForecast(city);
    if (cached) {
      setPlace(cached.place);
      setWeather(cached.weather);
      setAir(null);
    }
    setSlide(dir);
    setScrub(0);
    setQuery(city);
    void runSearch(city);
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

  const dataAt = cachedAt ?? updatedAt;
  refreshOnFocus.current = () => {
    if (loading || dataAt === null || !place || Date.now() - dataAt < STALE_MS) return;
    if (place.name === MY_LOCATION) locateMe();
    else void runSearch(place.name);
  };
  useEffect(() => {
    const tickId = setInterval(() => setNow(Date.now()), 60_000);
    const onVisible = () => {
      if (document.visibilityState !== "hidden") { setNow(Date.now()); refreshOnFocus.current(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(tickId); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  useEffect(() => {
    const runs = runId;
    void runSearch(boot.city);
    return () => { runs.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; the cleanup invalidates the latest run
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setSlide(null);
    void runSearch(query);
  }

  // City pages: the current city (if not saved) followed by favourites.
  const shown = weather ? place : preview?.place ?? null;
  const pages = shown && !favourites.includes(shown.name) ? [shown.name, ...favourites] : favourites;
  const pageIdx = shown ? pages.indexOf(shown.name) : -1;
  const goPage = (step: 1 | -1) => {
    const next = pages[pageIdx + step];
    if (next) { tick(); goToCity(next, step === 1 ? "next" : "prev"); }
  };

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (pages.length < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  }
  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      s.moved = true;
      heroRef.current?.style.setProperty("--drag", `${Math.max(-120, Math.min(120, dx * 0.6))}px`);
    }
  }
  function onPointerEnd(e: PointerEvent<HTMLElement>) {
    const s = swipe.current;
    heroRef.current?.style.removeProperty("--drag");
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(e.clientY - s.y)) goPage(dx < 0 ? 1 : -1);
    // Keep `moved` until the click that follows a drag has been swallowed.
    setTimeout(() => { swipe.current = null; }, 0);
  }

  const shownWeather = weather ?? preview?.weather ?? null;
  const tl = shownWeather?.timeline ?? [];
  const hour = scrub > 0 ? tl[scrub] : undefined;
  const sky = useMemo(() => {
    if (!shownWeather) {
      const d = new Date();
      const iso = `2000-01-01T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return skyFor({ code: 2, isDay: d.getHours() >= 6 && d.getHours() < 18, time: iso, sunrise: "2000-01-01T06:00", sunset: "2000-01-01T18:00" });
    }
    const w = shownWeather;
    return hour
      ? skyFor({ code: hour.code ?? w.code, isDay: hour.isDay ?? w.isDay, time: hour.time, sunrise: w.sunrise, sunset: w.sunset })
      : skyFor({ code: w.code, isDay: w.isDay, time: w.now, sunrise: w.sunrise, sunset: w.sunset });
  }, [shownWeather, hour]);
  const scene = weather ? (hour ? sceneFor(hour.code ?? weather.code, hour.isDay ?? weather.isDay) : sceneFor(weather.code, weather.isDay)) : "none";

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sky.top);
  }, [sky.top]);

  const placeName = (p: Place) => (p.name === MY_LOCATION ? L("myLocation") : p.country ? `${p.name}, ${p.country}` : p.name);
  const sev = place && weather ? severeOutlook(weather.days, unit) : null;
  const sevKey = sev && place ? `${place.name}|${sev.date}` : null;
  const tips = weather ? dailyTips(weather, air?.aqi ?? null, lang) : [];

  /** Hero for live data, or a preview of the cached forecast while it refreshes (not a landmark until live). */
  const hero = (p: Place, w: Weather, live: boolean) => {
    const c = w.days[0] && w.yesterdayMax !== null ? compareWithYesterday(w.days[0].max, w.yesterdayMax) : null;
    const wind = formatWind(w.wind, unit);
    const rainLine = nowcastText(w, f);
    return (
      <section
        ref={heroRef} className={`hero${live ? "" : " is-preview"}`} aria-label={live ? L("currentWeather") : undefined} aria-busy={live ? undefined : true}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        onClickCapture={(e) => { if (swipe.current?.moved) e.stopPropagation(); }}
      >
        <div className={`hero-inner${slide && motionOK() ? ` from-${slide}` : ""}`} key={p.name}>
          <h2 className="hero-place">{p.name === MY_LOCATION && <Icon name="pin" size={18} />}{placeName(p)}</h2>
          <p className="hero-temp"><CountUp value={rawTemp(w.temperature)} n={n} />°{unit}</p>
          <p className="hero-cond">{L("heroCond", { cond: describe(w.code, lang), wind: n(wind.value), unit: L(wind.unit) })}</p>
          <div className="hero-row">
            {w.days[0] && <p className="hero-range">{L("hl", { max: temp(w.days[0].max), min: temp(w.days[0].min) })}</p>}
            {c && <p className="hero-range hero-delta" aria-live="polite">{c.trend === "same" ? L("sameAsYesterday") : L(c.trend === "warmer" ? "warmerThanYesterday" : "coolerThanYesterday", { diff: n(unit === "F" ? Math.round((c.diff * 9) / 5) : c.diff) })}</p>}
          </div>
          <div className="hero-row hero-stats">
            {w.feelsLike !== null && <p className="hero-range">{L("feelsLike", { temp: temp(w.feelsLike) })}</p>}
            {w.humidity !== null && <p className="hero-range">{L("humidity", { pct: n(Math.round(w.humidity)) })}</p>}
          </div>
          {live && dataAt !== null && <p className="hero-range hero-fresh">{freshnessLabel(lang, now - dataAt)}</p>}
          {rainLine && <p className="hero-nowcast"><Icon name="drop" size={16} /> {rainLine}</p>}
        </div>
        {live && (
          <div className="hero-actions">
            <button type="button" className="glass-btn" aria-label={L("shareAria")} onClick={() => { setShareNote(null); void share(); }}><Icon name="share" size={18} /> {L("share")}</button>
            {p.name !== MY_LOCATION && !favourites.includes(p.name) && (
              <button type="button" className="glass-btn" aria-label={L("saveFav", { city: p.name })} onClick={() => { tick(12); setFresh(p.name); updateFavourites([...favourites, p.name]); }}>{L("save")}</button>
            )}
            {installEvent && <button type="button" className="glass-btn" onClick={() => void install()}>{L("install")}</button>}
          </div>
        )}
        {live && shareNote && <p className="muted note" role="status">{shareNote}</p>}
        {pages.length > 1 && pageIdx >= 0 && (
          <div className="pager">
            <button type="button" className="icon-btn ghost" aria-label={L("prevCity")} disabled={pageIdx === 0 || loading} onClick={() => goPage(-1)}><Icon name="left" /></button>
            <span className="dots" aria-hidden="true">{pages.map((pg, i) => <i key={pg} className={i === pageIdx ? "on" : ""} />)}</span>
            <button type="button" className="icon-btn ghost" aria-label={L("nextCity")} disabled={pageIdx === pages.length - 1 || loading} onClick={() => goPage(1)}><Icon name="right" /></button>
          </div>
        )}
      </section>
    );
  };

  const showSkeleton = loading && !weather;
  return (
    <main className="app">
      <SkyCanvas state={sky} scene={scene} />
      <h1 className="sr-only">{L("title")}</h1>
      <header className="topbar">
        <span className="brand" aria-hidden="true"><Icon name="sun" size={22} /></span>
        <div className="lang-switch seg" role="group" aria-label={L("language")}>
          {LANGS.map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => changeLang(l)}>{l === "en" ? "EN" : "नेपाली"}</button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label={L(resolvedTheme === "dark" ? "themeLight" : "themeDark")} title={L(resolvedTheme === "dark" ? "themeLight" : "themeDark")}
          onClick={() => { const next = resolvedTheme === "dark" ? "light" : "dark"; setTheme(next); saveTheme(next); touchSettings(); }}>
          <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} />
        </button>
        <button type="button" className="unit-toggle" aria-label={L("switchUnit", { unit: unit === "C" ? "F" : "C" })} title={L("switchUnit", { unit: unit === "C" ? "F" : "C" })}
          onClick={() => { const next = unit === "C" ? "F" : "C"; tick(); setUnit(next); saveUnit(next); touchSettings(); }}>
          <span className={unit === "C" ? "on" : ""}>°C</span><span className={unit === "F" ? "on" : ""}>°F</span>
        </button>
      </header>
      <form className="search" onSubmit={search} role="search">
        <Icon name="search" className="search-icon" />
        <input aria-label={L("city")} placeholder={L("searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        <button type="submit" className="pill-btn" aria-label={L("search")} disabled={loading}>{loading ? "…" : L("go")}</button>
        <button type="button" className="icon-btn" aria-label={L("useLocation")} title={L("useLocation")} disabled={loading} onClick={locateMe}><Icon name="pin" /></button>
      </form>
      {favourites.length > 0 && (
        <ul className="chips" aria-label={L("favourites")}>
          {favourites.map((c, i) => (
            <li key={c} className={`chip${c === fresh ? " pop" : ""}${shown?.name === c ? " active" : ""}`}>
              <button type="button" className="chip-mv" aria-label={L("moveLeft", { city: c })} disabled={i === 0} onClick={() => updateFavourites(moveItem(favourites, i, -1))}>‹</button>
              <button type="button" className="chip-name" disabled={loading} aria-current={shown?.name === c ? "true" : undefined} onClick={() => goToCity(c)}>{c}</button>
              <button type="button" className="chip-mv" aria-label={L("moveRight", { city: c })} disabled={i === favourites.length - 1} onClick={() => updateFavourites(moveItem(favourites, i, 1))}>›</button>
              <button type="button" className="chip-x" aria-label={L("removeFav", { city: c })} onClick={() => updateFavourites(favourites.filter((x) => x !== c))}><Icon name="x" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="status" role="status" aria-live="polite">{loading ? L("loading") : ""}</p>
      {error && (
        <div className="error-card" role="alert">
          {error.key === "friendlyError" && <ErrorIllustration label={L("errorArt")} />}
          <p>{L(error.key, error.params)}</p>
          <button type="button" className="pill-btn" disabled={loading} onClick={() => void runSearch(query)}>{L("retry")}</button>
        </div>
      )}
      {retrying && <p className="note-chip" role="status">{L("retrying")}{updatedAt !== null && L("lastUpdated", { when: formatDateTime(lang, updatedAt) })}</p>}
      {cachedAt !== null && <p className="note-chip" role="status">{L("offline", { when: formatDateTime(lang, cachedAt) })}</p>}
      <div className="layout">
        {place && weather ? hero(place, weather, true)
          : showSkeleton && preview ? hero(preview.place, preview.weather, false)
          : showSkeleton ? (
            <section className="hero is-skeleton" aria-hidden="true">
              <div className="hero-inner">
                <h2 className="hero-place">{query}</h2>
                <span className="sk-temp" />
                <span className="sk-line" /><span className="sk-line short" />
              </div>
            </section>
          ) : null}
        <div className="content">
          {sev && sevKey && !dismissedSevere.includes(sevKey) && (
            <SevereBanner sev={sev} f={f} onDismiss={() => setDismissedSevere([...dismissedSevere, sevKey])} />
          )}
          {showSkeleton && (
            <div className="bento" data-testid="skeleton" aria-hidden="true">
              <div className="card skeleton wide sk-tall" />
              <div className="card skeleton wide" />
              <div className="card skeleton" />
              <div className="card skeleton" />
              <div className="card skeleton" />
              <div className="card skeleton" />
            </div>
          )}
          {place && weather && (
            <div className="bento">
              <Hourly weather={weather} f={f} scrub={scrub} onScrub={(i) => { if (i !== scrub) tick(4); setScrub(i); }} />
              <PrecipCard weather={weather} f={f} />
              <Daily weather={weather} f={f} />
              <AirCard air={air} f={f} />
              <UvCard weather={weather} air={air} f={f} />
              <WindCard weather={weather} f={f} />
              <FeelsCard weather={weather} f={f} />
              <SunCard weather={weather} f={f} />
              <PressureCard weather={weather} f={f} />
              {air && <PollenCard air={air} f={f} />}
              {tips.length > 0 && <TipsCard tips={tips} f={f} />}
            </div>
          )}
          <p className="credit">{L("data")} <a href="https://open-meteo.com/">Open-Meteo</a></p>
        </div>
      </div>
      <SyncPanel L={L} {...sync} />
    </main>
  );
}
