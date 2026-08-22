import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React strict mode: surface unsafe lifecycles early. Keep on.
  reactStrictMode: true,

  // This repo lives inside a multi-repo workspace; pin the root so Next
  // doesn't guess it from stray lockfiles up the tree.
  outputFileTracingRoot: import.meta.dirname,

  // Lint runs as its own CI step (`npm run lint`) with the full flat config,
  // not inside `next build`'s reduced check — keeps one source of truth.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
