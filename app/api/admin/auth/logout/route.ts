import { ADMIN_COOKIE } from "@/lib/auth";
import { mobileSuccess } from "@/lib/mobile-response";

export const runtime = "nodejs";

export async function POST() {
  const response = mobileSuccess({ logged_out: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });

  return response;
}
