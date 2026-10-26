// Section reveals and the heartbeat dividers. Content is visible without script: this file arms the
// reveal (html.js-reveal) and plays each one once. Under reduced motion nothing is armed.
import "./motion";

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!still && "IntersectionObserver" in window) {
  document.documentElement.classList.add("js-reveal");
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

  document.querySelectorAll<SVGSVGElement>("[data-beat]").forEach((svg) => {
    const line = svg.querySelector<SVGPathElement>(".line")!;
    line.style.strokeDasharray = "1"; line.style.strokeDashoffset = "1";
    const o = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1400, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" });
      o.disconnect();
    }), { threshold: 0.6 });
    o.observe(svg);
  });
}
