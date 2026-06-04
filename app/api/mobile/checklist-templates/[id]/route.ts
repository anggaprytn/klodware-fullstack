import { AuthError, requireMobileUser } from "@/lib/auth";
import { toMobileTemplateDetail } from "@/lib/mobile-catalog";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import type { ChecklistTemplateRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMobileUser(request);
    const { id } = await params;
    const pb = await getSuperuserPocketBase();
    const filter = pb.filter(
      "template_id = {:id} || id = {:id}",
      { id },
    );
    const template = await pb
      .collection("checklist_templates")
      .getFirstListItem<ChecklistTemplateRecord>(filter);

    return mobileSuccess({
      template: toMobileTemplateDetail(template),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return mobileError(mobileAuthErrorStatus(error.code), {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    if (isPocketBaseResponseError(error) && error.status === 404) {
      return mobileError(404, {
        code: "NOT_FOUND",
        message: "Checklist template was not found.",
        retryable: false,
      });
    }

    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to load checklist template.",
      retryable: true,
    });
  }
}
