import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Partner routes ---
  if (pathname.startsWith("/partner")) {
    if (pathname === "/partner/login") return NextResponse.next();

    const sessionCookie = request.cookies.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }
    return NextResponse.next();
  }

  // --- Admin routes ---
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const adminCookie = request.cookies.get("__admin_session")?.value;
    if (!adminCookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/partner/:path*", "/admin/:path*"],
};
