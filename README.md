# Weather Dashboard

Current weather and 7-day forecast for any city (Open-Meteo, no API key).

![CI](https://github.com/Sabin78910/weather-dashboard-web/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/Sabin78910/weather-dashboard-web/actions/workflows/deploy.yml/badge.svg)

**Live:** https://sabin78910.github.io/weather-dashboard-web/

Built with React, TypeScript and Vite. Tested with Vitest and Testing Library.

## Develop (VS Code)
```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

## Automation (runs on GitHub, no laptop needed)
| Workflow | Trigger | What it does |
|---|---|---|
| CI | push / PR to main | lint, typecheck, tests, build, npm audit |
| Deploy to GitHub Pages | push to main | publishes the site |
| CodeQL | push / PR / weekly | security analysis |
| Dependabot | weekly | dependency update PRs |

## Android home-screen widget

The web app pushes the primary city's current temperature, condition icon and today's high/low to a
native Capacitor plugin named `WeatherWidget` after every successful refresh (`src/widget.ts`). On the web
this is a no-op. Payload: `{ city, temp, high, low, unit, condition, icon, updatedAt }`.

Setup (done once, on a machine with Android Studio):

1. `npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap init` (web dir: `dist`), then `npm run build && npx cap add android`.
2. Add a Capacitor plugin class `WeatherWidgetPlugin` (`@CapacitorPlugin(name = "WeatherWidget")`) whose `update(call)`
   stores the payload in `SharedPreferences` and calls `AppWidgetManager.notifyAppWidgetViewDataChanged`.
3. Add an `AppWidgetProvider` with `updatePeriodMillis="1800000"` (system schedule) that reads those preferences.
   Refreshing on app open is automatic: each load calls `update`.
4. Use `values/colors.xml` and `values-night/colors.xml` for the widget's background and text so it is readable in
   both light and dark system themes (keep AA contrast).
5. Make the widget root's `PendingIntent` open `MainActivity` with the data URI `https://sabin78910.github.io/weather-dashboard-web/?city=<city>`;
   the app reads `?city=` on launch and opens that city.

## Performance budget
CI fails if the gzipped JavaScript in `dist/assets` exceeds **180 KB** (`.github/scripts/check-bundle-size.mjs`, no dependencies). Run it locally after `npm run build` with `node .github/scripts/check-bundle-size.mjs`.
