import { AuthError, requireMobileUser, toMobileUserProfile } from "@/lib/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireMobileUser(request);

    return mobileSuccess({
      user: toMobileUserProfile(auth.user),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return mobileError(error.code === "FORBIDDEN" ? 403 : 401, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to load current user.",
      retryable: true,
    });
  }
}
