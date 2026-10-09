import { EN, NE, detectLang, num, t } from "./i18n";
import { describe as wx, dailyTips, rainSummary, shareSummary } from "./weather";
import { loadLang, saveLang } from "./storage";

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

test("every English key has a non-empty Nepali translation with the same placeholders", () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
  expect(Object.keys(NE).sort()).toEqual(Object.keys(EN).sort());
  for (const k of Object.keys(EN) as (keyof typeof EN)[]) {
    expect(NE[k].trim(), k).not.toBe("");
    expect(ph(NE[k]), k).toEqual(ph(EN[k]));
  }
});

test("t interpolates and num localises digits", () => {
  expect(t("en", "removeFav", { city: "Oslo" })).toBe("Remove Oslo from favourites");
  expect(t("ne", "tipUmbrella", { pct: num("ne", 80) })).toContain("८०");
  expect(num("en", 12)).toBe("12");
  expect(num("ne", "06:30")).toBe("०६:३०");
});

test("detectLang follows navigator.language", () => {
  vi.stubGlobal("navigator", { language: "ne-NP" });
  expect(detectLang()).toBe("ne");
  vi.stubGlobal("navigator", { language: "fr-FR" });
  expect(detectLang()).toBe("en");
  vi.stubGlobal("navigator", {});
  expect(detectLang()).toBe("en");
});

test("language preference persists and rejects junk", () => {
  expect(loadLang()).toBeNull();
  saveLang("ne");
  expect(loadLang()).toBe("ne");
  localStorage.setItem("lang", "xx");
  expect(loadLang()).toBeNull();
});

test("domain text is translated", () => {
  expect(wx(0, "ne")).toBe(NE.wx0);
  expect(wx(0)).toBe("Clear sky");
  expect(wx(7, "ne")).toBe(NE.unknown);
  expect(rainSummary([{ time: "2026-10-08T15:00", temp: 1, rain: 70 }], "ne")).toBe("३ बेलुका बजेतिर वर्षा हुन सक्छ (७०%)");
  expect(dailyTips({ temperature: 20, code: 1, days: [{ date: "d", max: 25, min: 15, code: 1, rain: null }], hours: [], uv: 7 }, null, "ne")[0].text).toBe("सनस्क्रिन लगाउनुहोस्: पराबैंगनी सूचकांक ७ छ।");
  expect(shareSummary({ name: "Pokhara", country: "", latitude: 0, longitude: 0 }, { temperature: 20, code: 0, days: [] }, "C", "ne")).toBe("आज Pokhara: खुला आकाश, २०°C।");
});
