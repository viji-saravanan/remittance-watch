import Link from "next/link";
import "./landing.css";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/* Every number on this page is verified against a primary source —
   see docs/research/04-market-stats.md for the audit trail. */

const STATS = [
  {
    value: <>6.<em>36%</em></>,
    label: "average cost of sending $200 across borders — the UN target is 3% by 2030",
    cite: {
      name: "World Bank RPW, Q3 2025",
      href: "https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf",
    },
  },
  {
    value: <>4.59 <em>vs</em> 7.30%</>,
    label: "what digital channels charge versus cash-based ones — the people paying 7% can least afford it",
    cite: {
      name: "World Bank RPW, Q3 2025",
      href: "https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf",
    },
  },
  {
    value: <>$685 <em>billion</em></>,
    label: "sent to low- and middle-income countries in 2024. A 2% hidden margin on that is $13 billion nobody agreed to pay",
    cite: {
      name: "World Bank, Dec 2024",
      href: "https://blogs.worldbank.org/en/peoplemove/in-2024--remittance-flows-to-low--and-middle-income-countries-ar",
    },
  },
];

const PRINCIPLES = [
  {
    name: "The ranking cannot be bought",
    detail:
      "No affiliate links, no referral codes, no paid placement — ever. If a provider offers us money to rank higher, we publish the email. Comparators monetized per sign-up have a structural reason to show you their partners first; we removed the structure.",
  },
  {
    name: "Every number is traceable",
    detail:
      "Costs come from the World Bank's Remittance Prices Worldwide database — quarterly, mystery-shopped, open-licensed. Our parsing and ranking code is public, and the methodology page shows the formula so any figure can be reproduced by hand.",
  },
  {
    name: "Honest about what the data is",
    detail:
      "These are quarterly snapshots, not live quotes — we label them that way instead of pretending otherwise. Providers that don't disclose their exchange rate are flagged and kept out of default rankings, because a hidden cost isn't a zero cost.",
  },
];

const ROADMAP = [
  { id: "M0", desc: "Skeleton, design system, CI, deploy", state: "in progress", href: `${REPO}/issues/2` },
  { id: "M1", desc: "World Bank workbook → tested Postgres dataset", state: "queued", href: `${REPO}/issues/3` },
  { id: "M2", desc: "Corridor search & true-cost ranking UI", state: "queued", href: `${REPO}/issues/4` },
  { id: "M3", desc: "Public API for researchers & journalists", state: "queued", href: `${REPO}/issues/5` },
  { id: "M4", desc: "Live FX overlay, price-drop alerts, Hindi", state: "queued", href: `${REPO}/issues/6` },
  { id: "M5", desc: "Methodology, accessibility, launch", state: "queued", href: `${REPO}/issues/7` },
];

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="shell" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%", gap: "var(--s-4)" }}>
          <Link href="/" className="wordmark">RemitWatch</Link>
          <nav className="site-nav" aria-label="Site">
            <a href="#how-ranking-works">How ranking works</a>
            <a href={REPO}>Source</a>
            <a href={`${REPO}/issues`}>Build log</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero shell">
          <h1>Send money home without the hidden tax.</h1>
          <p className="lede">
            RemitWatch ranks transfer providers by their <strong>true total cost</strong> —
            the fee you see plus the margin they bury inside the exchange rate — using the
            World Bank&rsquo;s open pricing data. No affiliate links. The ranking cannot be bought.
          </p>
          <div className="cta-row">
            <a href="#how-ranking-works" className="button primary pressable">
              See how the ranking works
            </a>
            <a href={REPO} className="button ghost pressable">
              Read the source
            </a>
          </div>
        </section>

        <section className="shell" aria-label="The problem in numbers">
          <div className="stat-strip">
            {STATS.map((s, i) => (
              <div className="stat" key={i}>
                <div className="value tnum">{s.value}</div>
                <div className="label">{s.label}</div>
                <cite>
                  <a href={s.cite.href} target="_blank" rel="noopener noreferrer">
                    {s.cite.name}
                  </a>
                </cite>
              </div>
            ))}
          </div>
        </section>

        <section className="section shell" id="how-ranking-works">
          <h2>The sticker fee is not the cost.</h2>
          <p className="prose">
            Providers quote a fee at the counter and quietly take a second cut inside the
            exchange rate — the gap between their rate and the mid-market rate. Comparison
            sites usually show you the first number only. We decompose both, because the
            hidden one is often the bigger half.
          </p>
          <figure className="decomp">
            <div
              className="bar"
              role="img"
              aria-label="Of a 33,000 kwanza transfer, 90.06 percent arrives, 6.84 percent is the visible fee, and 3.10 percent is the hidden exchange-rate margin"
            >
              <div className="arrives" style={{ width: "90.06%" }} />
              <div className="fee" style={{ width: "6.84%" }} />
              <div className="margin" style={{ width: "3.10%" }} />
            </div>
            <div className="legend tnum">
              <span>
                <span className="swatch" style={{ background: "var(--accent-soft)", border: "1px solid var(--line-strong)" }} />
                arrives — 90.06%
              </span>
              <span>
                <span className="swatch" style={{ background: "var(--fee)" }} />
                visible fee — 6.84%
              </span>
              <span>
                <span className="swatch" style={{ background: "var(--margin)" }} />
                hidden FX margin — 3.10%
              </span>
            </div>
            <figcaption className="tnum">
              One real row from the source workbook: a 33,000&nbsp;AOA cash transfer, Angola → Namibia,
              Q3&nbsp;2025. The fee is printed on the receipt. The margin appears nowhere a customer
              can see it. <a href="https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide">World Bank RPW, Issue 54</a>.
            </figcaption>
          </figure>
        </section>

        <section className="section shell">
          <h2>Rules we don&rsquo;t bend.</h2>
          <ul className="principles">
            {PRINCIPLES.map((p) => (
              <li key={p.name}>
                <span className="name">{p.name}</span>
                <span className="detail">{p.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="section shell">
          <h2>Nothing here is live yet. We&rsquo;re building in the open.</h2>
          <p className="prose" style={{ marginBottom: "var(--s-8)" }}>
            Each milestone ships as a working, deployed increment — the build log is the
            issue tracker.
          </p>
          <ol className="log">
            {ROADMAP.map((m) => (
              <li key={m.id}>
                <span className="milestone">{m.id}</span>
                <span className="desc">
                  <a href={m.href}>{m.desc}</a>
                </span>
                <span className={`state${m.state === "in progress" ? " now" : ""}`}>{m.state}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell">
          <p>
            Price data © The World Bank, <a href="https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide">Remittance Prices Worldwide</a>{" "}
            (CC BY 4.0). RemitWatch is not affiliated with the World Bank or any transfer provider.
          </p>
          <p>
            MIT-licensed open source, maintained by{" "}
            <a href="https://github.com/viji-saravanan">@viji-saravanan</a> and{" "}
            <a href="https://github.com/callmearya">@callmearya</a>. No cookies,
            no trackers, no ads — and every number on this page links to its source.
          </p>
        </div>
      </footer>
    </>
  );
}
