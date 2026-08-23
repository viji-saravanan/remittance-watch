"use client";

import { useRef } from "react";
import { ClipboardList, CodeXml, Database, Eye, ShieldCheck } from "lucide-react";
import {
  gsap,
  SplitText,
  useGSAP,
  scrollConfigOnce,
  revealOnEnter,
  settleReveals,
  MQ_DESKTOP,
  MQ_FINE_POINTER,
  MQ_MOTION_OK,
  MQ_REDUCE,
} from "../../lib/motion";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/** Section 6 — the ask. Hue-drifting backdrop on desktop scrub, word-cascade
    headline, and a magnetic primary button for fine pointers only. */
export function FinaleSection() {
  const scope = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const magnet = useRef<HTMLAnchorElement>(null);

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

        revealOnEnter("[data-reveal]", section, "top 72%");

        let hue: gsap.core.Tween | undefined;
        if (conditions.desktop) {
          hue = gsap.fromTo(
            ".finale-blob",
            { filter: "hue-rotate(0deg)" },
            {
              filter: "hue-rotate(55deg)",
              ease: "none",
              scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.8 },
            },
          );
        }

        /* Word cascade once fonts are final; skipped if motion got disabled
           between setup and font settle. */
        let split: SplitText | null = null;
        document.fonts.ready.then(() => {
          if (window.matchMedia(MQ_REDUCE).matches || !title.current) return;
          split = new SplitText(title.current, { type: "words", mask: "words" });
          gsap.from(split.words, {
            yPercent: 120,
            duration: 0.85,
            ease: "power4.out",
            stagger: 0.06,
            scrollTrigger: { trigger: title.current, start: "top 78%", toggleActions: "play none none reverse" },
          });
        });

        return () => {
          hue?.scrollTrigger?.kill();
          split?.revert();
          split = null;
        };
      });

      /* Magnetic pull — fine pointers only, never a touchscreen (ADR-0006 §5). */
      mm.add(`${MQ_FINE_POINTER} and ${MQ_MOTION_OK}`, () => {
        const button = magnet.current;
        const section = scope.current!;
        if (!button) return;
        const xTo = gsap.quickTo(button, "x", { duration: 0.4, ease: "power3" });
        const yTo = gsap.quickTo(button, "y", { duration: 0.4, ease: "power3" });
        const onMove = (event: MouseEvent) => {
          const rect = button.getBoundingClientRect();
          xTo(gsap.utils.clamp(-12, 12, (event.clientX - (rect.left + rect.width / 2)) * 0.18));
          yTo(gsap.utils.clamp(-10, 10, (event.clientY - (rect.top + rect.height / 2)) * 0.18));
        };
        const onLeave = () => {
          xTo(0);
          yTo(0);
        };
        section.addEventListener("mousemove", onMove);
        section.addEventListener("mouseleave", onLeave);
        return () => {
          section.removeEventListener("mousemove", onMove);
          section.removeEventListener("mouseleave", onLeave);
          gsap.set(button, { x: 0, y: 0 });
        };
      });
    },
    { scope },
  );

  return (
    <section id="story-start" ref={scope} className="finale">
      <div className="finale-blob" aria-hidden="true" />
      <div className="shell finale-inner">
        <h2 ref={title}>Know the true cost before you send.</h2>
        <p className="lede" data-reveal>
          RemitWatch is built in the open — every parse, rank and rule is inspectable. Take the
          numbers, check our work, or run your own.
        </p>
        <div className="cta-row" data-reveal>
          <a
            ref={magnet}
            href={REPO}
            className="button primary pressable"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CodeXml size={16} aria-hidden />
            Read the source
          </a>
          <a href={`${REPO}/issues`} className="button ghost pressable" target="_blank" rel="noopener noreferrer">
            <ClipboardList size={16} aria-hidden />
            Follow the build log
          </a>
        </div>
        <ul className="finale-meta" data-reveal>
          <li>
            <ShieldCheck size={14} aria-hidden /> MIT code
          </li>
          <li>
            <Database size={14} aria-hidden /> CC BY 4.0 data
          </li>
          <li>
            <Eye size={14} aria-hidden /> No cookies, no trackers, no ads
          </li>
        </ul>
      </div>
    </section>
  );
}
