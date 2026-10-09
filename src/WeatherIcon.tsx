import { iconKind, describe } from "./weather";

const CLOUD = "M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z";

export default function WeatherIcon({ code, isDay = true, size = 24 }: { code: number; isDay?: boolean; size?: number }) {
  const kind = iconKind(code, isDay);
  return (
    <svg className="wicon" data-icon={kind} role="img" aria-label={describe(code)} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind === "sun" && (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)}
      {kind === "moon" && <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />}
      {kind === "partly-cloudy" && (<><path d="M8 3v1.5M2.5 8.5H4M3.9 4.4l1 1M12.1 4.4l-1 1" /><circle cx="8" cy="8.5" r="2.5" /><path d="M9 20h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 9 14a3 3 0 0 0 0 6z" /></>)}
      {kind === "cloud" && <path d={CLOUD} />}
      {kind === "rain" && (<><path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z" /><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" /></>)}
      {kind === "snow" && (<><path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z" /><path d="M8 18v.01M12 19v.01M16 18v.01M10 21v.01M14 21v.01" strokeWidth="2.4" /></>)}
      {kind === "storm" && (<><path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z" /><path d="M12.5 15l-2.5 4h3l-2 3" /></>)}
      {kind === "fog" && (<><path d="M7 13h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 6a3.5 3.5 0 0 0 1 7z" /><path d="M4 17h16M6 20.5h12" /></>)}
    </svg>
  );
}
