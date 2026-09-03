import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Fully static export: `next build` emits plain HTML/CSS/JS into `out/`.
   * There are no serverless functions, no API routes and no runtime server —
   * every source is fetched during the build and baked into the output.
   */
  output: 'export',

  /**
   * Image optimization is a server feature and is unavailable in a static
   * export, so it is turned off explicitly rather than failing at build time.
   * Remote publisher images are hot-linked by `SmartImage`, which reserves
   * layout space and lazy-loads everything below the fold.
   */
  images: { unoptimized: true },

  /** Emit `about/index.html` rather than `about.html`, so static hosts serve clean URLs. */
  trailingSlash: true,

  reactStrictMode: true,

  /** Don't auto-generate AGENTS.md / CLAUDE.md into the repository root. */
  agentRules: false,

  /**
   * Pin the workspace root. Without this, Turbopack walks up past the project
   * looking for a lockfile and finds an unrelated one in the home directory.
   */
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
