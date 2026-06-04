import { AuthError, requireMobileUser, toMobileUserProfile } from "@/lib/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
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
        filter: pb.filter("is_active = true"),
        sort: "-version",
      }),
    ]);

    return mobileSuccess({
      user: toMobileUserProfile(auth.user),
      vessels: vessels.map((vessel) => ({
        id: vessel.id,
        name: vessel.name,
        code: vessel.code,
        imo_no: vessel.imo_no ?? "",
        status: vessel.status,
      })),
      checklist_templates: templates.map((template) => ({
        id: template.id,
        template_id: template.template_id,
        version: template.version,
        name: template.name,
        checksum: template.checksum,
        is_active: template.is_active,
        rating_options: template.rating_options_json,
        sections: template.sections_json,
      })),
      config: {
        api_contract: "mobile-rest-json-v1",
      },
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
      message: "Unable to bootstrap mobile data.",
      retryable: true,
    });
  }
}
