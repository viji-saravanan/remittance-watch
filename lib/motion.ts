/* Central GSAP setup — every animated component imports from here so plugins
   register exactly once (ADR-0006). Never import gsap directly elsewhere. */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(
  useGSAP,
  ScrollTrigger,
  ScrollSmoother,
  ScrollToPlugin,
  SplitText,
  DrawSVGPlugin,
);

export {
  gsap,
  ScrollTrigger,
  ScrollSmoother,
  ScrollToPlugin,
  SplitText,
  DrawSVGPlugin,
  useGSAP,
};

/* Media-query vocabulary — one definition, referenced everywhere (ADR-0006 §5). */
export const MQ_DESKTOP = "(min-width: 768px)";
export const MQ_MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const MQ_REDUCE = "(prefers-reduced-motion: reduce)";
export const MQ_FINE_POINTER = "(hover: hover) and (pointer: fine)";

let configured = false;

/** Address-bar resizes on phones fire viewport changes big enough to make
    ScrollTrigger teleport pinned sections; tell it to ignore those (ADR-0006 §5).
    Slight drift on rotation is the accepted tradeoff. */
export function scrollConfigOnce() {
  if (!configured) {
    ScrollTrigger.config({ ignoreMobileResize: true });
    configured = true;
  }
}

/* Reveal primitives. Everything is CSS-visible by default; gsap.from() applies
   the start state only once JS is live, so the exported HTML reads perfectly
   without it (progressive-enhancement contract, ADR-0006 §4). */

export function riseIn(targets: gsap.DOMTarget, vars: gsap.TweenVars = {}) {
  return gsap.from(targets, {
    opacity: 0,
    y: 28,
    duration: 0.9,
    ease: "power3.out",
    stagger: 0.09,
    ...vars,
  });
}

/** Entrance reveals tied to scroll position for unpinned sections. */
export function revealOnEnter(
  targets: gsap.DOMTarget,
  trigger: Element | string,
  start = "top 78%",
) {
  return gsap.from(targets, {
    opacity: 0,
    y: 26,
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.08,
    scrollTrigger: { trigger, start, toggleActions: "play none none reverse" },
  });
}

/** Final resting state for every [data-reveal] element — used in the
    reduced-motion branch so nothing is ever left invisible (ADR-0006 §4). */
export function settleReveals(root: Element) {
  gsap.set(root.querySelectorAll("[data-reveal]"), { opacity: 1, y: 0 });
}
