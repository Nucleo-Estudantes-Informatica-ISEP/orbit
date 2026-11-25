import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
      ],
    }, {
      source: "/reset-password",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://api:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
