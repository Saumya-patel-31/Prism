import { NextRequest, NextResponse } from "next/server";

/** Reachable without a session. Prefix-matched. */
const PUBLIC_PREFIXES = ["/login", "/api/auth"];

/** Reachable without a session. Matched exactly — "/" would prefix-match everything. */
const PUBLIC_EXACT = new Set(["/", "/icon.svg", "/robots.txt"]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Demo builds have no backend and no accounts — everything is public.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") return NextResponse.next();

  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("prism_auth")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
