/** @type {import('next').NextConfig} */

// NOTE: the artifact runner's Content-Security-Policy is set in src/middleware.ts,
// not here. It has to be computed per-request because the runner is sandboxed onto
// an opaque origin, where the 'self' keyword matches nothing — see the comment
// there for the full explanation.
const nextConfig = {
  // Artifacts run untrusted model-generated code; nothing about them should be
  // cached or indexed.
  async headers() {
    return [
      {
        source: "/runner",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
