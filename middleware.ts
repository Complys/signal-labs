import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  
  if (ref) {
    const res = NextResponse.next();
    // Set cookie for 30 days
    res.cookies.set("aff_ref", ref.toUpperCase().trim(), {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_static|favicon.ico|admin).*)"],
};
