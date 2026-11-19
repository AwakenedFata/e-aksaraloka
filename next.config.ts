import type { NextConfig } from "next";

/**
 * Baseline security headers (Stage 0).
 *
 * A Content-Security-Policy is intentionally NOT set yet: a correct CSP for the App Router needs a
 * nonce strategy via `proxy.ts`, and a wrong CSP silently breaks hydration. Tracked in
 * docs/adr/0005-security-baseline.md and scheduled for Stage 9.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Aggressive immutable caching for all image sequence frames & static visual assets
        source:
          "/:dir(hero-frames|materi-frames|reading-frames|latihan-frames|hallway-frames|studio-tulis-frames|seq-packs|seq-videos|assets|peta-frame)/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
