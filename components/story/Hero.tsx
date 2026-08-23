"use client";

import { useRef } from "react";
import { ArrowDown, Banknote, BookOpen, CodeXml, Database, Globe, ShieldCheck } from "lucide-react";
import {
  gsap,
  SplitText,
  useGSAP,
  scrollConfigOnce,
  riseIn,
  settleReveals,
  MQ_MOTION_OK,
  MQ_REDUCE,
} from "../../lib/motion";
import { SITE, fmtInt, type Corridor } from "../../lib/site-data";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/* Equirectangular plot of the real corridors, clipped to the populated band
   (78°N…56°S) so the map fills its box instead of hugging empty poles. */
const MAP_W = 1440;
const MAP_H = 720;
const LAT_TOP = 78;
const LAT_SPAN = 134;

const projX = (lon: number) => ((lon + 180) / 360) * MAP_W;
const projY = (lat: number) => ((LAT_TOP - lat) / LAT_SPAN) * MAP_H;

/* Quadratic arc between two real points, bulged upward by a distance-scaled
   amount so long hauls read as journeys, not chords. */
function arcPath(from: number[], to: number[]): string {
  const x1 = projX(from[0]!);
  const y1 = projY(from[1]!);
  const x2 = projX(to[0]!);
  const y2 = projY(to[1]!);
  const lift = Math.min(150, Math.max(24, Math.hypot(x2 - x1, y2 - y1) * 0.22));
  return `M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - lift} ${x2},${y2}`;
}

/* Graticule — the real coordinate frame the corridors sit on. */
const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [60, 30, 0, -30];

function Graticule() {
  return (
    <g className="map-graticule" data-speed="0.92" aria-hidden="true">
      {MERIDIANS.map((lon) => (
        <line key={`m${lon}`} x1={projX(lon)} y1={0} x2={projX(lon)} y2={MAP_H} />
      ))}
      {PARALLELS.map((lat) => (
        <line key={`p${lat}`} x1={0} y1={projY(lat)} x2={MAP_W} y2={projY(lat)} />
      ))}
    </g>
  );
}

/* One parallax layer of corridor arcs + endpoint nodes. Stroke weight and
   node size carry the real quote counts — heavier means more providers priced. */
function CorridorLayer({ corridors, speed }: { corridors: Corridor[]; speed: number }) {
  const maxQuotes = Math.max(...SITE.top_corridors.map((c) => c.quotes));
  return (
    <g data-speed={speed}>
      {corridors.map((c) => {
        if (!c.from_ll || !c.to_ll) return null;
        const share = c.quotes / maxQuotes;
        return (
          <path
            key={`${c.from_iso3}${c.to_iso3}`}
            className="corridor-arc"
            style={{
              strokeWidth: 1 + share * 2.2,
              stroke: `color-mix(in srgb, var(--accent) ${Math.round(38 + share * 52)}%, var(--line-strong))`,
            }}
            d={arcPath(c.from_ll, c.to_ll)}
          />
        );
      })}
      {corridors.map((c) => {
        if (!c.from_ll || !c.to_ll) return null;
        const share = c.quotes / maxQuotes;
        const r = 2.5 + share * 3.5;
        return (
          <g key={`${c.from_iso3}${c.to_iso3}-nodes`}>
            <circle className="map-node" cx={projX(c.from_ll[0]!)} cy={projY(c.from_ll[1]!)} r={r} />
            <circle className="map-node" cx={projX(c.to_ll[0]!)} cy={projY(c.to_ll[1]!)} r={r} />
          </g>
        );
      })}
    </g>
  );
}

function CorridorMap() {
  const cs = SITE.top_corridors;
  const third = Math.ceil(cs.length / 3);
  return (
    <svg
      className="hero-map"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Map of the ${cs.length} busiest $200 remittance corridors in ${SITE.computed.quarter}, plotted from real country coordinates; heavier lines carry more priced providers`}
    >
      <Graticule />
      <CorridorLayer corridors={cs.slice(0, third)} speed={0.9} />
      <CorridorLayer corridors={cs.slice(third, third * 2)} speed={1} />
      <CorridorLayer corridors={cs.slice(third * 2)} speed={1.1} />
    </svg>
  );
}

/** Section 1 — the promise, the proof it's open, the way in. Every figure
    comes from the exported dataset (lib/site-data.ts), nothing is literal. */
export function Hero() {
  const scope = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      scrollConfigOnce();
      const mm = gsap.matchMedia();

      mm.add(MQ_REDUCE, () => {
        settleReveals(scope.current!);
      });

      mm.add(MQ_MOTION_OK, () => {
        riseIn("[data-reveal]", { delay: 0.2 });

        gsap.from(".corridor-arc", {
          drawSVG: 0,
          duration: 1.7,
          ease: "power2.inOut",
          stagger: 0.055,
          delay: 0.35,
        });
        gsap.from(".map-node", {
          opacity: 0,
          scale: 0,
          transformOrigin: "center",
          ease: "back.out(2)",
          stagger: 0.03,
          delay: 1.1,
        });

        const cue = gsap.to(".hero-scroll-cue svg", {
          y: 7,
          duration: 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        /* Char-mask reveal on the display line. Wait for fonts so glyph widths
           are final before splitting. The callback runs outside the context,
           so it is gated on a cancelled flag and the tween is killed by hand
           in cleanup (SplitText.revert alone never touches tweens). */
        let split: SplitText | null = null;
        let chars: gsap.core.Tween | null = null;
        let cancelled = false;
        document.fonts.ready.then(() => {
          if (cancelled || window.matchMedia(MQ_REDUCE).matches || !title.current) return;
          split = new SplitText(title.current, { type: "chars,words", mask: "chars" });
          chars = gsap.from(split.chars, {
            yPercent: 118,
            duration: 0.9,
            ease: "power4.out",
            stagger: { each: 0.02 },
          });
        });

        return () => {
          cancelled = true;
          cue.kill();
          chars?.kill();
          split?.revert();
          split = null;
        };
      });
    },
    { scope },
  );

  const cited = SITE.cited;

  return (
    <section id="story-hero" ref={scope} className="story-hero">
      <CorridorMap />
      <p className="map-caption" aria-hidden="true">
        {SITE.top_corridors.length} busiest $200 corridors · {SITE.computed.quarter} · heavier line = more
        providers priced
      </p>
      <div className="shell hero-inner">
        <p className="eyebrow" data-reveal>
          <BookOpen size="1em" aria-hidden /> {SITE.meta.source.workbook}
        </p>
        <h1 ref={title}>Send money home without the hidden tax.</h1>
        <p className="lede" data-reveal>
          RemitWatch ranks transfer providers by their <strong>true total cost</strong> — the fee
          you see plus the margin they bury inside the exchange rate — using the World Bank&rsquo;s
          open pricing data. No affiliate links. The ranking cannot be bought.
        </p>
        <div className="cta-row" data-reveal>
          <a href="#story-gap" className="button primary pressable">
            See the gap
            <ArrowDown size="1em" aria-hidden />
          </a>
          <a href={REPO} className="button ghost pressable" target="_blank" rel="noopener noreferrer">
            <CodeXml size="1em" aria-hidden />
            Read the source
          </a>
        </div>
        <ul className="hero-chips" data-reveal>
          <li title={cited.flows_label}>
            <Banknote size="1em" aria-hidden />
            ${cited.flows_usd_bn}B sent home in {cited.flows_year}
          </li>
          <li title="Quotes loaded by our ingestion pipeline">
            <Database size="1em" aria-hidden />
            {fmtInt(SITE.pipeline.quotes)} quotes parsed &amp; open
          </li>
          <li title={SITE.meta.source.license}>
            <ShieldCheck size="1em" aria-hidden />
            {SITE.meta.source.license} licensed data
          </li>
          <li className="hero-chip--wide" title={SITE.meta.source.url}>
            <Globe size="1em" aria-hidden />
            {SITE.pipeline.corridors} corridors · {SITE.pipeline.countries} countries
          </li>
        </ul>
      </div>
      <div className="hero-scroll-cue" aria-hidden="true">
        <ArrowDown size="1em" />
      </div>
    </section>
  );
}
