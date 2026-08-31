import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthEnabled, isValidSession } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (isValidSession(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
