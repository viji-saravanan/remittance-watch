"use client";

import { useRef } from "react";
import { ArrowDown, Banknote, BookOpen, CodeXml, Database, Globe } from "lucide-react";
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

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/* Corridor route-lines behind the headline — abstract, decorative.
   data-speed layers parallax at different rates while the page scrolls
   (ScrollSmoother effects); the near layer draws itself on load. */
function RouteLines() {
  return (
    <svg
      className="hero-routes"
      viewBox="0 0 1440 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g className="route route--far" data-speed="0.85">
        <path d="M-60,560 C300,420 520,640 780,520 S1240,300 1520,380" />
        <path d="M-60,470 C260,360 480,540 820,430 S1300,240 1520,300" />
      </g>
      <g className="route route--mid" data-speed="1">
        <path d="M-60,700 C260,580 480,740 820,630 S1300,440 1520,520" />
      </g>
      <g className="route route--near" data-speed="1.18">
        <path d="M-40,300 C340,180 620,360 980,250 S1360,140 1540,220" />
      </g>
      <g data-speed="1.18">
        <circle className="route-node" cx="340" cy="238" r="5" />
        <circle className="route-node" cx="980" cy="250" r="5" />
        <circle className="route-node" cx="780" cy="520" r="5" />
        <circle className="route-node" cx="820" cy="630" r="4" />
      </g>
    </svg>
  );
}

/** Section 1 — the promise, the proof it's open, the way in. */
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

        gsap.from(".route--mid path", {
          drawSVG: 0,
          duration: 2.2,
          ease: "power2.inOut",
          delay: 0.35,
        });
        gsap.from(".route--near path", {
          drawSVG: 0,
          duration: 1.8,
          ease: "power2.inOut",
          delay: 0.55,
        });
        gsap.from(".route-node", {
          opacity: 0,
          scale: 0,
          transformOrigin: "center",
          ease: "back.out(2)",
          stagger: 0.08,
          delay: 1.2,
        });

        const cue = gsap.to(".hero-scroll-cue svg", {
          y: 7,
          duration: 0.7,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        /* Char-mask reveal on the display line. Wait for fonts so glyph widths
           are final before splitting; skip entirely if motion got turned off
           in the interim. */
        let split: SplitText | null = null;
        document.fonts.ready.then(() => {
          if (!window.matchMedia(MQ_REDUCE).matches && title.current) {
            split = new SplitText(title.current, { type: "chars,words", mask: "chars" });
            gsap.from(split.chars, {
              yPercent: 118,
              duration: 0.9,
              ease: "power4.out",
              stagger: { each: 0.02 },
            });
          }
        });

        return () => {
          cue.kill();
          split?.revert();
          split = null;
        };
      });
    },
    { scope },
  );

  return (
    <section id="story-hero" ref={scope} className="story-hero">
      <RouteLines />
      <div className="shell hero-inner">
        <p className="eyebrow" data-reveal>
          <BookOpen size={15} aria-hidden /> World Bank Remittance Prices Worldwide · Q3 2025
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
            <ArrowDown size={16} aria-hidden />
          </a>
          <a href={REPO} className="button ghost pressable" target="_blank" rel="noopener noreferrer">
            <CodeXml size={16} aria-hidden />
            Read the source
          </a>
        </div>
        <ul className="hero-chips" data-reveal>
          <li>
            <Banknote size={14} aria-hidden />
            $685B sent home in 2024
          </li>
          <li>
            <Database size={14} aria-hidden />
            408,938 quotes parsed &amp; open
          </li>
          <li>
            <Globe size={14} aria-hidden />
            CC BY 4.0 licensed data
          </li>
        </ul>
      </div>
      <div className="hero-scroll-cue" aria-hidden="true">
        <ArrowDown size={18} />
      </div>
    </section>
  );
}
