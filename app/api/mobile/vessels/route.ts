import { AuthError, requireMobileUser } from "@/lib/auth";
import { toMobileVessel } from "@/lib/mobile-catalog";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { getInspectableActiveVessels } from "@/lib/vessel-privileges";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireMobileUser(request);
    const pb = await getSuperuserPocketBase();
    const vessels = await getInspectableActiveVessels(pb, auth.user);

    return mobileSuccess({
      vessels: vessels.map(toMobileVessel),
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
      message: "Unable to load vessels.",
      retryable: true,
    });
  }
}
