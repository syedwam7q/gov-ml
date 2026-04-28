/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Typed routes give us compile-time safety on every <Link href> across the
  // dashboard. Promoted out of experimental in Next 16.
  typedRoutes: true,
  // The control plane is a separate Vercel Functions Python deploy mounted
  // at /api/cp/*; the dashboard talks to it over the public URL configured
  // in vercel.ts. Headers below cover the dashboard surface itself; static
  // asset caching lives at the Vercel layer.
  headers() {
    return Promise.resolve([
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]);
  },
};

export default nextConfig;
