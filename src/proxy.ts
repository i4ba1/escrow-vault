import { NextResponse, type NextRequest } from "next/server";

// Auth.js v5 session cookie names (plain for http, __Secure- prefix for https).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Edge proxy (Next 16 successor of the middleware convention): coarse check
// only — bounce cookie-less requests to sign-in fast.
// It MUST NOT grant access — the portal layout re-verifies via auth() and
// every data access goes through requireAppSession()/requireRole().
// Kept dependency-free on purpose so the edge bundle never imports Node-only
// modules (Prisma, AWS SDKs).
export default function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/portal")) {
    return NextResponse.next();
  }
  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/signin";
    url.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};
