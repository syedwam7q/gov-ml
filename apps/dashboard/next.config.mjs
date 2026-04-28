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
  // Local development: proxy /api/cp/* and /api/cp/stream to the FastAPI
  // dev server so the browser sees a single same-origin path. Production
  // routing is owned by vercel.ts — this block is dev-only.
  rewrites() {
    const env = globalThis.process?.env ?? {};
    if (env.NODE_ENV !== "development") {
      return Promise.resolve([]);
    }
    const cp = (env.AEGIS_CONTROL_PLANE_DEV_URL ?? "http://127.0.0.1:8000").replace(
      /\/$/,
      "",
    );
    const assistant = (env.AEGIS_ASSISTANT_DEV_URL ?? "http://127.0.0.1:8005").replace(
      /\/$/,
      "",
    );
    return Promise.resolve([
      { source: "/api/cp/:path*", destination: `${cp}/api/cp/:path*` },
      { source: "/api/assistant/:path*", destination: `${assistant}/:path*` },
    ]);
  },
};

export default nextConfig;
