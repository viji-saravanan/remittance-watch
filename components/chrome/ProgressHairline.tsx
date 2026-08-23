"use client";

import { useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  useGSAP,
  scrollConfigOnce,
  MQ_MOTION_OK,
  MQ_REDUCE,
} from "../../lib/motion";

/** Reading-progress hairline pinned to the very top of the viewport.
    Fixed chrome lives OUTSIDE the ScrollSmoother wrapper — the wrapper's
    transform would otherwise become its containing block (ADR-0006 §5). */
export function ProgressHairline() {
  const bar = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    scrollConfigOnce();
    const mm = gsap.matchMedia();

    mm.add(MQ_REDUCE, () => {
      gsap.set(bar.current, { scaleX: 0 });
    });

    mm.add(MQ_MOTION_OK, () => {
      const st = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => gsap.set(bar.current, { scaleX: self.progress }),
      });
      return () => st.kill();
    });
  }, { dependencies: [] });

  return (
    <div className="progress-hairline" aria-hidden="true">
      <div ref={bar} className="progress-hairline__bar" />
    </div>
  );
}
