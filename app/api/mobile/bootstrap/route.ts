import { AuthError, requireMobileUser, toMobileUserProfile } from "@/lib/auth";
import { toMobileTemplateMetadata } from "@/lib/mobile-catalog";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { ChecklistTemplateRecord, VesselRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireMobileUser(request);
    const pb = await getSuperuserPocketBase();

    const [vessels, templates] = await Promise.all([
      pb.collection("vessels").getFullList<VesselRecord>({
        filter: pb.filter("status = {:status}", { status: "active" }),
        sort: "name",
      }),
      pb.collection("checklist_templates").getFullList<ChecklistTemplateRecord>({
        filter: pb.filter("active = true || is_active = true"),
        sort: "-version",
      }),
    ]);
    const activeTemplate = templates[0] ?? null;

    return mobileSuccess({
      app_config: {
        api_contract: "mobile-rest-json-v1",
        inspection_execution: "mobile-only",
      },
      active_template: activeTemplate
        ? toMobileTemplateMetadata(activeTemplate)
        : null,
      vessel_catalog: {
        count: vessels.length,
        active_only: true,
      },
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
      message: "Unable to bootstrap mobile data.",
      retryable: true,
    });
  }
}
