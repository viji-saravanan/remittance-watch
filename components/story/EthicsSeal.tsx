"use client";

import { useRef } from "react";
import { Eye, Fingerprint, Scale } from "lucide-react";
import {
  gsap,
  useGSAP,
  scrollConfigOnce,
  revealOnEnter,
  settleReveals,
  MQ_DESKTOP,
  MQ_MOTION_OK,
} from "../../lib/motion";

const PRINCIPLES = [
  {
    icon: Scale,
    name: "The ranking cannot be bought",
    detail:
      "No affiliate links, no referral codes, no paid placement — ever. If a provider offers us money to rank higher, we publish the email. Comparators monetized per sign-up have a structural reason to show you their partners first; we removed the structure.",
  },
  {
    icon: Fingerprint,
    name: "Every number is traceable",
    detail:
      "Costs come from the World Bank's Remittance Prices Worldwide database — quarterly, mystery-shopped, open-licensed. Our parsing and ranking code is public, and the methodology page shows the formula so any figure can be reproduced by hand.",
  },
  {
    icon: Eye,
    name: "Honest about what the data is",
    detail:
      "These are quarterly snapshots, not live quotes — we label them that way instead of pretending otherwise. Providers that don't disclose their exchange rate are flagged and kept out of default rankings, because a hidden cost isn't a zero cost.",
  },
];

/* The self-drawing seal. Strokes draw in order on desktop; everything else
   (dashed inner ring) stays static so DrawSVG has clean paths to work with. */
function Seal() {
  return (
    <svg className="seal" viewBox="0 0 320 320" role="img" aria-label="RemitWatch integrity seal">
      <circle className="seal-draw seal-draw--outer" cx="160" cy="160" r="132" />
      <circle className="seal-ring" cx="160" cy="160" r="112" />
      <path
        className="seal-draw seal-draw--shield"
        d="M160 76 L216 98 V156 C216 196 192 226 160 244 C128 226 104 196 104 156 V98 Z"
      />
      <path className="seal-draw seal-draw--check" d="M136 158 L154 176 L188 138" />
    </svg>
  );
}

/** Section 5 — the charter. Pinned manifesto with the seal drawing itself on
    desktop; single-column entrance everywhere else (ADR-0006 §4–5). */
export function EthicsSeal() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      scrollConfigOnce();
      const mm = gsap.matchMedia();

      mm.add({ desktop: MQ_DESKTOP, motion: MQ_MOTION_OK }, ({ conditions }) => {
        const section = scope.current!;
        if (!conditions?.motion) {
          settleReveals(section);
          return;
        }

        if (!conditions.desktop) {
          /* Mobile: no pin, no per-frame DrawSVG — the seal arrives with one
             overshoot while the manifesto fades up on entry. */
          const sealIn = gsap.from(".seal", {
            scale: 0.72,
            opacity: 0,
            ease: "back.out(1.5)",
            duration: 0.7,
            scrollTrigger: {
              trigger: ".seal-wrap",
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          });
          const copy = revealOnEnter(".charter-copy > *", ".charter-copy");
          return () => {
            sealIn.scrollTrigger?.kill();
            copy.scrollTrigger?.kill();
          };
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=750",
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });

        tl.from(".charter-copy > *", { opacity: 0, y: 30, stagger: 0.14, duration: 0.5 })
          .from(".seal-draw--outer", { drawSVG: 0, duration: 0.7, ease: "power1.inOut" }, 0.2)
          .from(".seal-draw--shield", { drawSVG: 0, duration: 0.9, ease: "power1.inOut" }, ">-0.15")
          .from(".seal-draw--check", { drawSVG: 0, duration: 0.45, ease: "power1.out" }, ">-0.1")
          .from(".seal-caption", { opacity: 0, duration: 0.3 }, ">");

        return () => {
          tl.scrollTrigger?.kill();
        };
      });
    },
    { scope },
  );

  return (
    <section id="story-ethics" ref={scope} className="section ethics">
      <div className="shell ethics-grid">
        <div className="charter-copy">
          <p className="eyebrow">
            <Scale size={15} aria-hidden /> The charter
          </p>
          <h2>Rules we don&rsquo;t bend.</h2>
          <ul className="charter-list">
            {PRINCIPLES.map((principle) => (
              <li key={principle.name}>
                <span className="charter-icon" aria-hidden>
                  <principle.icon size={17} />
                </span>
                <span className="charter-body">
                  <span className="name">{principle.name}</span>
                  <span className="detail">{principle.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="seal-wrap">
          <Seal />
          <p className="seal-caption">Open by construction · est. 2026</p>
        </div>
      </div>
    </section>
  );
}
