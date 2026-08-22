import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React strict mode: surface unsafe lifecycles early. Keep on.
  reactStrictMode: true,

  // Static export for GitHub Pages (ADR-0005): there is no server runtime anywhere —
  // every page and API response is rendered at build/ingest time.
  output: "export",

  // Project-site subpath. Derived from the deploy workflow (actions/configure-pages'
  // base_path output) so a repo rename can't silently 404 assets; the default matches
  // today's home. basePath is inlined at build time — changing it requires a rebuild.
  basePath: process.env.PAGES_BASE_PATH ?? "/remittance-watch",

  // Emit /about/index.html instead of /about.html: the documented-safe URL resolution
  // on GitHub Pages project sites.
  trailingSlash: true,

  // Required under output: 'export' — the default image loader emits /_next/image URLs
  // that don't exist on a static host and fail silently.
  images: { unoptimized: true },

  // This repo lives inside a multi-repo workspace; pin the root so Next
  // doesn't guess it from stray lockfiles up the tree.
  outputFileTracingRoot: import.meta.dirname,

  // Lint runs as its own CI step (`npm run lint`) with the full flat config,
  // not inside `next build`'s reduced check — keeps one source of truth.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
