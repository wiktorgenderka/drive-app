import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['nodemailer'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['warm-cpu-victor-definition.trycloudflare.com'],
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: *.mapbox.com *.googleapis.com *.googleusercontent.com *.githubusercontent.com",
      "connect-src 'self' wss: ws: *.mapbox.com events.mapbox.com api.open-meteo.com api.spotify.com",
      "worker-src blob:",
      "child-src blob:",
      "font-src 'self' data:",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self)',
          },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
