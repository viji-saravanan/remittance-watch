/* Page-level scroll routing. Anchors and nav dots both go through here so
   pinned sections land correctly and CSS smooth-scroll never fights
   ScrollToPlugin (ADR-0006 §6). */

import { gsap } from "./motion";

type SmootherLike = { scrollTo: (target: Element, smooth?: boolean) => void };

let smoother: SmootherLike | null = null;

export function registerScroller(s: SmootherLike | null) {
  smoother = s;
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.scrollIntoView(); // instant — CSS forces `auto` under reduced motion
    return;
  }
  if (smoother) {
    smoother.scrollTo(el, true);
  } else {
    gsap.to(window, {
      duration: 0.8,
      ease: "power3.inOut",
      scrollTo: { y: el, offsetY: 0 },
    });
  }
}
