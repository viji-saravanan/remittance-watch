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
import { SITE, fmtInt } from "../../lib/site-data";

/** Section 3 — decompose one real transfer (the costliest honest quote this
    quarter, picked by the exporter), then show the digital/cash gap we compute
    ourselves. Desktop pins the stage and scrubs the dissection over a
    viewport-relative runway; mobile plays the same beats on entry. */
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
                end: () => `+=${Math.round(window.innerHeight * 1.25)}`,
                scrub: 0.6,
                pin: true,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              }
            : {
                trigger: section,
                start: "top 70%",
                toggleActions: "play none none reverse",
              },
        });

        tl.from("[data-reveal]", { opacity: 0, y: 26, stagger: 0.08, duration: 0.4 })
          // the three slices measure themselves out of the transfer
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

  const a = SITE.anatomy;
  const computed = SITE.computed;
  const cited = SITE.cited;

  return (
    <section id="story-anatomy" ref={scope} className="section anatomy">
      <div className="shell">
        <p className="eyebrow" data-reveal>
          <Microscope size="1em" aria-hidden /> Anatomy of a fee
        </p>
        <h2 data-reveal>The sticker fee is not the cost.</h2>
        <p className="prose" data-reveal>
          Providers quote a fee at the counter and quietly take a second cut inside the exchange
          rate — the gap between their rate and the mid-market rate. Comparison sites usually show
          you the first number only. We decompose both, because the hidden one is often the bigger
          half.
        </p>

        <div className="anatomy-stage">
          {a && (
            <figure className="anatomy-fig">
              <div
                className="anatomy-bar"
                role="img"
                aria-label={`Of a ${fmtInt(a.lcu_amount)} ${a.currency} transfer from ${a.from_name} to ${a.to_name}, ${a.arrives_pct} percent arrives, ${a.fee_pct} percent is the visible fee, and ${a.margin_pct} percent is the hidden exchange-rate margin`}
              >
                <div className="seg seg--arrives" style={{ width: `${a.arrives_pct}%` }} />
                <div className="seg seg--fee" style={{ width: `${a.fee_pct}%` }} />
                <div className="seg seg--margin" style={{ width: `${a.margin_pct}%` }} />
              </div>
              <div className="anatomy-baseline" aria-hidden="true">
                <span>mid-market truth line</span>
              </div>

              <p className="perdollar tnum" data-reveal>
                <span className="pd pd--arrives">
                  <b>{a.arrives_pct.toFixed(2)}¢</b> of every $1 arrives
                </span>
                <span className="pd pd--fee">
                  <b>{a.fee_pct.toFixed(2)}¢</b> is the printed fee
                </span>
                <span className="pd pd--margin">
                  <b>{a.margin_pct.toFixed(2)}¢</b> hides in the rate
                </span>
              </p>

              <ul className="anatomy-legend tnum" data-reveal>
                <li>
                  <span className="swatch swatch--arrives" aria-hidden /> arrives — {a.arrives_pct}%
                </li>
                <li>
                  <span className="swatch swatch--fee" aria-hidden /> visible fee — {a.fee_pct}%
                </li>
                <li>
                  <span className="swatch swatch--margin" aria-hidden /> hidden FX margin — {a.margin_pct}%
                </li>
              </ul>
              <figcaption className="anatomy-caption tnum">
                The costliest honest quote in this quarter&rsquo;s data: {a.provider}, {a.instrument.toLowerCase()},
                {" "}
                {a.from_name} → {a.to_name}, {fmtInt(a.lcu_amount)} {a.currency} (${a.amount_usd}),{" "}
                {a.quarter}. The fee is printed on the receipt. The margin appears nowhere a
                customer can see it.
              </figcaption>
            </figure>
          )}

          {/* No data-reveal: the timeline slides it in last — a batch reveal
              would double-animate it against the sequenced entrance. */}
          <aside className="compare-card">
            <h3>Digital vs cash</h3>
            <p className="cmp-sub">
              Same ${computed.amount_usd}, same quarter — computed from our own dataset,{" "}
              {fmtInt(computed.transparent_quotes)} quotes.
            </p>
            <div className="cmp-row">
              <Smartphone size="1em" aria-hidden />
              <span className="cmp-name">Digital</span>
              <span className="cmp-track">
                <span
                  className="cmp-fill"
                  style={{
                    width:
                      computed.cash_avg_pct && computed.digital_avg_pct
                        ? `${(computed.digital_avg_pct / computed.cash_avg_pct) * 100}%`
                        : undefined,
                  }}
                />
              </span>
              <b className="tnum">{computed.digital_avg_pct?.toFixed(2) ?? "—"}%</b>
            </div>
            <div className="cmp-row">
              <Banknote size="1em" aria-hidden />
              <span className="cmp-name">Cash</span>
              <span className="cmp-track">
                <span className="cmp-fill" style={{ width: "100%" }} />
              </span>
              <b className="tnum">{computed.cash_avg_pct?.toFixed(2) ?? "—"}%</b>
            </div>
            <p className="cmp-note">
              The people paying cash — {computed.cash_avg_pct ? computed.cash_avg_pct.toFixed(2) : "—"}% vs{" "}
              {computed.digital_avg_pct ? computed.digital_avg_pct.toFixed(2) : "—"}% — can least
              afford it. The World Bank&rsquo;s own split for the quarter: {cited.digital_avg_pct}% /{" "}
              {cited.cash_avg_pct}%.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
