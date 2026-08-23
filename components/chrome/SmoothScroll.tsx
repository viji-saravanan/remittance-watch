"use client";

import { useRef } from "react";
import {
  gsap,
  ScrollSmoother,
  ScrollTrigger,
  useGSAP,
  scrollConfigOnce,
  MQ_MOTION_OK,
} from "../../lib/motion";
import { registerScroller, scrollToId } from "../../lib/scroller";

/** Wraps the page in ScrollSmoother. Smoothing is desktop-only by contract:
    touch keeps native scrolling (data-speed/data-lag parallax still runs),
    and reduced-motion readers get the untouched document. The fixed chrome
    renders as a sibling of this component, never inside it (ADR-0006 §4–5). */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    scrollConfigOnce();

    /* In-page hashes route through lib/scroller: pinned spacers make raw jumps
       land wrong, and CSS smooth-scroll fights ScrollToPlugin. Modifier and
       middle clicks keep browser defaults (open-in-new-tab etc.). */
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement).closest?.('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;
      event.preventDefault();
      scrollToId(id);
    };
    document.addEventListener("click", onClick);

    const mm = gsap.matchMedia();
    mm.add(MQ_MOTION_OK, () => {
      const smoother = ScrollSmoother.create({
        wrapper: "#smooth-wrapper",
        content: "#smooth-content",
        smooth: 1.15,
        effects: true,
        smoothTouch: 0, // native feel on phones — never jar a touchscreen
        normalizeScroll: false, // experimental scroll-jacking — deliberately off (research 05 §4)
      });
      registerScroller(smoother);
      document.fonts.ready.then(() => ScrollTrigger.refresh());
      return () => {
        registerScroller(null);
        smoother.kill();
      };
    });

    return () => document.removeEventListener("click", onClick);
  }, { scope: root });

  return (
    <div ref={root}>
      <div id="smooth-wrapper">
        <div id="smooth-content">{children}</div>
      </div>
    </div>
  );
}
