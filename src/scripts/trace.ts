// Noise to information: a synthetic abdominal ECG (mother + fetus + noise) is carried, point by point,
// onto a clean fetal heartbeat. The pairing is the 1D optimal transport map along time: sources and
// targets are each sorted by x and matched in order, which is the exact W2-optimal monotone map for the
// time marginal. Every point keeps its mass, and no two paths cross. Each point then travels its
// displacement interpolation (McCann), staggered left to right like a monitor sweep.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { lenisReady } from "./motion";

gsap.registerPlugin(ScrollTrigger);

const SECONDS = 3.2;                 // how much recording the strip shows
const MATERNAL_PERIOD = 0.82;        // s, about 73 bpm
const FETAL_PERIOD = 0.42;           // s, about 143 bpm

// Gaussian PQRST template; t is phase in seconds from beat onset
function pqrst(t: number, period: number, scale: number) {
  const p = ((t % period) + period) % period;
  const g = (mu: number, sd: number, a: number) => a * Math.exp(-((p - mu) ** 2) / (2 * sd * sd));
  const k = period / 0.8;
  return scale * (g(0.16 * k, 0.025 * k, 0.12) + g(0.27 * k, 0.008 * k, -0.14) + g(0.3 * k, 0.011 * k, 1) +
    g(0.33 * k, 0.009 * k, -0.24) + g(0.52 * k, 0.045 * k, 0.28));
}

// seeded RNG so every visit draws the same recording
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }

const maternal = (s: number) => pqrst(s + 0.05, MATERNAL_PERIOD, 0.62);
const fetal = (s: number) => pqrst(s + 0.21, FETAL_PERIOD, 1);

type Pts = { sx: Float32Array; sy: Float32Array; tx: Float32Array; ty: Float32Array; d: Float32Array };

function build(n: number, aspect: number): Pts {
  const r = rng(20260527);
  // sources: the abdominal recording, mother dominant, fetus faint, noise and wander on top
  const src: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = r();
    const s = x * SECONDS;
    const wander = 0.09 * Math.sin(2 * Math.PI * 0.31 * s + 0.7) + 0.05 * Math.sin(2 * Math.PI * 0.9 * s);
    const y = maternal(s) + 0.22 * fetal(s) + wander + 0.075 * gauss(r) + 0.03 * Math.sin(2 * Math.PI * 50 * s);
    src.push([x, y]);
  }
  // targets: the clean fetal trace, sampled evenly by arc length in screen proportions, so steep
  // complexes get more points and the map moves mass sideways as well as up and down
  const fine = 4000, xs: number[] = [], ys: number[] = [], acc: number[] = [0];
  for (let i = 0; i <= fine; i++) { const x = i / fine; xs.push(x); ys.push(0.72 * fetal(x * SECONDS) - 0.12); }
  for (let i = 1; i <= fine; i++) {
    const dx = (xs[i] - xs[i - 1]) * aspect, dy = (ys[i] - ys[i - 1]) * 0.5;
    acc.push(acc[i - 1] + Math.hypot(dx, dy));
  }
  const total = acc[fine], tgt: [number, number][] = [];
  for (let i = 0, j = 0; i < n; i++) {
    const want = ((i + 0.5) / n) * total;
    while (j < fine && acc[j + 1] < want) j++;
    const f = (want - acc[j]) / (acc[j + 1] - acc[j] || 1);
    tgt.push([xs[j] + f * (xs[j + 1] - xs[j]), ys[j] + f * (ys[j + 1] - ys[j])]);
  }
  // 1D optimal transport along time: sort both, match in order
  src.sort((a, b) => a[0] - b[0]);
  tgt.sort((a, b) => a[0] - b[0]);
  const p: Pts = { sx: new Float32Array(n), sy: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n), d: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    p.sx[i] = src[i][0]; p.sy[i] = src[i][1]; p.tx[i] = tgt[i][0]; p.ty[i] = tgt[i][1];
    p.d[i] = 0.12 * r(); // a little personal delay, so the sweep reads as many points, not one sheet
  }
  return p;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mountTrace(canvas: HTMLCanvasElement, hero: HTMLElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 64rem)").matches;
  const N = small ? 560 : 1400;
  let w = 0, h = 0, dpr = 1, pts: Pts, colNoise = "", colClean = "";
  const state = { intro: still ? 1 : 0, scrub: 0 };

  const readColours = () => {
    const cs = getComputedStyle(document.documentElement);
    colNoise = cs.getPropertyValue("--trace-noise").trim();
    colClean = cs.getPropertyValue("--trace-clean").trim();
  };

  const size = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    pts = build(N, w / h);
  };

  const X = (x: number) => x * w;
  const Y = (y: number) => h * (0.62 - y * 0.42);

  const strip = canvas.parentElement as HTMLElement;
  const draw = () => {
    const T = Math.max(0, Math.min(1, state.intro * (1 - state.scrub)));
    strip.dataset.state = T > 0.9 ? "clean" : "raw";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const rad = small ? 1.15 : 1.05;
    // two passes so the colour change costs two fills, not one per point
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? colNoise : colClean;
      ctx.beginPath();
      for (let i = 0; i < pts.sx.length; i++) {
        const local = Math.max(0, Math.min(1, (T * 1.45 - pts.sx[i] * 0.33 - pts.d[i])));
        const e = easeInOut(local);
        if ((pass === 0) !== (e < 0.6)) continue;
        const x = X(pts.sx[i] + (pts.tx[i] - pts.sx[i]) * e);
        const y = Y(pts.sy[i] + (pts.ty[i] - pts.sy[i]) * e);
        ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // once the transport has landed, the trace is drawn crisp on top of its points
    const land = Math.max(0, Math.min(1, (T - 0.82) / 0.18));
    if (land > 0) {
      ctx.globalAlpha = land;
      ctx.strokeStyle = colClean; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
      ctx.beginPath();
      const steps = Math.min(1400, w * 1.5);
      for (let i = 0; i <= steps; i++) {
        const x = i / steps, y = 0.72 * fetal(x * SECONDS) - 0.12;
        i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  readColours(); size(); draw();
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  addEventListener("themechange", () => { readColours(); draw(); });
  if (still) return;

  // plays once on load, then the scroll owns it
  // on phones the strip can sit below the first screen, so the transport waits until it is seen
  const play = () => gsap.to(state, { intro: 1, duration: 2.6, delay: 0.35, ease: "none", onUpdate: schedule });
  new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); play(); } }, { threshold: 0.4 }).observe(canvas);
  lenisReady.then(() => {
    ScrollTrigger.create({
      trigger: hero, start: "top top", end: "bottom top", scrub: 0.6,
      onUpdate: (st) => { state.scrub = st.progress * 0.95; schedule(); },
    });
  });
}
