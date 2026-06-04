import { AuthError, requireMobileUser, toMobileUserProfile } from "@/lib/auth";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireMobileUser(request);

    return mobileSuccess({
      user: toMobileUserProfile(auth.user),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return mobileError(mobileAuthErrorStatus(error.code), {
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
