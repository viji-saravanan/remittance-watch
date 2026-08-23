"use client";

import { useRef } from "react";
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

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/* Representative corridors from RPW coverage. Offsets seed the convergence —
   chips fly in from these positions as the section scrolls through view. */
const CORRIDORS = [
  { from: "US", to: "IN", x: -340, y: -120, r: -6 },
  { from: "AE", to: "IN", x: 320, y: -140, r: 5 },
  { from: "US", to: "MX", x: -260, y: 130, r: 4 },
  { from: "AE", to: "PH", x: 280, y: 120, r: -5, lag: "0.12" },
  { from: "GB", to: "NG", x: -180, y: -160, r: 7 },
  { from: "SA", to: "PH", x: 200, y: -100, r: -4 },
  { from: "DE", to: "TR", x: -300, y: 60, r: 3 },
  { from: "US", to: "PH", x: 240, y: 40, r: 6 },
  { from: "CA", to: "IN", x: -140, y: 150, r: -7 },
  { from: "AU", to: "VN", x: 160, y: 170, r: 4, lag: "0.2" },
  { from: "FR", to: "SN", x: -80, y: -110, r: -3 },
  { from: "IT", to: "BGD", x: 100, y: -60, r: 5 },
  { from: "KR", to: "NP", x: -220, y: -40, r: 6 },
  { from: "NL", to: "MAR", x: 60, y: 90, r: -6 },
];

const ROADMAP = [
  { id: "M0", desc: "Skeleton, design system, CI, deploy", state: "shipped", href: `${REPO}/issues/2` },
  { id: "M1", desc: "World Bank workbook → tested Postgres dataset", state: "shipped", href: `${REPO}/issues/3` },
  { id: "M2", desc: "Corridor search & true-cost ranking UI", state: "in progress", href: `${REPO}/issues/4` },
  { id: "M3", desc: "Public API for researchers & journalists", state: "queued", href: `${REPO}/issues/5` },
  { id: "M4", desc: "Live FX overlay, price-drop alerts, Hindi", state: "queued", href: `${REPO}/issues/6` },
  { id: "M5", desc: "Methodology, accessibility, launch", state: "queued", href: `${REPO}/issues/7` },
];

function StateIcon({ state }: { state: string }) {
  if (state === "shipped") return <BadgeCheck size={13} aria-hidden />;
  if (state === "in progress") return <Hourglass size={13} aria-hidden />;
  return <Circle size={13} aria-hidden />;
}

/** Section 4 — what's coming: corridor chips converge into the search field,
    and the open build log. Desktop scrubs the convergence; mobile plays it on
    entry; two chips trail behind via ScrollSmoother's data-lag. */
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
          x: (_i, el: Element) => Number((el as HTMLElement).dataset.x),
          y: (_i, el: Element) => Number((el as HTMLElement).dataset.y),
          rotation: (_i, el: Element) => Number((el as HTMLElement).dataset.r),
          opacity: 0,
          duration: conditions.desktop ? 1 : 0.8,
          ease: "power2.out",
          stagger: { each: 0.04, from: "edges" },
          scrollTrigger: conditions.desktop
            ? { trigger: ".chip-cloud", start: "top 88%", end: "top 38%", scrub: 0.5 }
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

  return (
    <section id="story-explorer" ref={scope} className="section explorer">
      <div className="shell explorer-head">
        <p className="eyebrow" data-reveal>
          <Route size={15} aria-hidden /> Corridor explorer · in build
        </p>
        <h2 data-reveal>Search any corridor. See the true cost first.</h2>
        <p className="prose" data-reveal>
          The World Bank prices 200+ country corridors every quarter. The explorer will rank every
          provider in yours by total cost — fee plus FX margin — with non-disclosers flagged, never
          silently ranked.
        </p>
      </div>

      <ul className="chip-cloud" aria-label="Example remittance corridors">
        {/* data-lag sits on the outer slot and the flight dataset on the inner
           .chip: ScrollSmoother drives the slot's transform while the
           convergence tween flies the chip — two writers on one element would
           fight over y every frame. */}
        {CORRIDORS.map(({ from, to, x, y, r, lag }) => (
          <li key={`${from}-${to}`} className="chip-slot" data-lag={lag}>
            <span className="chip" data-x={x} data-y={y} data-r={r}>
              {from}
              <MoveRight size={13} aria-hidden />
              {to}
            </span>
          </li>
        ))}
      </ul>

      <div className="shell">
        <div className="search-mock pressable" role="presentation">
          <Search size={18} aria-hidden />
          <span className="search-mock__q">Where are you sending?</span>
          <span className="search-mock__soon">M2</span>
        </div>

        <p className="prose explorer-log-note" data-reveal style={{ marginBottom: "var(--s-8)" }}>
          Nothing here is live yet. We&rsquo;re building in the open — each milestone ships as a
          working, deployed increment, and the build log is the issue tracker.
        </p>
        <ol className="log">
          {ROADMAP.map((milestone) => (
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
