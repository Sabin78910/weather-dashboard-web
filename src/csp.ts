/** Content-Security-Policy for the production build: same-origin code and styles, Open-Meteo APIs and the encrypted sync API. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com https://sync-api.sabin-apps.workers.dev",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Adds the CSP <meta> right after <meta charset> (build only; the dev server needs inline scripts for HMR). */
export const injectCsp = (html: string): string =>
  html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
