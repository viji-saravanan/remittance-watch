"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, scrollConfigOnce, MQ_MOTION_OK } from "../../lib/motion";
import { scrollToId } from "../../lib/scroller";

const SECTIONS = [
  { id: "story-hero", label: "Intro" },
  { id: "story-gap", label: "The gap" },
  { id: "story-anatomy", label: "Anatomy of a fee" },
  { id: "story-explorer", label: "Explorer teaser" },
  { id: "story-ethics", label: "The charter" },
  { id: "story-start", label: "Get started" },
];

/** Fixed section dots on the right edge. Buttons, not hash links — pinned
    spacers make raw jumps land wrong; scrolling routes through
    lib/scroller instead (ADR-0006 §6). */
export function StoryNav() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    scrollConfigOnce();
    const mm = gsap.matchMedia();
    mm.add(MQ_MOTION_OK, () => {
      const dots = root.current?.querySelectorAll<HTMLButtonElement>(".story-nav__dot");
      if (!dots) return;
      const triggers = SECTIONS.map((section, i) =>
        ScrollTrigger.create({
          trigger: `#${section.id}`,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => dots[i]?.classList.toggle("is-active", self.isActive),
        }),
      );
      return () => triggers.forEach((t) => t.kill());
    });
  }, { dependencies: [] });

  return (
    <nav ref={root} className="story-nav" aria-label="Story sections">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className="story-nav__dot"
          title={section.label}
          onClick={() => scrollToId(section.id)}
        >
          <span className="sr-only">{section.label}</span>
        </button>
      ))}
    </nav>
  );
}
