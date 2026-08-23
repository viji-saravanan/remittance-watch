# ADR-0006: GSAP scroll-story motion + lucide icon stack

*Accepted 2026-08-23 · Supersedes nothing · Grounding: [research 05](../research/05-gsap-scroll-stack.md)*

## Context

M2 rebuilds the landing experience as a scroll-driven story (user direction:
"creative and absolutely insane", gsap.com/scroll as reference, **icons everywhere**,
**mobile compatibility equally important**). The site is a statically exported Next.js
15 app on GitHub Pages (ADR-0005) — no server runtime, basePath `/remittance-watch`.
Constraints: zero budget, MIT repo charter, and the page must read perfectly with
JavaScript disabled.

## Options considered

| Option | Verdict |
|---|---|
| Hand-rolled IntersectionObserver animations | Free but weeks of bespoke code for pin/scrub/parallax quality; the exact wheel GSAP perfected |
| Framer Motion | Great for UI transitions; scroll-scrub + pinning story much weaker than ScrollTrigger |
| **GSAP (ScrollTrigger, ScrollSmoother, SplitText, DrawSVG, ScrollTo)** | **Chosen** — industry-standard scroll engine, all plugins now free |
| Iconify runtime | Fetches icon data from a third-party API at runtime — violates static/no-third-party-calls posture |

## Decision

1. **GSAP under its Standard "No Charge" license** (post-Webflow 2025 relicensing;
   all former Club plugins free). NOT MIT — recorded in THIRD-PARTY-NOTICES.md.
   Our own code remains MIT; GSAP enters strictly as an npm dependency, never
   copy-vendored. Commercial-use grant explicitly covers this site.
2. **Icons: `lucide-react`** (~0.6 KB gz/icon measured, ISC license, one coherent
   stroke language). Namespace imports banned via ESLint — named imports only
   (`import *` measures at 180 KB gz).
3. **Bundle budget**: full stack ≈ 57 KB gz GSAP + ~25 KB gz icons. Core does not
   tree-shake (28 KB floor); plugins are individually importable and paid for
   exactly as imported. Story sections are `'use client'` leaf components; content
   prerenders (useGSAP is SSR-safe); `ssr: false` reserved for the heavy explorer
   widget.
4. **Progressive enhancement contract**: exported HTML is complete and readable
   with JS off. Elements are CSS-visible by default; animation hides them only when
   JS is live. Every scroll effect gated behind `(prefers-reduced-motion: no-preference)`
   with `gsap.set()` final states in the reduce branch (`gsap.matchMedia()`).
5. **Mobile-first rules** (not fallbacks): `ignoreMobileResize: true`; NO blanket
   `normalizeScroll`; ScrollSmoother smoothing stays off on touch; fixed chrome
   lives outside smoother wrappers; `100svh` not `100vh`; safe-area insets on fixed
   UI; pins short, children-only transforms; pointer-fancy gated behind
   `(hover: hover) and (pointer: fine)`; ≥44 px tap targets.
6. **basePath-safe navigation**: anchors scroll via ScrollToPlugin, never raw hash
   links; `document.fonts.ready → ScrollTrigger.refresh()` after settle.

## Consequences

- +~82 KB gz total JS budget spent, replacing megabytes of bespoke scroll code
- License hygiene: THIRD-PARTY-NOTICES entry; never vendor GSAP source into the repo
- ESLint rule added for lucide imports
- Webflow ToS amendments apply to continued use — revisit if terms change materially
- Pin-heavy sections need on-device testing (low-end Android included) since scrub
  timelines run per-frame on CPU
