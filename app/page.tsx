import Link from "next/link";
import "./landing.css";
import "./story.css";

import { ProgressHairline } from "../components/chrome/ProgressHairline";
import { SmoothScroll } from "../components/chrome/SmoothScroll";
import { StoryNav } from "../components/chrome/StoryNav";
import { AnatomyOfFee } from "../components/story/AnatomyOfFee";
import { EthicsSeal } from "../components/story/EthicsSeal";
import { ExplorerTeaser } from "../components/story/ExplorerTeaser";
import { FinaleSection } from "../components/story/FinaleSection";
import { GapSection } from "../components/story/GapSection";
import { Hero } from "../components/story/Hero";

const REPO = "https://github.com/viji-saravanan/remittance-watch";

/* The page is a server component: every section prerenders complete, readable
   HTML (progressive-enhancement contract, ADR-0006 §4). Fixed chrome renders
   OUTSIDE SmoothScroll — the smoother's wrapper transform would otherwise
   become its containing block (ADR-0006 §5). */

export default function Home() {
  return (
    <>
      <ProgressHairline />
      <StoryNav />

      <SmoothScroll>
        <header className="site-header">
          <div className="shell header-row">
            <Link href="/" className="wordmark">RemitWatch</Link>
            <nav className="site-nav" aria-label="Site">
              {/* In-page anchors are desktop affordances — on phones the row
                  wraps and tears (they hide ≤767px); the repo links stay. */}
              <a className="nav-anchor" href="#story-gap">The gap</a>
              <a className="nav-anchor" href="#story-explorer">Roadmap</a>
              <a href={REPO}>Source</a>
              <a href={`${REPO}/issues`}>Build log</a>
            </nav>
          </div>
        </header>

        <main>
          <Hero />
          <GapSection />
          <AnatomyOfFee />
          <ExplorerTeaser />
          <EthicsSeal />
          <FinaleSection />
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
            <p>
              MIT-licensed open source, maintained by{" "}
              <a href="https://github.com/viji-saravanan">@viji-saravanan</a> and{" "}
              <a href="https://github.com/callmearya">@callmearya</a>. No cookies, no trackers,
              no ads — and every number on this page links to its source.
            </p>
          </div>
        </footer>
      </SmoothScroll>
    </>
  );
}
