// A small, honest optimal transport demo: uniform mass on noisy source points and on points of a
// clean curve, squared-distance cost, entropic OT solved by Sinkhorn iterations. Small ε approaches
// the exact (Wasserstein) plan; larger ε spreads it, as a Sinkhorn divergence does.
type P = { x: number; y: number };

const N = 10;
const curve = (x: number) => 0.5 - 0.22 * Math.exp(-((x - 0.5) ** 2) / 0.004) + 0.07 * Math.exp(-((x - 0.78) ** 2) / 0.006) + 0.05 * Math.exp(-((x - 0.25) ** 2) / 0.004);

function sinkhorn(a: P[], b: P[], eps: number) {
  const n = a.length, m = b.length;
  const C = a.map((p) => b.map((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2));
  // log-domain updates keep small ε stable
  const f = new Array(n).fill(0), g = new Array(m).fill(0);
  const la = -Math.log(n), lb = -Math.log(m);
  const lse = (v: number[]) => { const mx = Math.max(...v); return mx + Math.log(v.reduce((s, x) => s + Math.exp(x - mx), 0)); };
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < n; i++) f[i] = eps * (la - lse(g.map((gj, j) => (gj - C[i][j]) / eps)));
    for (let j = 0; j < m; j++) g[j] = eps * (lb - lse(f.map((fi, i) => (fi - C[i][j]) / eps)));
  }
  const Pm = C.map((row, i) => row.map((c, j) => Math.exp((f[i] + g[j] - c) / eps)));
  let cost = 0;
  Pm.forEach((row, i) => row.forEach((p, j) => (cost += p * C[i][j])));
  return { P: Pm, cost };
}

export function mountOT() {
  const cv = document.getElementById("ot") as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  const slider = document.getElementById("eps") as HTMLInputElement;
  const epsOut = document.getElementById("eps-out")!;
  const costOut = document.getElementById("cost-out")!;
  const reshuffle = document.getElementById("ot-reshuffle")!;

  const tgt: P[] = Array.from({ length: N }, (_, j) => { const x = 0.08 + (0.84 * j) / (N - 1); return { x, y: curve(x) }; });
  let src: P[] = [];
  const noise = () => {
    src = Array.from({ length: N }, () => ({ x: 0.08 + Math.random() * 0.84, y: 0.5 + (Math.random() - 0.5) * 0.7 }));
  };
  noise();

  let w = 0, h = 0, dpr = 1, ink = "", acc = "", rule = "", muted = "";
  const colours = () => { const cs = getComputedStyle(document.documentElement); ink = cs.getPropertyValue("--ink").trim(); acc = cs.getPropertyValue("--accent").trim(); rule = cs.getPropertyValue("--rule").trim(); muted = cs.getPropertyValue("--muted").trim(); };
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; };
  const eps = () => 0.0015 * Math.pow(10, (+slider.value / 100) * 2); // 0.0015 to 0.15, log scale

  const draw = () => {
    const e = eps();
    const { P, cost } = sinkhorn(src, tgt, e);
    epsOut.textContent = `ε = ${e.toFixed(3)}`;
    costOut.textContent = `transport cost ${cost.toFixed(4)}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const X = (x: number) => x * w, Y = (y: number) => y * h;
    // the clean curve
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = i / 200; i ? ctx.lineTo(X(x), Y(curve(x))) : ctx.moveTo(X(x), Y(curve(x))); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    // the plan: one line per pair, weight is mass moved
    ctx.strokeStyle = acc;
    P.forEach((row, i) => row.forEach((p, j) => {
      const m = p * N; if (m < 0.02) return;
      ctx.globalAlpha = Math.min(1, 0.15 + m * 0.85); ctx.lineWidth = 0.6 + m * 2.2;
      ctx.beginPath(); ctx.moveTo(X(src[i].x), Y(src[i].y)); ctx.lineTo(X(tgt[j].x), Y(tgt[j].y)); ctx.stroke();
    }));
    ctx.globalAlpha = 1;
    ctx.fillStyle = acc;
    tgt.forEach((q) => { ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), 4.5, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
    src.forEach((p) => { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 6, 0, Math.PI * 2); ctx.stroke(); });
  };

  // dragging
  let held = -1;
  const at = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  cv.addEventListener("pointerdown", (e) => {
    const p = at(e); let best = -1, bd = 0.004;
    src.forEach((s, i) => { const d = (s.x - p.x) ** 2 * (w / h) ** 2 + (s.y - p.y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { held = best; cv.setPointerCapture(e.pointerId); cv.classList.add("dragging"); }
  });
  let raf = 0;
  cv.addEventListener("pointermove", (e) => {
    if (held < 0) return;
    const p = at(e); src[held] = { x: Math.min(0.98, Math.max(0.02, p.x)), y: Math.min(0.96, Math.max(0.04, p.y)) };
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
  });
  const drop = () => { held = -1; cv.classList.remove("dragging"); };
  cv.addEventListener("pointerup", drop); cv.addEventListener("pointercancel", drop);

  slider.addEventListener("input", draw);
  reshuffle.addEventListener("click", () => { noise(); draw(); });
  addEventListener("themechange", () => { colours(); draw(); });
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
  colours(); size(); draw();
}
