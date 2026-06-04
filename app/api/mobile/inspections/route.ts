import { AuthError, requireMobileUser } from "@/lib/auth";
import { toMobileInspectionCard } from "@/lib/inspections";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { logSyncEvent, requestIdFrom } from "@/lib/sync-events";
import type { InspectionRecord, InspectionStatus, PdfStatus } from "@/lib/types";

export const runtime = "nodejs";

const inspectionStatuses = new Set<InspectionStatus>([
  "draft",
  "submitted",
  "locked",
]);
const pdfStatuses = new Set<PdfStatus>([
  "not_requested",
  "queued",
  "generating",
  "ready",
  "failed",
]);

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  let auth: Awaited<ReturnType<typeof requireMobileUser>>;

  try {
    auth = await requireMobileUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      await logSyncEvent({
        requestId,
        eventType: "unauthorized_access",
        status: "failed",
        retryable: false,
        error: { code: error.code, message: error.message },
      });

      return mobileError(error.code === "FORBIDDEN" ? 403 : 401, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }
    throw error;
  }

  try {
    const pb = await getSuperuserPocketBase();
    const url = new URL(request.url);
    const filters: string[] = [];

    if (auth.user.role !== "admin") {
      filters.push(pb.filter("user = {:userId}", { userId: auth.user.id }));
    }

    const vesselId = url.searchParams.get("vessel_id");
    if (vesselId) {
      filters.push(pb.filter("vessel = {:vesselId}", { vesselId }));
    }

    const status = url.searchParams.get("status");
    if (status && inspectionStatuses.has(status as InspectionStatus)) {
      filters.push(pb.filter("status = {:status}", { status }));
    }

    const pdfStatus = url.searchParams.get("pdf_status");
    if (pdfStatus && pdfStatuses.has(pdfStatus as PdfStatus)) {
      filters.push(pb.filter("pdf_status = {:pdfStatus}", { pdfStatus }));
    }

    const inspections = await pb.collection("inspections").getFullList<InspectionRecord>({
      filter: filters.join(" && "),
      expand: "vessel",
      sort: "-synced_at",
    });

    return mobileSuccess({
      inspections: inspections.map(toMobileInspectionCard),
    });
  } catch {
    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to load inspections.",
      retryable: true,
    });
  }
}
