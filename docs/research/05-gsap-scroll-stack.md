# Research 05 — Motion & icon stack for the scroll-story landing

*Verified 2026-08-23 against live registries and real bundles. Measurement method:
npm registry for versions/licenses/unpacked sizes; unpkg dist files byte-counted raw
and gzip; real bundle cost measured with esbuild `--bundle --minify --format=esm`
(react externalized) then gzip — closer to what Next.js ships than vendor numbers.*

## 1. GSAP licensing post-Webflow

**Everything is free — including every former Club plugin — but GSAP is NOT MIT.**

| Fact | Finding |
|---|---|
| Latest | `gsap@3.15.0`, `@gsap/react@2.1.2` |
| npm license field | `Standard 'no charge' license: https://gsap.com/standard-license` (relicensed at 3.13.0, May 2025 — 3.12.7 still carried Club language) |
| Pricing page | "GSAP is now 100% free for all users, thanks to Webflow's support" — ScrollTrigger, ScrollSmoother, SplitText, Draggable, Inertia, Flip, MorphSVG, DrawSVG, ScrambleText, Physics2D/Props, CustomBounce/Wiggle, MotionPath, Observer, GSDevTools all included |
| GitHub repo | **No LICENSE file at all** (`spdx_id: null`); operative terms only at gsap.com/standard-license |

Standard License terms (effective 2025-04-30, modified 2025-05-30):

- Broad worldwide grant for "any website, web application, or digital interface"
- Commercial use explicitly permitted; attribution **not** required
- Prohibited: building a competing no-code visual animation tool; reverse engineering for that purpose; stripping branding. AI-generated GSAP code expressly fine
- Incorporated into Webflow's ToS; continued use after amendments = acceptance

**For RemitWatch:** unambiguously fine. Our code stays MIT; GSAP enters as a normal npm
dependency under its own license (like React beside ISC deps). Hygiene rules:
(a) never copy-vendor GSAP source into the repo, (b) record `gsap` in
THIRD-PARTY-NOTICES.md pointing at the standard-license URL.

## 2. Bundle weight (measured, gsap@3.15.0)

Official dist (raw / gzip):

| File | Raw | Gzip |
|---|---|---|
| `gsap.min.js` core | 72,927 | **28,344** |
| `scrolltrigger.min.js` | 44,575 | **17,967** |
| `scrollsmoother.min.js` | 13,373 | **5,509** |
| `splittext.min.js` | 7,732 | **3,643** |
| `scrolltoplugin.min.js` | 4,059 | **1,940** |

Real app bundles (esbuild min+gzip, react external):

| Entry | Gzip |
|---|---|
| core only | 27.7 KB |
| core + ScrollTrigger | 45.2 KB |
| core + ST + ScrollSmoother | 50.0 KB |
| core + SplitText | 30.7 KB |
| core + useGSAP (@gsap/react) | 28.2 KB (hook ≈ 450 B) |
| kitchen sink (core+ST+Smoother+SplitText+Draggable+Inertia+Flip+useGSAP) | 76 KB |

npm unpacked: gsap 5.97 MB (irrelevant to shipped bytes), @gsap/react 20 KB.

**Tree-shaking reality:** plugins are separate entry modules — per-plugin cost is
genuine. Core does NOT tree-shake (monolithic ESM): budget model = 28 KB base +
Σ(chosen plugins). Full story stack (core+ST+Smoother+SplitText+ScrollTo+useGSAP)
≈ **57 KB gzip** — less than one hero JPEG.

**Keeping initial JS small (Next.js 15 App Router + static export):**

1. `'use client'` leaf boundaries; keep `page.tsx` a server component rendering the
   static shell; GSAP lives in per-section client components (auto-code-split).
2. `ssr: false` is unsupported in Server Components — wrap in a client bridge if
   needed. But do **not** `ssr: false` the story content: useGSAP is SSR-safe, so
   sections prerender + hydrate (SEO/LCP intact); reserve `ssr: false` for the heavy
   interactive explorer widget only.
3. On-demand: `const { ScrollSmoother } = await import('gsap/ScrollSmoother')`.
4. Register once at client-module scope: `gsap.registerPlugin(useGSAP, ScrollTrigger, …)`.
5. `document.fonts.ready.then(() => ScrollTrigger.refresh())` after settle.

## 3. Next.js 15 integration (official @gsap/react pattern)

```tsx
'use client'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export function GapSection() {
  const scope = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add({
      isDesktop: '(min-width: 768px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    }, () => {
      // scrubbed pinned timeline here; reduceMotion branch gsap.set()s final state
    })
  }, { scope, dependencies: [] })
  return <section ref={scope}>…</section>
}
```

Verified gotchas:

- `useGSAP` auto-wraps in `gsap.context()` and **reverts everything on unmount** —
  the cleanup story; StrictMode double-invoke handled by the revert.
- SSR-safe (isomorphic layout effect) but file must carry `'use client'`.
- Animations created after the callback (handlers, timeouts) need `contextSafe`.
- `gsap.matchMedia()` auto-reverts when conditions stop matching — gate every scroll
  animation behind `(prefers-reduced-motion: no-preference)` and `gsap.set()` final
  values in the reduce branch so content is never invisible.
- Static export: hash anchors break under basePath → ScrollToPlugin for nav;
  pinned sections compute positions post-hydration → `fonts.ready → refresh()`.

## 4. Mobile (iOS Safari first-class)

1. **`ScrollTrigger.config({ ignoreMobileResize: true })`** globally — fixes
   address-bar resize jumps (25%-of-vh touch resizes skip refresh). Slight trigger
   drift is the acceptable tradeoff.
2. **`normalizeScroll(true)`: do NOT blanket-enable.** Experimental; fixes pin
   flicker but is scroll-jacking with real tradeoffs (multi-touch handoff, scrollbar
   loss, newest iPhones still force address-bar change). Ship without; A/B on device
   if pin flicker appears.
3. Pinning perf: short pinned spans (`end: "+=600"` not `+=3000`), never animate the
   pinned element itself (children + transforms only), cap concurrent pins on mobile
   via matchMedia.
4. ScrollSmoother: smoothing **off on touch by default** (keep it — `smoothTouch`
   stays off); `data-speed`/`data-lag` still work on touch. **`position: fixed`
   chrome (nav, progress hairline) must live OUTSIDE `#smooth-wrapper`/`#smooth-content`** —
   the wrapper's transform creates a containing block.
5. Viewport: `100svh`/`100dvh` not `100vh`; `viewport-fit=cover` +
   `env(safe-area-inset-*)` padding on fixed chrome.
6. Perf: transforms/opacity only; `stagger`; `quickTo` for pointer-followers gated
   behind `(hover: hover) and (pointer: fine)`; `will-change` only while animating;
   scrub timelines run per-frame on CPU — test low-end Android.

## 5. Icon library — verdict: lucide-react

Measured (esbuild min+gzip, react external; lucide-react 1.33.0, heroicons 2.2.0,
phosphor 2.1.10, iconify 6.0.2):

| Library | 2 icons gz | Per icon | License | Notes |
|---|---|---|---|---|
| **lucide-react** | 1,254 B | ~0.6 KB | ISC | ~1,600 icons, 1 coherent stroke style, verified tree-shaking |
| @heroicons/react | 521 B | ~0.26 KB | MIT | lightest but only ~300 icons / 3 styles |
| @phosphor-icons/react | 1,440 B | ~0.7 KB | MIT | 6 weights, IconContext runtime overhead |
| @iconify/react (runtime) | 7.2 KB component | +network | MIT | fetches from api.iconify.design at runtime — wrong for zero-budget static Pages |

**lucide-react.** ~0.6 KB gz/icon (40-icon system ≈ 24 KB gz ≈ one GSAP plugin); ISC
beside MIT; one rounded-stroke language fits "icons everywhere". Catastrophic case,
measured: `import * as L from "lucide-react"` = **180.7 KB gz** — enforce named
imports via ESLint `no-restricted-imports`.

## 6. gsap.com/scroll deconstruction → RemitWatch blueprint

That page is a self-demo: scrubbed worm graphic with Start/End markers; pinned
windmill `rotateZ: 900` during scrub with an explicit `gsap.matchMedia()` callout;
ScrollSmoother spirals with `data-speed="0.8/2.0/1.2"`; Observer section; plugin
cards. Smooth-scroll = their own ScrollSmoother preserving native scroll; parallax
purely `data-speed`/`data-lag`.

### RemitWatch scroll story (6 sections)

Global chrome: fixed progress hairline via one standalone trigger
(`ScrollTrigger.create({ start: 0, end: "max", onUpdate: s => gsap.set(bar, { scaleX: s.progress }) })`);
nav dots via ScrollToPlugin (+1.9 KB gz); chrome OUTSIDE smoother wrappers.

| # | Section | Technique | Mobile fallback |
|---|---|---|---|
| 1 | Hero — "What a transfer really costs" | SplitText char-mask reveal; layered corridor route-lines `data-speed` 0.85/1/1.15; yoyo scroll cue | Same reveals; drop cursor-glow (pointer:fine only); hide half the line layers |
| 2 | The gap — **6.36% vs 3%** | Pinned scrub: odometer 0→6.36 while cost bar grows; UN SDG 10.c "<3% by 2030" bar slides in; excess floods warning color | ≤767px: no pin, `toggleActions: play none none reverse`, vertical bars, count on enter; reduced-motion: `gsap.set()` finals |
| 3 | Anatomy of a fee (fee vs hidden FX margin) | Pinned; $200 stacked bar splits — fee slice rises, hidden margin sinks below dashed true-price line; fake-horizontal panel via `xPercent` `ease:"none"` + `containerAnimation` nested triggers | CSS scroll-snap swipeable row (zero JS pinning) + batch fade-ups |
| 4 | Corridor explorer teaser | Chips converge from edges into grid (scrubbed stagger), two trail with `data-lag`, resolves into search field + CTA | Halve chips; keep transform convergence; drop data-lag; explorer lazy `dynamic({ ssr: false })` |
| 5 | Ethics charter | Pinned manifesto + DrawSVG seal drawing itself; batch-staggered principles | Single column; seal = scale/back.out entrance |
| 6 | CTA finale | Pinned hue-shift scrub; word cascade; magnetic button (`quickTo`, pointer:fine only) | No/short pin; no magnetics; ≥44px targets; safe-area padding |

Cross-cutting: create ScrollTriggers in DOM order (or `refreshPriority`); markers
dev-only; every element CSS-visible by default, `visibility:hidden` only when JS
loads (progressive enhancement — exported HTML must read perfectly with JS off).
Total added weight ≈ **57 KB gz GSAP + ~25 KB gz icons**.

Sources: gsap.com/pricing · gsap.com/standard-license · gsap.com/resources/React ·
gsap.com/docs/v3/@gsap/react · ScrollTrigger static.config()/static.normalizeScroll() ·
ScrollSmoother docs · gsap.matchMedia() docs · nextjs.org lazy-loading guide ·
gsap.com/scroll · remittanceprices.worldbank.org (RPW Issue 54: 6.36% global average,
digital 4.59% vs non-digital 7.30%, SDG 10.c <3%) · lucide.dev
