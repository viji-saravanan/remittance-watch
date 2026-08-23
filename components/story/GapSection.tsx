"use client";

import { useRef } from "react";
import { Percent } from "lucide-react";
import {
  gsap,
  useGSAP,
  scrollConfigOnce,
  settleReveals,
  MQ_DESKTOP,
  MQ_MOTION_OK,
} from "../../lib/motion";

/* The bar reads on a 0–8% scale so both the reality and the target fit inside. */
const SCALE_MAX = 8;
const ACTUAL = 6.36; // global average cost of sending $200 — RPW Issue 54, Q3 2025
const TARGET = 3; // UN SDG 10.c: under 3% by 2030

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`;

const CITE_RPW =
  "https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf";

/** Section 2 — the gap between what the world pays and what the UN promised.
    Desktop pins and scrubs the count-up + bar flood; mobile plays once on
    entry without pinning; reduced motion lands straight on the finals. */
export function GapSection() {
  const scope = useRef<HTMLElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      scrollConfigOnce();
      const mm = gsap.matchMedia();

      mm.add({ desktop: MQ_DESKTOP, motion: MQ_MOTION_OK }, ({ conditions }) => {
        const desktop = Boolean(conditions?.desktop);
        const section = scope.current!;
        if (!conditions?.motion) {
          settleReveals(section);
          return;
        }

        const counter = { v: 0 };
        const setNum = () => {
          if (numEl.current) numEl.current.textContent = counter.v.toFixed(2);
        };

        const tl = gsap.timeline({
          scrollTrigger: desktop
            ? {
                trigger: section,
                start: "top top",
                end: "+=900", // short pin — mobile-CPU contract (ADR-0006 §5)
                scrub: 0.6,
                pin: true,
                anticipatePin: 1,
              }
            : {
                trigger: section,
                start: "top 72%",
                toggleActions: "play none none reverse",
              },
        });

        tl.from("[data-reveal]", { opacity: 0, y: 26, stagger: 0.08, duration: 0.45 })
          .from(".gap-fill", { width: 0, duration: desktop ? 1 : 0.9, ease: "none" }, 0)
          .to(counter, { v: ACTUAL, duration: desktop ? 1 : 0.9, ease: "none", onUpdate: setNum }, 0)
          .from(".gap-target", { autoAlpha: 0, x: -18, duration: 0.3 }, ">")
          .from(".gap-excess", { scaleX: 0, transformOrigin: "left center", duration: 0.35 }, "<")
          .from(".gap-note", { opacity: 0, y: 20, duration: 0.4 }, "<+0.1");

        return () => {
          tl.scrollTrigger?.kill();
        };
      });
    },
    { scope },
  );

  return (
    <section id="story-gap" ref={scope} className="section story-gap">
      <div className="shell">
        <p className="eyebrow" data-reveal>
          <Percent size={15} aria-hidden /> The gap
        </p>
        <h2 className="gap-headline tnum" aria-label={`Global average transfer cost: ${ACTUAL} percent`}>
          <span ref={numEl} className="gap-figure">
            {ACTUAL.toFixed(2)}
          </span>
          <span className="gap-unit">%</span>
        </h2>
        <p className="gap-sub" data-reveal>
          is what the world pays, on average, to send $200 across borders — nearly double the
          UN&rsquo;s promise of a 3% world by 2030 (SDG target 10.c).
        </p>

        <div
          className="gap-bar"
          role="img"
          aria-label={`Cost bar reaching ${ACTUAL} percent against the UN target of ${TARGET} percent; ${(ACTUAL - TARGET).toFixed(2)} points of excess highlighted`}
        >
          <div className="gap-track">
            <div className="gap-fill" style={{ width: pct(ACTUAL) }} />
            <div className="gap-excess" style={{ left: pct(TARGET), width: pct(ACTUAL - TARGET) }}>
              <span>+{(ACTUAL - TARGET).toFixed(2)} pts</span>
            </div>
            <div className="gap-target" style={{ left: pct(TARGET) }}>
              <span>UN target · under {TARGET}%</span>
            </div>
          </div>
          <div className="gap-scale tnum" aria-hidden="true">
            <span>0%</span>
            <span>{SCALE_MAX}%</span>
          </div>
        </div>

        <p className="prose gap-note" data-reveal>
          Every point above the target is friction with no purpose — fees stacked on fees, and a{" "}
          <strong>hidden exchange-rate margin most customers never see</strong>.{" "}
          <a href={CITE_RPW} target="_blank" rel="noopener noreferrer">
            World Bank RPW, Issue 54 (Q3 2025)
          </a>
          .
        </p>
      </div>
    </section>
  );
}
