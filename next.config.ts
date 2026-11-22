import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Next вставляет служебные inline-скрипты гидратации, поэтому без nonce
 * приходится разрешать `unsafe-inline`. Внешние скрипты, фреймы и объекты
 * при этом остаются запрещены; `unsafe-eval` нужен только dev-сборке.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Браузер применяет HSTS только по HTTPS; на localhost заголовок безвреден.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Самодостаточная сборка для Docker-образа (см. Dockerfile): рантайм
  // получает `server.js` и только те модули, которые реально импортируются.
  output: "standalone",
  typedRoutes: true,
  poweredByHeader: false,
  // Не даём `next dev` дописывать служебные правила в AGENTS.md.
  agentRules: false,
  turbopack: {
    root: rootDir,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
