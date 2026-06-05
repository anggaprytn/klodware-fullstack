import {
  type InspectionItemPayload,
  type InspectionSummary,
  type InspectionUpsertPayload,
  validateInspectionForSubmit,
} from "./inspection-summary";
import { templateItemMap, templateSections } from "./inspection-template";
import type {
  ChecklistTemplateRecord,
  InspectionPhotoRecord,
  InspectionRecord,
} from "./types";

export type AdminFinding = {
  itemTemplateId: string;
  sectionCode: string;
  label: string;
  score: string;
  remarks: string;
  missingRemarks: boolean;
  missingBeforePhoto: boolean;
  missingAfterPhoto: boolean;
  requiresAttention: boolean;
};

export function inspectionSummaryValue(inspection: InspectionRecord) {
  return (inspection.summary_json ?? null) as Partial<InspectionSummary> | null;
}

export function inspectionPayloadValue(inspection: InspectionRecord) {
  const payload = inspection.raw_payload_json as Partial<InspectionUpsertPayload> | null;

  if (!payload || !Array.isArray(payload.items)) {
    return null;
  }

  return payload as InspectionUpsertPayload;
}

export function inspectionItems(inspection: InspectionRecord) {
  return inspectionPayloadValue(inspection)?.items ?? [];
}

export function photoUrl(photoId: string) {
  return `/api/admin/inspection-photos/${encodeURIComponent(photoId)}`;
}

function photoKey(itemTemplateId: string, type: "before" | "after") {
  return `${itemTemplateId}:${type}`;
}

export function photoMaps(photos: InspectionPhotoRecord[]) {
  const byItemType = new Map<string, InspectionPhotoRecord[]>();

  for (const photo of photos) {
    const key = photoKey(photo.item_template_id, photo.photo_type);
    byItemType.set(key, [...(byItemType.get(key) ?? []), photo]);
  }

  return { byItemType };
}

export function photosForItem(
  photos: InspectionPhotoRecord[],
  itemTemplateId: string,
  type: "before" | "after",
) {
  return photoMaps(photos).byItemType.get(photoKey(itemTemplateId, type)) ?? [];
}

function validationMissingFields(args: {
  inspection: InspectionRecord;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
}) {
  const payload = inspectionPayloadValue(args.inspection);
  if (!payload) return new Map<string, Set<string>>();

  const details = validateInspectionForSubmit({
    payload,
    template: args.template,
    photos: args.photos,
  });
  const fieldsByItem = new Map<string, Set<string>>();

  for (const detail of details) {
    const current = fieldsByItem.get(detail.item_template_id) ?? new Set<string>();
    current.add(detail.field);
    fieldsByItem.set(detail.item_template_id, current);
  }

  return fieldsByItem;
}

export function adminFindings(args: {
  inspection: InspectionRecord;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
}): AdminFinding[] {
  const items = inspectionItems(args.inspection);
  const templateItems = templateItemMap(args.template);
  const missingFields = validationMissingFields(args);

  return items
    .map((item: InspectionItemPayload): AdminFinding | null => {
      const templateItem = templateItems.get(item.item_template_id);
      const score = item.score ? String(item.score) : "";
      const fields = missingFields.get(item.item_template_id) ?? new Set<string>();
      const missingRemarks = fields.has("remarks");
      const missingBeforePhoto = fields.has("before_photo");
      const missingAfterPhoto = fields.has("after_photo");
      const isFinding = score === "3" || score === "4";
      const hasRemarks = Boolean(item.remarks?.trim());
      const requiresAttention =
        isFinding || missingRemarks || missingBeforePhoto || missingAfterPhoto || hasRemarks;

      if (!requiresAttention) return null;

      return {
        itemTemplateId: item.item_template_id,
        sectionCode: item.section_code ?? templateItem?.section_code ?? "",
        label: templateItem?.label ?? item.item_template_id,
        score: score || "Missing",
        remarks: item.remarks?.trim() ?? "",
        missingRemarks,
        missingBeforePhoto,
        missingAfterPhoto,
        requiresAttention,
      };
    })
    .filter((finding): finding is AdminFinding => Boolean(finding));
}

export function checklistRows(args: {
  inspection: InspectionRecord;
  template: ChecklistTemplateRecord;
}) {
  const itemById = new Map(
    inspectionItems(args.inspection).map((item) => [item.item_template_id, item]),
  );

  return templateSections(args.template).map((section) => ({
    code: section.code,
    name: section.name,
    items: section.items.map((item) => {
      const response = itemById.get(item.id);

      return {
        id: item.id,
        label: item.label,
        score: response?.score ? String(response.score) : "Missing",
        remarks: response?.remarks?.trim() ?? "",
      };
    }),
  }));
}
