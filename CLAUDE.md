# Weather
Living sky weather app: animated conditions, 24h scrubber, rain nowcast, 10 day forecast.

## Stack
React 19 · TypeScript (strict) · Vite · Vitest · ESLint. Installable PWA with offline support.
Design: sky gradient driven by condition and time of day, glass bento cards, Inter.

## Commands
- Dev: `npm run dev` · Build: `npm run build`
- Test: `npm test` · Lint: `npm run lint && npm run typecheck`

## Architecture
- `src/sky.ts` canvas sky model · `src/forecast.ts` Open-Meteo parsing · `src/cities.ts` favourites
- Sky rendering is separate from data: never fetch inside a draw loop.

## Data rules
- Open-Meteo only, no API key. Cache the last city so first paint is never blank.
- Cross-device sync uses the shared Sabin Labs ID: the sync code in localStorage key `sabin-labs-sync-code`,
  shared by every app on sabin78910.github.io. Never log it or send it anywhere but sync-api.

## Testing rules
- Every behaviour change needs a test. Pure logic in `src/*.ts` is unit-tested; components get the
  behaviour test, not the markup. Run lint, typecheck and tests before finishing.

## Frontend rules
- Keep the existing design system, dark-first with a working light theme. Editorial layouts, not dashboard
  grids. Respect `prefers-reduced-motion`, keep AA contrast and 44px targets.
- Self-host fonts with @fontsource; a Google Fonts link blocks first paint and costs ~2s on mobile.
- Keep gzipped JS under ~180KB and Lighthouse mobile performance at 90+.

## Security and git
- Never commit secrets, keystores, .env files or email addresses.
- Keep the Content-Security-Policy strict; add a host to connect-src only when a feature needs it.
- `main` is protected: branch, open a PR, merge when CI is green. One issue per PR, under ~300 lines.

## Done when
Lint clean, tests pass, CI green, PR opened with a three line summary.
