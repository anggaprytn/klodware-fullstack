import { ADMIN_COOKIE } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const env = getServerEnv();
  const response = NextResponse.redirect(new URL("/admin/login", env.APP_BASE_URL), {
    status: 303,
  });

  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_BASE_URL.startsWith("https://"),
    path: "/admin",
    maxAge: 0,
  });

  return response;
}
