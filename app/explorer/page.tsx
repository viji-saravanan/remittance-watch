import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import "../landing.css";
import "./explorer.css";

import { ExplorerMount } from "../../components/explorer/ExplorerMount";
import { BUNDLE_URL } from "../../lib/explorer-data";
import { SITE, fmtInt, fmtPct } from "../../lib/site-data";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

export const metadata: Metadata = {
  title: "Corridor explorer",
  description:
    "Pick any remittance corridor and see every provider ranked by true total cost — printed fee plus the exchange-rate margin others hide. World Bank RPW data, ranked verbatim.",
};

/* Static shell + client island (ADR-0008): everything here prerenders from
   build-time site data; the ranking app fetches the versioned bundle in the
   browser, so its loading/error/empty states are real. No pins, no smoother —
   the explorer is a plain document (ADR-0006 motion contract is story-only). */
export default function ExplorerPage() {
  return (
    <>
      {/* the island's data fetch starts at HTML parse, not after hydration —
          crossorigin matches the client's default-mode fetch so the preload is
          consumed instead of doubled (React hoists this into <head>) */}
      <link rel="preload" href={BUNDLE_URL} as="fetch" crossOrigin="anonymous" fetchPriority="high" />

      <header className="site-header">
        <div className="shell header-row">
          <Link href="/" className="wordmark">
            RemitWatch
          </Link>
          <nav className="site-nav" aria-label="Site">
            <Link href="/">The story</Link>
            <a href={REPO}>Source</a>
            <a href={`${REPO}/issues`}>Build log</a>
          </nav>
        </div>
      </header>

      <main className="shell ex-shell">
        <p className="eyebrow">Corridor explorer</p>
        <h1>The true cost, corridor by corridor.</h1>
        <p className="prose ex-intro">
          Every provider the World Bank prices on your corridor, ranked by what the transfer
          really costs — the printed fee <em>plus</em> the exchange-rate margin. Nothing is
          clamped, dropped, or sponsored: costs rank exactly as published, and anything unusual
          is flagged in place.
        </p>

        <Suspense fallback={null}>
          <ExplorerMount />
        </Suspense>

        <noscript>
          <section className="ex-state">
            <p>
              The interactive ranking needs JavaScript — it fetches a static JSON bundle this
              site ships. Everything on it comes from the World Bank&rsquo;s{" "}
              {SITE.computed.quarter.replace("_", " ")} survey of{" "}
              {fmtInt(SITE.computed.transparent_quotes)} $200 transfers across{" "}
              {fmtInt(SITE.pipeline.corridors)} corridors. The featured India ↔ Gulf family,
              without JavaScript:
            </p>
            <ul>
              {SITE.featured_corridors.map((c) => (
                <li key={`${c.from_iso3}-${c.to_iso3}`}>
                  {c.from_name} → {c.to_name}: {fmtInt(c.quotes)} providers, average{" "}
                  {fmtPct(c.avg_cost_pct)} of a $200 transfer
                </li>
              ))}
            </ul>
          </section>
        </noscript>
      </main>

      <footer className="site-footer">
        <div className="shell">
          <p>
            Price data © The World Bank,{" "}
            <a href="https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide">
              Remittance Prices Worldwide
            </a>{" "}
            (CC BY 4.0). RemitWatch is not affiliated with the World Bank or any transfer provider.
          </p>
        </div>
      </footer>
    </>
  );
}
