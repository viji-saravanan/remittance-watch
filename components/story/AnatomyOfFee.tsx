"use client";

import { useRef } from "react";
import { Banknote, Microscope, Smartphone } from "lucide-react";
import {
  gsap,
  useGSAP,
  scrollConfigOnce,
  settleReveals,
  MQ_DESKTOP,
  MQ_MOTION_OK,
} from "../../lib/motion";

const CITE_RPW =
  "https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf";

/* Real workbook row (Issue 54, Q3 2025): 33,000 AOA cash transfer, Angola → Namibia.
   Widths are % of the whole transfer; digital-vs-cash bars scale to 7.30% max. */
const SEGMENTS = [
  { key: "arrives", width: "90.06%", label: "arrives — 90.06%" },
  { key: "fee", width: "6.84%", label: "visible fee — 6.84%" },
  { key: "margin", width: "3.10%", label: "hidden FX margin — 3.10%" },
] as const;

/** Section 3 — decompose one real transfer, then show the digital/cash gap.
    Desktop pins the stage and scrubs the dissection; mobile plays the same
    beats on entry without pinning; reduced motion shows finals immediately. */
export function AnatomyOfFee() {
  const scope = useRef<HTMLElement>(null);

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

        const tl = gsap.timeline({
          scrollTrigger: desktop
            ? {
                trigger: section,
                start: "top top",
                end: "+=1100",
                scrub: 0.6,
                pin: true,
                anticipatePin: 1,
              }
            : {
                trigger: section,
                start: "top 70%",
                toggleActions: "play none none reverse",
              },
        });

        tl.from("[data-reveal]", { opacity: 0, y: 26, stagger: 0.08, duration: 0.4 })
          // the three slices measure themselves out of the $200
          .from(
            ".seg",
            { scaleX: 0, transformOrigin: "left center", stagger: 0.18, duration: 0.5, ease: "power2.out" },
            "<+0.2",
          )
          .from(".seg", { opacity: 0, duration: 0.01 }, "<")
          // then the story: dashed mid-market line draws…
          .from(".anatomy-baseline", { scaleX: 0, transformOrigin: "left center", duration: 0.35 })
          // …the printed fee lifts off the receipt…
          .to(".seg--fee", { y: -16, duration: 0.35, ease: "power2.inOut" }, ">")
          // …and the buried margin sinks beneath the truth line
          .to(".seg--margin", { y: 30, duration: 0.35, ease: "power2.inOut" }, "<")
          .from(".anatomy-caption", { opacity: 0, y: 16, duration: 0.3 }, "<+0.15")
          // finally the channel comparison slides across
          .from(
            ".compare-card",
            { autoAlpha: 0, xPercent: desktop ? 28 : 0, yPercent: desktop ? 0 : 24, duration: 0.45 },
            ">+0.05",
          );

        return () => {
          tl.scrollTrigger?.kill();
        };
      });
    },
    { scope },
  );

  return (
    <section id="story-anatomy" ref={scope} className="section anatomy">
      <div className="shell">
        <p className="eyebrow" data-reveal>
          <Microscope size={15} aria-hidden /> Anatomy of a fee
        </p>
        <h2 data-reveal>The sticker fee is not the cost.</h2>
        <p className="prose" data-reveal>
          Providers quote a fee at the counter and quietly take a second cut inside the exchange
          rate — the gap between their rate and the mid-market rate. Comparison sites usually show
          you the first number only. We decompose both, because the hidden one is often the bigger
          half.
        </p>

        <div className="anatomy-stage">
          <figure className="anatomy-fig">
            <div
              className="anatomy-bar"
              role="img"
              aria-label="Of a 33,000 kwanza transfer, 90.06 percent arrives, 6.84 percent is the visible fee, and 3.10 percent is the hidden exchange-rate margin"
            >
              {SEGMENTS.map((segment) => (
                <div key={segment.key} className={`seg seg--${segment.key}`} style={{ width: segment.width }} />
              ))}
            </div>
            <div className="anatomy-baseline" aria-hidden="true">
              <span>mid-market truth line</span>
            </div>
            <ul className="anatomy-legend tnum" data-reveal>
              {SEGMENTS.map((segment) => (
                <li key={segment.key}>
                  <span className={`swatch swatch--${segment.key}`} aria-hidden />
                  {segment.label}
                </li>
              ))}
            </ul>
            <figcaption className="anatomy-caption tnum">
              One real row from the source workbook: a 33,000&nbsp;AOA cash transfer, Angola&nbsp;→
              Namibia, Q3&nbsp;2025. The fee is printed on the receipt. The margin appears nowhere a
              customer can see it.{" "}
              <a href={CITE_RPW} target="_blank" rel="noopener noreferrer">
                World Bank RPW, Issue 54
              </a>
              .
            </figcaption>
          </figure>

          {/* No data-reveal: the timeline slides it in last — a batch reveal
              would double-animate it against the sequenced entrance. */}
          <aside className="compare-card">
            <h3>Digital vs cash</h3>
            <p className="cmp-sub">Same $200, same corridors, same quarter.</p>
            <div className="cmp-row">
              <Smartphone size={15} aria-hidden />
              <span className="cmp-name">Digital</span>
              <span className="cmp-track">
                <span className="cmp-fill" style={{ width: "62.9%" }} />
              </span>
              <b className="tnum">4.59%</b>
            </div>
            <div className="cmp-row">
              <Banknote size={15} aria-hidden />
              <span className="cmp-name">Cash</span>
              <span className="cmp-track">
                <span className="cmp-fill" style={{ width: "100%" }} />
              </span>
              <b className="tnum">7.30%</b>
            </div>
            <p className="cmp-note">The people paying 7% can least afford it.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
