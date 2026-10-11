import { useEffect, useRef, useState } from "react";

/** True when the browser supports media queries and the user has not asked for reduced motion. */
export const motionOK = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Integer that counts up (ease-out) to `target`; returns `target` directly when motion is off. */
export function useCountUp(target: number, ms = 900): number {
  const [shown, setShown] = useState(() => (motionOK() ? 0 : target));
  const from = useRef(shown);
  useEffect(() => {
    if (!motionOK()) return;
    const a = from.current;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - start) / ms);
      const v = Math.round(a + (target - a) * (1 - (1 - k) ** 4));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return motionOK() ? shown : target;
}

/** Light haptic tick where supported (Android); silently ignored elsewhere. */
export const tick = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not allowed (e.g. no user gesture yet)
  }
};
