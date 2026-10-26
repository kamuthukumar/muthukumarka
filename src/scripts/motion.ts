// Lenis smooth scroll wired to GSAP's ticker so ScrollTrigger and the scroll agree on every frame.
// Under reduced motion there is no Lenis: native scrolling, and every scrub is skipped by its owner.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let resolve!: (l: Lenis | null) => void;
export const lenisReady = new Promise<Lenis | null>((r) => (resolve = r));

if (typeof window !== "undefined") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    resolve(null);
  } else {
    const lenis = new Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: -72 } });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    resolve(lenis);
  }
}
