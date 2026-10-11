/** Open-Meteo's current and minutely_15 data advance in 15-minute steps, so polling faster returns identical data. */
export const REFRESH_MS = 15 * 60_000;

/** True once data fetched at `dataAt` (epoch ms) is a full refresh interval old; false when there is no data. */
export const isStale = (dataAt: number | null, now: number): boolean => dataAt !== null && now - dataAt >= REFRESH_MS;

/** Poll only while the tab is visible and the browser is online. */
export const canPoll = (visible: boolean, online: boolean): boolean => visible && online;

/** Milliseconds until the next scheduled refresh for data fetched at `dataAt`; 0 when already due. */
export const nextRefreshDelay = (dataAt: number, now: number): number => Math.max(0, dataAt + REFRESH_MS - now);

/** "HH:MM" of the model time the API reports for the current conditions, or null when missing. */
export const modelTime = (iso: string | null): string | null => (iso && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso) ? iso.slice(11, 16) : null);
