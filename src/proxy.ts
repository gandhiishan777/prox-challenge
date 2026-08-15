import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy for the artifact sandbox.
 *
 * This lives in middleware rather than next.config's static headers() for one
 * specific reason: the runner is embedded with `sandbox="allow-scripts"` and
 * deliberately WITHOUT `allow-same-origin`, which puts the document on an opaque
 * origin. The CSP keyword 'self' resolves against the document's own origin, and
 * an opaque origin matches nothing — so a `script-src 'self'` policy silently
 * blocks the page's own scripts and the runner never boots.
 *
 * Naming the origin explicitly fixes it: source expressions are matched against
 * the *resource* URL, which is a normal absolute URL on our host, so the runner's
 * scripts load while everything else stays locked down.
 */
function runnerCsp(origin: string, isDev: boolean): string {
  return [
    "default-src 'none'",
    // 'unsafe-eval' is required: artifacts are compiled with sucrase and run via
    // new Function. 'unsafe-inline' covers Next's inline bootstrap scripts.
    `script-src ${origin} 'unsafe-eval' 'unsafe-inline'`,
    // Tailwind's browser build injects a <style> element at runtime.
    `style-src ${origin} 'unsafe-inline'`,
    `img-src ${origin} data: blob:`,
    "font-src data:",
    // The important one: artifacts get no network. Even though the sandbox
    // already blocks reading same-origin responses, this stops a prompt-injected
    // artifact from firing off no-cors beacons to exfiltrate what it can see.
    isDev ? `connect-src ${origin} ws: wss:` : "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/**
 * The origin the *browser* used, which is not necessarily the one Next sees.
 *
 * Behind a reverse proxy — which is every real deployment of this, Railway,
 * Render and Fly included — `nextUrl.origin` is the internal address the
 * container is listening on. Naming that in the CSP produces a policy matching
 * nothing, `default-src 'none'` blocks the runner's own scripts, and the artifact
 * panel sits on "Starting sandbox…" forever while chat keeps working. Invisible
 * on localhost, where the two origins happen to coincide.
 */
function browserOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Guard the path explicitly rather than relying only on `config.matcher`.
  // This policy is deliberately hostile (default-src 'none'), and applying it to
  // the app shell by mistake is not a subtle failure: frame-src would inherit
  // 'none' and the browser would refuse to load the artifact iframe at all.
  if (!request.nextUrl.pathname.startsWith("/runner")) return response;

  response.headers.set(
    "Content-Security-Policy",
    runnerCsp(browserOrigin(request), process.env.NODE_ENV !== "production"),
  );
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/runner/:path*"],
};
