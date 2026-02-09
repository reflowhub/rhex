import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow /partner/login without auth
  if (pathname === "/partner/login") {
    return NextResponse.next();
  }

  // Check for session cookie on all /partner/* routes
  const sessionCookie = request.cookies.get("__session")?.value;
  if (!sessionCookie) {
    const loginUrl = new URL("/partner/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/partner/:path*"],
};
