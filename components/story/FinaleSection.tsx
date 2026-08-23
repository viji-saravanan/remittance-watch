"use client";

import { useRef } from "react";
import { ClipboardList, CodeXml, Database, Eye, Route, ShieldCheck } from "lucide-react";
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
import { SITE, fmtInt } from "../../lib/site-data";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/** Section 6 — the ask. Hue-drifting backdrop on desktop scrub, word-cascade
    headline, magnetic primary button for fine pointers, and the dataset's own
    receipts in the meta row. */
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

        /* Word cascade once fonts are final. The callback runs outside the
           context, so it is gated on a cancelled flag and every artifact it
           creates (tween + its ScrollTrigger) is killed by hand in cleanup. */
        let split: SplitText | null = null;
        let cascade: gsap.core.Tween | undefined;
        let cancelled = false;
        document.fonts.ready.then(() => {
          if (cancelled || window.matchMedia(MQ_REDUCE).matches || !title.current) return;
          split = new SplitText(title.current, { type: "words", mask: "words" });
          cascade = gsap.from(split.words, {
            yPercent: 120,
            duration: 0.85,
            ease: "power4.out",
            stagger: 0.06,
            scrollTrigger: { trigger: title.current, start: "top 78%", toggleActions: "play none none reverse" },
          });
        });

        return () => {
          cancelled = true;
          hue?.scrollTrigger?.kill();
          cascade?.scrollTrigger?.kill();
          cascade?.kill();
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

  const pipeline = SITE.pipeline;

  return (
    <section id="story-start" ref={scope} className="finale">
      <div className="finale-blob" aria-hidden="true" />
      <span className="finale-ghost" aria-hidden="true">
        RemitWatch
      </span>
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
            <CodeXml size="1em" aria-hidden />
            Read the source
          </a>
          <a href={`${REPO}/issues`} className="button ghost pressable" target="_blank" rel="noopener noreferrer">
            <ClipboardList size="1em" aria-hidden />
            Follow the build log
          </a>
        </div>
        <ul className="finale-meta" data-reveal>
          <li title="Quotes loaded by our ingestion pipeline">
            <Database size="1em" aria-hidden /> {fmtInt(pipeline.quotes)} quotes · {pipeline.first_quarter}–
            {pipeline.last_quarter}
          </li>
          <li title="Coverage of the current World Bank release">
            <Route size="1em" aria-hidden /> {pipeline.corridors} corridors · {pipeline.countries} countries
          </li>
          <li title={SITE.meta.source.license}>
            <ShieldCheck size="1em" aria-hidden /> {SITE.meta.source.license} data · MIT code
          </li>
          <li>
            <Eye size="1em" aria-hidden /> No cookies, no trackers, no ads
          </li>
        </ul>
      </div>
    </section>
  );
}
