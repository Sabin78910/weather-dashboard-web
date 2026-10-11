import { useEffect, useRef, type CSSProperties } from "react";
import type { SkyState } from "../sky";

type Pt = { x: number; y: number; s: number; v: number; p: number };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (cur: number, target: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-dt / 450));

function cloudSprite(dark: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 150;
  const g = c.getContext("2d")!;
  for (const [x, y, r] of [[90, 95, 55], [150, 70, 70], [215, 80, 60], [270, 100, 45], [180, 108, 60]]) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const col = dark ? "70,80,98" : "255,255,255";
    grad.addColorStop(0, `rgba(${col},0.9)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Draws sun rays, moon, stars, clouds, rain, snow, fog and lightning over the CSS gradient. */
function startSky(canvas: HTMLCanvasElement, get: () => SkyState, reduced: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { redraw: () => {}, stop: () => {} };
  const sprites = [cloudSprite(false), cloudSprite(true)];
  let w = 0, h = 0, raf = 0, last = 0, flash = 0, nextBolt = 0;
  let bolt: [number, number][] | null = null;
  let stars: Pt[] = [], clouds: Pt[] = [], drops: Pt[] = [], flakes: Pt[] = [];
  const cur = { cloud: 0, rain: 0, snow: 0, fog: 0, stars: 0, sunX: 0.5, el: 0 };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = w < 700;
    stars = Array.from({ length: Math.min(150, Math.round((w * h) / 9000)) }, () => ({ x: rnd(0, w), y: rnd(0, h * 0.75), s: rnd(0.4, 1.4), v: rnd(0.4, 1.6), p: rnd(0, 6.3) }));
    clouds = Array.from({ length: 9 }, (_, i) => ({ x: rnd(-200, w), y: rnd(-20, h * 0.45), s: rnd(0.7, 1.7) * (small ? 0.7 : 1), v: rnd(4, 12), p: i }));
    drops = Array.from({ length: small ? 90 : 170 }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(10, 22), v: rnd(700, 1100), p: 0 }));
    flakes = Array.from({ length: small ? 70 : 130 }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(1.2, 3.4), v: rnd(25, 70), p: rnd(0, 6.3) }));
    if (reduced) draw(performance.now(), 0);
  };

  function draw(t: number, dt: number) {
    const s = get();
    const step = reduced ? 1e9 : dt;
    cur.cloud = ease(cur.cloud, s.fx.cloud, step);
    cur.rain = ease(cur.rain, s.fx.rain, step);
    cur.snow = ease(cur.snow, s.fx.snow, step);
    cur.fog = ease(cur.fog, s.fx.fog, step);
    cur.stars = ease(cur.stars, s.stars, step);
    cur.sunX = ease(cur.sunX, s.sunX, step);
    cur.el = ease(cur.el, s.elevation, step);
    ctx!.clearRect(0, 0, w, h);
    const sec = dt / 1000;

    // Stars (twinkle) and moon at night.
    if (cur.stars > 0.02) {
      for (const st of stars) {
        ctx!.globalAlpha = cur.stars * (reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.0012 * st.v + st.p));
        ctx!.fillStyle = "#fff";
        ctx!.fillRect(st.x, st.y, st.s, st.s);
      }
    }
    const night = Math.max(0, Math.min(1, -cur.el * 3));
    if (night > 0.02) {
      const mx = w * 0.8, my = h * 0.14;
      ctx!.globalAlpha = night * (1 - cur.cloud * 0.8);
      const g = ctx!.createRadialGradient(mx, my, 0, mx, my, 90);
      g.addColorStop(0, "rgba(220,230,255,0.35)");
      g.addColorStop(1, "rgba(220,230,255,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(mx - 90, my - 90, 180, 180);
      ctx!.fillStyle = "#eef2ff";
      ctx!.beginPath();
      ctx!.arc(mx, my, 16, 0, Math.PI * 2);
      ctx!.fill();
    }

    // Sun with slowly turning rays.
    const day = Math.max(0, Math.min(1, (cur.el + 0.15) / 0.3));
    if (day > 0.02) {
      const sx = w * (0.12 + 0.76 * cur.sunX), sy = h * (0.3 - 0.22 * Math.max(0, cur.el));
      const a = day * (1 - cur.cloud * 0.85);
      ctx!.globalAlpha = a;
      const glow = ctx!.createRadialGradient(sx, sy, 0, sx, sy, 260);
      glow.addColorStop(0, cur.el < 0.2 ? "rgba(255,190,120,0.55)" : "rgba(255,244,200,0.5)");
      glow.addColorStop(1, "rgba(255,240,200,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(sx - 260, sy - 260, 520, 520);
      ctx!.save();
      ctx!.translate(sx, sy);
      ctx!.rotate(reduced ? 0 : t * 0.00004);
      ctx!.globalAlpha = a * 0.09;
      ctx!.fillStyle = "#fff6d8";
      for (let i = 0; i < 12; i++) {
        ctx!.rotate(Math.PI / 6);
        ctx!.beginPath();
        ctx!.moveTo(0, 0);
        ctx!.lineTo(-18, Math.max(w, h));
        ctx!.lineTo(18, Math.max(w, h));
        ctx!.fill();
      }
      ctx!.restore();
      ctx!.globalAlpha = a;
      ctx!.fillStyle = "#fffbe8";
      ctx!.beginPath();
      ctx!.arc(sx, sy, 24, 0, Math.PI * 2);
      ctx!.fill();
    }

    // Drifting clouds; darker when it rains or at night.
    const n = cur.cloud * clouds.length;
    const dark = Math.min(1, cur.rain * 0.9 + night * 0.7);
    clouds.forEach((c, i) => {
      if (i >= Math.ceil(n)) return;
      const a = Math.min(1, n - i) * (0.35 + 0.5 * cur.cloud);
      c.x += c.v * sec;
      if (c.x > w + 50) c.x = -360 * c.s;
      const dw = 360 * c.s, dh = 150 * c.s;
      ctx!.globalAlpha = a * (1 - dark);
      ctx!.drawImage(sprites[0], c.x, c.y, dw, dh);
      ctx!.globalAlpha = a * dark;
      ctx!.drawImage(sprites[1], c.x, c.y, dw, dh);
    });

    // Fog bands.
    if (cur.fog > 0.02) {
      for (let i = 0; i < 3; i++) {
        const y = h * (0.35 + i * 0.2);
        const g = ctx!.createLinearGradient(0, y - 80, 0, y + 80);
        g.addColorStop(0, "rgba(220,226,232,0)");
        g.addColorStop(0.5, "rgba(220,226,232,0.55)");
        g.addColorStop(1, "rgba(220,226,232,0)");
        ctx!.globalAlpha = cur.fog * 0.5;
        ctx!.fillStyle = g;
        ctx!.fillRect(0, y - 80, w, 160);
      }
    }

    // Rain streaks.
    const nd = Math.round(cur.rain * drops.length);
    if (nd) {
      ctx!.globalAlpha = 0.5;
      ctx!.strokeStyle = "rgba(200,220,255,0.75)";
      ctx!.lineWidth = 1.2;
      ctx!.beginPath();
      for (let i = 0; i < nd; i++) {
        const d = drops[i];
        d.y += d.v * sec;
        d.x -= d.v * sec * 0.12;
        if (d.y > h) { d.y = -d.s; d.x = rnd(0, w + 100); }
        ctx!.moveTo(d.x, d.y);
        ctx!.lineTo(d.x - d.s * 0.12, d.y + d.s);
      }
      ctx!.stroke();
    }

    // Snowflakes swaying.
    const nf = Math.round(cur.snow * flakes.length);
    if (nf) {
      ctx!.globalAlpha = 0.9;
      ctx!.fillStyle = "#fff";
      for (let i = 0; i < nf; i++) {
        const f = flakes[i];
        f.y += f.v * sec;
        f.x += Math.sin(t * 0.001 + f.p) * 12 * sec;
        if (f.y > h) { f.y = -4; f.x = rnd(0, w); }
        ctx!.beginPath();
        ctx!.arc(f.x, f.y, f.s, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    // Lightning: a soft flash every 4–9 s (never more than one per 4 s, safe for photosensitivity).
    if (s.fx.storm && !reduced) {
      if (t > nextBolt) {
        if (nextBolt) {
          flash = 1;
          let x = rnd(w * 0.2, w * 0.8), y = 0;
          bolt = [[x, y]];
          while (y < h * 0.55) { x += rnd(-30, 30); y += rnd(25, 55); bolt.push([x, y]); }
        }
        nextBolt = t + rnd(4000, 9000);
      }
      if (flash > 0) {
        ctx!.globalAlpha = flash * 0.22;
        ctx!.fillStyle = "#e8eeff";
        ctx!.fillRect(0, 0, w, h);
        if (bolt && flash > 0.55) {
          ctx!.globalAlpha = flash;
          ctx!.strokeStyle = "#f4f7ff";
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          bolt.forEach(([x, y], i) => (i ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)));
          ctx!.stroke();
        }
        flash = Math.max(0, flash - dt / 380);
      }
    }
    ctx!.globalAlpha = 1;
  }

  const loop = (t: number) => {
    draw(t, last ? Math.min(50, t - last) : 16);
    last = t;
    raf = requestAnimationFrame(loop);
  };
  const onVis = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
  };
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVis);
  onVis();
  return {
    redraw: () => reduced && draw(performance.now(), 0),
    stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

/** Full-bleed living sky: CSS gradient (smoothly transitioned) plus a canvas effects layer. */
export default function SkyCanvas({ state, scene }: { state: SkyState; scene: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const api = useRef<{ redraw: () => void } | null>(null);
  useEffect(() => {
    stateRef.current = state;
    api.current?.redraw();
  }, [state]);
  useEffect(() => {
    // No matchMedia means no real rendering engine (e.g. tests): skip the canvas entirely.
    if (!canvas.current || typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stop = () => {};
    // Start after first paint so the sky never delays the content.
    const id = requestAnimationFrame(() => {
      const r = startSky(canvas.current!, () => stateRef.current, reduced);
      api.current = r;
      stop = r.stop;
    });
    return () => { cancelAnimationFrame(id); stop(); };
  }, []);
  const vars = { "--sky-top": state.top, "--sky-bottom": state.bottom } as CSSProperties;
  return (
    <div className={`sky ${scene}`} data-testid="sky" aria-hidden="true" style={vars}>
      <canvas ref={canvas} />
    </div>
  );
}
