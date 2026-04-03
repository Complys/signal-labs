// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function clean(v: string | null) {
  return String(v ?? "").trim();
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow Next internals + static assets through
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ---------- Affiliate ref capture (site-wide) ----------
  const ref = clean(req.nextUrl.searchParams.get("ref"));
  if (ref) {
    const res = NextResponse.next();
    res.cookies.set("aff_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  // ---------- Admin protection ----------
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const role = (token as any)?.role ?? (token as any)?.user?.role ?? null;
  if (role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};