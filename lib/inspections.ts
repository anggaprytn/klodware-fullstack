import type PocketBase from "pocketbase";
import { calculateInspectionSummary, type InspectionUpsertPayload } from "./inspection-summary";
import {
  templateItemMap,
  templateSections,
  type TemplateChecklistItem,
} from "./inspection-template";
import { isPocketBaseResponseError } from "./pocketbase";
import type {
  ChecklistTemplateRecord,
  InspectionPhotoRecord,
  InspectionRecord,
  PdfStatus,
  PdfReportRecord,
  UserRecord,
  VesselRecord,
} from "./types";

export class InspectionAccessError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

export async function getVesselOrThrow(pb: PocketBase, vesselId: string) {
  try {
    return await pb.collection("vessels").getOne<VesselRecord>(vesselId);
  } catch (error) {
    if (isPocketBaseResponseError(error) && error.status === 404) {
      throw new InspectionAccessError("NOT_FOUND", "Vessel was not found.");
    }
    throw error;
  }
}

export async function getTemplateForPayload(
  pb: PocketBase,
  payload: Pick<
    InspectionUpsertPayload,
    "template_id" | "template_version" | "template_checksum"
  >,
) {
  const filter = pb.filter(
    "template_id = {:templateId} && version = {:version}",
    {
      templateId: payload.template_id,
      version: payload.template_version,
    },
  );

  try {
    const template = await pb
      .collection("checklist_templates")
      .getFirstListItem<ChecklistTemplateRecord>(filter);

    if (template.checksum !== payload.template_checksum) {
      throw new InspectionAccessError(
        "CONFLICT",
        "Checklist template checksum does not match the server template.",
      );
    }

    return template;
  } catch (error) {
    if (error instanceof InspectionAccessError) {
      throw error;
    }

    if (isPocketBaseResponseError(error) && error.status === 404) {
      throw new InspectionAccessError(
        "NOT_FOUND",
        "Checklist template was not found.",
      );
    }

    throw error;
  }
}

export async function getTemplateForInspection(
  pb: PocketBase,
  inspection: InspectionRecord,
) {
  return getTemplateForPayload(pb, {
    template_id: inspection.template_id,
    template_version: inspection.template_version,
    template_checksum: inspection.template_checksum,
  });
}

export async function getInspectionOrThrow(pb: PocketBase, id: string) {
  try {
    return await pb.collection("inspections").getOne<InspectionRecord>(id, {
      expand: "vessel,user",
    });
  } catch (error) {
    if (isPocketBaseResponseError(error) && error.status === 404) {
      throw new InspectionAccessError("NOT_FOUND", "Inspection was not found.");
    }
    throw error;
  }
}

export function assertInspectionAccess(
  inspection: InspectionRecord,
  user: UserRecord,
) {
  if (user.role !== "admin" && inspection.user !== user.id) {
    throw new InspectionAccessError(
      "FORBIDDEN",
      "You are not allowed to access this inspection.",
    );
  }
}

export function assertInspectionUnlocked(inspection: InspectionRecord) {
  if (inspection.locked_at || inspection.status === "submitted" || inspection.status === "locked") {
    throw new InspectionAccessError(
      "CONFLICT",
      "Inspection is locked and cannot be changed.",
    );
  }
}

export function rawPayloadFromInspection(
  inspection: InspectionRecord,
): InspectionUpsertPayload {
  const payload = inspection.raw_payload_json as InspectionUpsertPayload | undefined;
  if (!payload || !Array.isArray(payload.items)) {
    throw new InspectionAccessError(
      "CONFLICT",
      "Inspection payload is missing or invalid.",
    );
  }
  return payload;
}

export async function inspectionPhotos(pb: PocketBase, inspectionId: string) {
  return pb.collection("inspection_photos").getFullList<InspectionPhotoRecord>({
    filter: pb.filter("inspection = {:inspectionId}", { inspectionId }),
    sort: "item_template_id,photo_type,captured_at",
  });
}

export async function findPdfReport(pb: PocketBase, inspectionId: string) {
  const [report] = await findPdfReports(pb, inspectionId);
  return report ?? null;
}

export async function findPdfReports(pb: PocketBase, inspectionId: string) {
  const reports = await pb.collection("pdf_reports").getFullList<PdfReportRecord>({
    filter: pb.filter("inspection.id = {:inspectionId}", { inspectionId }),
  });
  return reports.sort((a, b) => {
    const left = Date.parse(a.updated ?? a.created ?? "");
    const right = Date.parse(b.updated ?? b.created ?? "");
    return right - left;
  });
}

export function isSubmittedInspection(inspection: InspectionRecord) {
  return Boolean(
    inspection.locked_at ||
      inspection.status === "submitted" ||
      inspection.status === "locked",
  );
}

export function readyPdfReportHasFile(
  report: PdfReportRecord | null,
): report is PdfReportRecord & { file: string; file_size_bytes: number } {
  return Boolean(
    report &&
      report.status === "ready" &&
      report.file &&
      (report.file_size_bytes ?? 0) > 0,
  );
}

export async function setInspectionPdfStatus(
  pb: PocketBase,
  inspectionId: string,
  pdfStatus: PdfStatus,
) {
  return pb.collection("inspections").update<InspectionRecord>(inspectionId, {
    pdf_status: pdfStatus,
  });
}

export async function ensureQueuedPdfReport(pb: PocketBase, inspectionId: string) {
  const reports = await findPdfReports(pb, inspectionId);
  const [existing, ...duplicates] = reports;

  await Promise.all(
    duplicates
      .filter((report) => report.status !== "failed")
      .map((report) =>
        pb.collection("pdf_reports").update(report.id, {
          status: "failed",
          error_message: "Superseded by current PDF report.",
        }),
      ),
  );

  if (existing) {
    return pb.collection("pdf_reports").update<PdfReportRecord>(existing.id, {
      status: "queued",
      file_size_bytes: 0,
      generated_at: "",
      error_message: "",
      metadata_json: {
        queued_at: new Date().toISOString(),
        phase: "2C",
      },
    });
  }

  return pb.collection("pdf_reports").create<PdfReportRecord>({
    inspection: inspectionId,
    status: "queued",
    file_size_bytes: 0,
    metadata_json: {
      queued_at: new Date().toISOString(),
      phase: "2C",
    },
  });
}

export function itemSectionCode(
  template: ChecklistTemplateRecord,
  itemTemplateId: string,
) {
  return templateItemMap(template).get(itemTemplateId)?.section_code ?? "";
}

export function itemBelongsToTemplate(
  template: ChecklistTemplateRecord,
  itemTemplateId: string,
): TemplateChecklistItem | null {
  return templateItemMap(template).get(itemTemplateId) ?? null;
}

function vesselFromExpand(inspection: InspectionRecord) {
  const expanded = inspection.expand as Record<string, unknown> | undefined;
  return expanded?.vessel as VesselRecord | undefined;
}

function userFromExpand(inspection: InspectionRecord) {
  const expanded = inspection.expand as Record<string, unknown> | undefined;
  return expanded?.user as UserRecord | undefined;
}

export function toMobileInspectionCard(inspection: InspectionRecord) {
  const summary = inspection.summary_json as Partial<
    ReturnType<typeof calculateInspectionSummary>
  > | null;
  const vessel = vesselFromExpand(inspection);

  return {
    inspection_id: inspection.id,
    local_id: inspection.local_id,
    vessel_id: inspection.vessel,
    vessel_name: vessel?.name ?? "",
    status: inspection.status,
    pdf_status: inspection.pdf_status,
    submitted_at: inspection.submitted_at ?? null,
    updated_at: inspection.synced_at ?? inspection.updated,
    synced_at: inspection.synced_at ?? null,
    findings_count: summary?.findings_count ?? 0,
    drydock_count: summary?.drydock_count ?? 0,
    completed_items: summary?.completed_items ?? 0,
    total_items: summary?.total_items ?? 0,
  };
}

export function toMobileInspectionDetail(args: {
  inspection: InspectionRecord;
  vessel?: VesselRecord;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
}) {
  const { inspection, template, photos } = args;
  const vessel = args.vessel ?? vesselFromExpand(inspection);

  return {
    inspection: {
      inspection_id: inspection.id,
      local_id: inspection.local_id,
      device_id: inspection.device_id,
      vessel_id: inspection.vessel,
      template_id: inspection.template_id,
      template_version: inspection.template_version,
      template_checksum: inspection.template_checksum,
      inspector_name: inspection.inspector_name,
      inspector_employee_no: inspection.inspector_employee_no ?? "",
      place: inspection.place ?? "",
      status: inspection.status,
      locked: Boolean(inspection.locked_at),
      pdf_status: inspection.pdf_status,
      started_at: inspection.started_at ?? null,
      submitted_at: inspection.submitted_at ?? null,
      synced_at: inspection.synced_at ?? null,
      locked_at: inspection.locked_at ?? null,
    },
    vessel: vessel
      ? {
          id: vessel.id,
          name: vessel.name,
          imo: vessel.imo ?? vessel.imo_no ?? "",
          status: vessel.status,
        }
      : null,
    template: {
      id: template.template_id,
      record_id: template.id,
      name: template.name,
      version: template.version,
      checksum: template.checksum,
      sections_count: template.sections_count ?? templateSections(template).length,
      items_count: template.items_count ?? 0,
    },
    summary: inspection.summary_json ?? null,
    raw_payload_json: inspection.raw_payload_json ?? null,
    photos: photos.map((photo) => ({
      photo_id: photo.id,
      local_photo_id: photo.local_photo_id,
      inspection_id: photo.inspection,
      item_template_id: photo.item_template_id,
      section_code: photo.section_code ?? "",
      photo_type: photo.photo_type,
      captured_at: photo.captured_at,
      uploaded_at: photo.uploaded_at,
      latitude: photo.latitude ?? null,
      longitude: photo.longitude ?? null,
      checksum: photo.checksum,
      metadata_json: photo.metadata_json ?? null,
    })),
    pdf_status: inspection.pdf_status,
  };
}

export function adminInspectionRow(inspection: InspectionRecord) {
  const summary = inspection.summary_json as Partial<
    ReturnType<typeof calculateInspectionSummary>
  > | null;
  const vessel = vesselFromExpand(inspection);
  const user = userFromExpand(inspection);

  return {
    id: inspection.id,
    vessel_name: vessel?.name ?? inspection.vessel,
    inspector_name: inspection.inspector_name || user?.full_name || "",
    status: inspection.status,
    pdf_status: inspection.pdf_status,
    submitted_at: inspection.submitted_at ?? "",
    synced_at: inspection.synced_at ?? inspection.updated,
    findings_count: summary?.findings_count ?? 0,
    drydock_count: summary?.drydock_count ?? 0,
    completed_items: summary?.completed_items ?? 0,
    total_items: summary?.total_items ?? 0,
  };
}
