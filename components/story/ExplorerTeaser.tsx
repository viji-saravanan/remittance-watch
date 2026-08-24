"use client";

import { useRef } from "react";
import Link from "next/link";
import { BadgeCheck, Circle, Hourglass, MoveRight, Route, Search } from "lucide-react";
import {
  gsap,
  useGSAP,
  scrollConfigOnce,
  revealOnEnter,
  settleReveals,
  MQ_DESKTOP,
  MQ_MOTION_OK,
} from "../../lib/motion";
import { SITE, fmtInt, type Corridor } from "../../lib/site-data";

/* Deterministic choreography seed — spreads the flight directions evenly
   without any randomness, so every render/prerender is identical. */
const seed = (i: number) => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/* Flight origins as FRACTIONS of the viewport, resolved to px at tween time
   (invalidateOnRefresh recomputes on resize) — the convergence covers the same
   visual share of a phone as of a 4K display. Never hardcoded pixels. */
const flightFor = (i: number) => ({
  fx: (seed(i) * 2 - 1) * 0.24,
  fy: (seed(i + 40) * 2 - 1) * 0.34,
  r: (seed(i + 80) * 2 - 1) * 9,
});

function Chip({ corridor, index, lag }: { corridor: Corridor; index: number; lag?: boolean }) {
  const f = flightFor(index);
  return (
    <li
      className="chip-slot"
      data-lag={lag ? "0.12" : undefined}
      title={`${corridor.from_name} → ${corridor.to_name} · ${fmtInt(corridor.quotes)} quotes · ${corridor.avg_cost_pct}% average total cost`}
    >
      <span className="chip" data-i={index} data-fx={f.fx} data-fy={f.fy} data-r={f.r}>
        {corridor.from_iso3}
        <MoveRight size="1em" aria-hidden />
        {corridor.to_iso3}
        <b className="chip-cost tnum">{corridor.avg_cost_pct}%</b>
      </span>
    </li>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === "shipped") return <BadgeCheck size="1em" aria-hidden />;
  if (state === "in progress") return <Hourglass size="1em" aria-hidden />;
  return <Circle size="1em" aria-hidden />;
}

/** Section 4 — what's coming: the real busiest corridors (each chip carries its
    true average cost) converge into the search field, above the open build
    log. Desktop scrubs the convergence; mobile plays it on entry. */
export function ExplorerTeaser() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      scrollConfigOnce();
      const mm = gsap.matchMedia();

      mm.add({ desktop: MQ_DESKTOP, motion: MQ_MOTION_OK }, ({ conditions }) => {
        if (!conditions?.motion) {
          settleReveals(scope.current!);
          return;
        }

        revealOnEnter(".explorer-head [data-reveal]", ".explorer-head");

        const chips = gsap.from(".chip", {
          x: (_i, el: Element) => window.innerWidth * Number((el as HTMLElement).dataset.fx),
          y: (_i, el: Element) => window.innerHeight * Number((el as HTMLElement).dataset.fy),
          rotation: (_i, el: Element) => Number((el as HTMLElement).dataset.r),
          opacity: 0,
          duration: conditions.desktop ? 1 : 0.8,
          ease: "power2.out",
          stagger: { each: 0.04, from: "edges" },
          scrollTrigger: conditions.desktop
            ? {
                trigger: ".chip-cloud",
                start: "top 88%",
                end: "top 38%",
                scrub: 0.5,
                invalidateOnRefresh: true,
              }
            : { trigger: ".chip-cloud", start: "top 80%", toggleActions: "play none none reverse" },
        });

        revealOnEnter(".search-mock", ".search-mock", "top 88%");
        revealOnEnter(".log li", ".log", "top 85%");

        return () => {
          chips.scrollTrigger?.kill();
        };
      });
    },
    { scope },
  );

  const corridors = SITE.top_corridors;

  return (
    <section id="story-explorer" ref={scope} className="section explorer">
      <div className="shell explorer-head">
        <p className="eyebrow" data-reveal>
          <Route size="1em" aria-hidden /> Corridor explorer · live
        </p>
        <h2 data-reveal>Search any corridor. See the true cost first.</h2>
        <p className="prose" data-reveal>
          The World Bank prices {SITE.pipeline.corridors} corridors every quarter. The explorer
          ranks every provider on yours by total cost — fee plus FX margin — with non-disclosers
          flagged, never silently ranked.
        </p>
      </div>

      <ul
        className="chip-cloud"
        aria-label={`The ${corridors.length} busiest $200 remittance corridors in ${SITE.computed.quarter}, each with its true average total cost`}
      >
        {/* data-lag sits on the outer slot and the flight dataset on the inner
           .chip: ScrollSmoother drives the slot's transform while the
           convergence tween flies the chip — two writers on one element would
           fight over y every frame. */}
        {corridors.map((c, i) => (
          <Chip key={`${c.from_iso3}-${c.to_iso3}`} corridor={c} index={i} lag={i === 3 || i === 9} />
        ))}
      </ul>

      <div className="shell">
        {/* the featured family with its real numbers from site-data — each chip
            opens its ranking in the explorer (M2: India ↔ Gulf on the landing) */}
        <div className="teaser-featured" data-reveal>
          <p className="teaser-featured__label">
            India ↔ Gulf — the world&rsquo;s biggest corridor family, live now:
          </p>
          <ul className="teaser-featured__chips">
            {SITE.featured_corridors.map((c) => (
              <li key={`${c.from_iso3}-${c.to_iso3}`}>
                <Link
                  className="teaser-featured__chip tnum"
                  href={`/explorer?from=${c.from_iso3}&to=${c.to_iso3}`}
                  title={`Rank every provider on ${c.from_name} → ${c.to_name}`}
                >
                  {c.from_iso3}
                  <MoveRight size="0.9em" aria-hidden />
                  {c.to_iso3} <b>{c.avg_cost_pct === null ? "—" : `${c.avg_cost_pct.toFixed(2)}%`}</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Link href="/explorer" className="search-mock search-mock--live pressable">
          <Search size="1em" aria-hidden />
          <span className="search-mock__q">Where are you sending?</span>
          <span className="search-mock__tag">Open the explorer</span>
        </Link>

        <p className="prose explorer-log-note" data-reveal style={{ marginBottom: "var(--s-8)" }}>
          The explorer is live — every corridor the World Bank prices, ranked by true total cost.
          The rest of the roadmap ships the same way: each milestone lands as a working, deployed
          increment, and the build log is the issue tracker.
        </p>
        <ol className="log">
          {SITE.roadmap.map((milestone) => (
            <li key={milestone.id} data-reveal>
              <span className="milestone">{milestone.id}</span>
              <span className="desc">
                <a href={milestone.href}>{milestone.desc}</a>
              </span>
              <span className={`state${milestone.state === "in progress" ? " now" : ""}`}>
                <StateIcon state={milestone.state} />
                {milestone.state}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
