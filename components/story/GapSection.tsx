"use client";

import { useRef } from "react";
import { BadgeCheck, Percent } from "lucide-react";
import {
  gsap,
  useGSAP,
  scrollConfigOnce,
  settleReveals,
  MQ_DESKTOP,
  MQ_MOTION_OK,
} from "../../lib/motion";
import { SITE, fmtInt } from "../../lib/site-data";

/* The bar reads on a 0–8% scale so both the reality and the target fit inside.
   Scale headroom stays fixed (it's a chart axis, not a data claim). */
const SCALE_MAX = 8;
const ACTUAL = SITE.cited.global_avg_cost_pct; // World Bank published average
const TARGET = SITE.cited.sdg_target_pct; // UN SDG 10.c

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`;

const BAND_LABELS = ["under 3%", "3–6%", "6–9%", "9–12%", "12–15%", "15%+"];

function bandLabel(band: { up_to_pct: number | null }, i: number): string {
  if (band.up_to_pct === null) return BAND_LABELS[BAND_LABELS.length - 1] ?? "15%+";
  return BAND_LABELS[i] ?? `${band.up_to_pct}%`;
}

/** Section 2 — the gap between what the world pays and what the UN promised,
    verified against our own dataset and grounded in its real distribution.
    Desktop pins and scrubs; mobile plays once on entry; reduced motion lands
    straight on the finals. Pin runway is viewport-relative so the story paces
    the same from a phone to a 4K display. */
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
                // one full viewport of scroll runway — same pacing at any height
                end: () => `+=${Math.round(window.innerHeight * 1.05)}`,
                scrub: 0.6,
                pin: true,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              }
            : {
                trigger: section,
                start: "top 72%",
                toggleActions: "play none none reverse",
              },
        });

        tl.from("[data-reveal]", { opacity: 0, y: 26, stagger: 0.08, duration: 0.45 })
          // scaleX not width: transforms only inside a scrubbed pin
          .from(".gap-fill", { scaleX: 0, transformOrigin: "left center", duration: desktop ? 1 : 0.9, ease: "none" }, 0)
          .to(counter, { v: ACTUAL, duration: desktop ? 1 : 0.9, ease: "none", onUpdate: setNum }, 0)
          .from(".gap-target", { autoAlpha: 0, x: -18, duration: 0.3 }, ">")
          .from(".gap-excess", { scaleX: 0, transformOrigin: "left center", duration: 0.35 }, "<")
          .from(".gap-verify", { opacity: 0, y: 18, duration: 0.35 }, "<+0.1")
          .from(".band-fill", { scaleY: 0, transformOrigin: "bottom center", stagger: 0.05, duration: 0.4 }, "<")
          .from(".band-meta", { opacity: 0, duration: 0.25, stagger: 0.05 }, "<+0.1")
          .from(".gap-note", { opacity: 0, y: 20, duration: 0.4 }, "<+0.15");

        return () => {
          tl.scrollTrigger?.kill();
        };
      });
    },
    { scope },
  );

  const computed = SITE.computed;
  const cited = SITE.cited;
  const maxBand = Math.max(...computed.cost_bands.map((b) => b.quotes));
  const meetingTarget = computed.cost_bands[0]?.quotes ?? 0;
  const meetingShare = maxBand ? Math.round((meetingTarget / computed.transparent_quotes) * 100) : 0;

  return (
    <section id="story-gap" ref={scope} className="section story-gap">
      <div className="shell">
        <p className="eyebrow" data-reveal>
          <Percent size="1em" aria-hidden /> The gap
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

        {/* No data-reveal on the verify strip or note: they get their own
            late-timeline from() tweens, and a second .from() created after the
            batch reveal would snapshot the batch's opacity-0 as its END state
            (0 → 0 — invisible forever). Same rule as AnatomyOfFee's caption. */}
        <p className="gap-verify">
          <BadgeCheck size="1em" aria-hidden />
          <span>
            Independently reproduced: our open pipeline computes{" "}
            <b className="tnum">{computed.avg_total_cost_pct.toFixed(2)}%</b> across{" "}
            <b className="tnum">{fmtInt(computed.transparent_quotes)}</b> transparent quotes for{" "}
            {computed.quarter}. <a href="https://github.com/viji-saravanan/remittance-watch">Check the work</a>.
          </span>
        </p>

        <div
          className="gap-bands"
          role="img"
          aria-label={`Distribution of ${fmtInt(computed.transparent_quotes)} transparent $200 quotes in ${computed.quarter}: ${fmtInt(meetingTarget)} already meet the 3% target, while ${fmtInt(computed.cost_bands[computed.cost_bands.length - 1]?.quotes ?? 0)} cost 15% or more`}
        >
          <p className="bands-title">What the market actually looks like · {computed.quarter}</p>
          <ul className="bands-row">
            {computed.cost_bands.map((band, i) => (
              <li key={bandLabel(band, i)} className={`band${i === 0 ? " band--target" : ""}`}>
                <span className="band-count tnum band-meta">{fmtInt(band.quotes)}</span>
                <span
                  className="band-fill"
                  style={{ height: `${Math.max(4, (band.quotes / maxBand) * 100)}%` }}
                />
                <span className="band-label band-meta">{bandLabel(band, i)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="prose gap-note">
          {fmtInt(meetingTarget)} quotes — {meetingShare}% of the market — already clear the 3%
          bar, so cheap transfer clearly exists. The average is a choice. Every point above the
          target is friction with no purpose: fees stacked on fees, and a{" "}
          <strong>hidden exchange-rate margin most customers never see</strong>.{" "}
          <a href={cited.global_avg_url} target="_blank" rel="noopener noreferrer">
            World Bank RPW, Issue 54 (Q3 2025)
          </a>
          .
        </p>
      </div>
    </section>
  );
}
