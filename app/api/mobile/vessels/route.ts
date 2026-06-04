import { AuthError, requireMobileUser } from "@/lib/auth";
import { toMobileVessel } from "@/lib/mobile-catalog";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { VesselRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireMobileUser(request);
    const pb = await getSuperuserPocketBase();
    const vessels = await pb.collection("vessels").getFullList<VesselRecord>({
      filter: pb.filter("status = {:status}", { status: "active" }),
      sort: "name",
    });

    return mobileSuccess({
      vessels: vessels.map(toMobileVessel),
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
      message: "Unable to load vessels.",
      retryable: true,
    });
  }
}
