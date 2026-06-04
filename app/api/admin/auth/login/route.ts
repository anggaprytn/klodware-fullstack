import { ADMIN_COOKIE, AuthError, authenticateAdminLogin } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
import { mobileLoginSchema } from "@/lib/validation/mobile-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Invalid JSON body.",
      retryable: false,
    });
  }

  const parsed = mobileLoginSchema.pick({ username: true, password: true }).safeParse(payload);
  if (!parsed.success) {
    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Username and password are required.",
      retryable: false,
      details: parsed.error.flatten(),
    });
  }

  try {
    const auth = await authenticateAdminLogin(
      parsed.data.username,
      parsed.data.password,
    );
    const response = mobileSuccess({ ok: true });
    const secure = getServerEnv().APP_BASE_URL.startsWith("https://");

    response.cookies.set(ADMIN_COOKIE, auth.token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/admin",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return mobileError(error.code === "INVALID_CREDENTIALS" ? 401 : 403, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Admin login failed.",
      retryable: true,
    });
  }
}
