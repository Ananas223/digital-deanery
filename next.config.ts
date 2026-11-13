import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Не даём `next dev` дописывать служебные правила в AGENTS.md.
  agentRules: false,
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
