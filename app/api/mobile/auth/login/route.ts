import { AuthError, authenticateMobileLogin, toMobileUserProfile } from "@/lib/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";
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

  const parsed = mobileLoginSchema.safeParse(payload);
  if (!parsed.success) {
    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Username and password are required.",
      retryable: false,
      details: parsed.error.flatten(),
    });
  }

  const limit = checkLoginRateLimit(request, parsed.data.username);
  if (limit.limited) {
    return mobileError(
      429,
      {
        code: "RATE_LIMITED",
        message: "Too many login attempts. Please try again later.",
        retryable: true,
      },
      {
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const auth = await authenticateMobileLogin(
      parsed.data.username,
      parsed.data.password,
    );
    clearLoginRateLimit(request, parsed.data.username);

    return mobileSuccess({
      access_token: auth.token,
      token_type: "Bearer",
      expires_at: auth.expiresAt,
      user: toMobileUserProfile(auth.user),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const status =
        error.code === "INVALID_CREDENTIALS"
          ? 401
          : error.code === "USER_INACTIVE"
            ? 403
            : 403;

      return mobileError(status, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Login failed.",
      retryable: true,
    });
  }
}
