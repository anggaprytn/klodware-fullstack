import { z } from "zod";
import { templateItemMap, templateItems } from "./inspection-template";
import type { ChecklistTemplateRecord, InspectionPhotoRecord } from "./types";

export const validScores = ["1", "2", "3", "4", "NA"] as const;
export type InspectionScore = (typeof validScores)[number];

export type PhotoRefPayload = {
  local_photo_id?: string;
  server_photo_id?: string;
  photo_id?: string;
  type?: "before" | "after";
};

export type InspectionItemPayload = {
  item_template_id: string;
  section_code?: string;
  score?: InspectionScore | "" | null;
  remarks?: string;
  is_resolved?: boolean;
  photo_refs?: PhotoRefPayload[];
  updated_at?: string;
  [key: string]: unknown;
};

export type InspectionUpsertPayload = {
  local_id: string;
  device_id: string;
  template_id: string;
  template_version: number;
  template_checksum: string;
  vessel_id: string;
  place?: string;
  started_at?: string;
  updated_at?: string;
  status?: string;
  items: InspectionItemPayload[];
  running_hours: unknown[];
  other_comments?: string;
  [key: string]: unknown;
};

export type InspectionSummary = {
  total_items: number;
  completed_items: number;
  score_1_count: number;
  score_2_count: number;
  score_3_count: number;
  score_4_count: number;
  na_count: number;
  findings_count: number;
  drydock_count: number;
  missing_score_count: number;
  missing_required_remarks_count: number;
  missing_required_photo_count: number;
  section_summaries: Array<{
    code: string;
    name: string;
    total_items: number;
    completed_items: number;
    findings_count: number;
  }>;
};

export type SubmitValidationDetail = {
  item_template_id: string;
  field: string;
  message: string;
};

const scoreSchema = z
  .union([
    z.literal("1"),
    z.literal("2"),
    z.literal("3"),
    z.literal("4"),
    z.literal("NA"),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return value;
    return String(value) as InspectionScore;
  });

const photoRefSchema = z
  .object({
    local_photo_id: z.string().trim().min(1).optional(),
    server_photo_id: z.string().trim().min(1).optional(),
    photo_id: z.string().trim().min(1).optional(),
    type: z.enum(["before", "after"]).optional(),
  })
  .passthrough();

const itemSchema = z
  .object({
    item_template_id: z.string().trim().min(1),
    section_code: z.string().trim().min(1).optional(),
    score: scoreSchema,
    remarks: z.string().optional(),
    is_resolved: z.boolean().optional(),
    photo_refs: z.array(photoRefSchema).optional().default([]),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const inspectionUpsertSchema = z
  .object({
    local_id: z.string().trim().min(1),
    device_id: z.string().trim().min(1),
    template_id: z.string().trim().min(1),
    template_version: z.coerce.number().int().positive(),
    template_checksum: z.string().trim().min(1),
    vessel_id: z.string().trim().min(1),
    place: z.string().optional(),
    started_at: z.string().optional(),
    updated_at: z.string().optional(),
    status: z.string().optional(),
    items: z.array(itemSchema),
    running_hours: z.array(z.unknown()).optional().default([]),
    other_comments: z.string().optional(),
  })
  .passthrough();

function normalizedItemMap(items: InspectionItemPayload[]) {
  return new Map(items.map((item) => [item.item_template_id, item]));
}

function isValidScore(score: unknown): score is InspectionScore {
  return validScores.includes(score as InspectionScore);
}

function hasPayloadPhotoRef(item: InspectionItemPayload, type: "before" | "after") {
  return (item.photo_refs ?? []).some(
    (ref) =>
      ref.type === type &&
      Boolean(ref.local_photo_id || ref.server_photo_id || ref.photo_id),
  );
}

function photoKey(itemTemplateId: string, photoType: "before" | "after") {
  return `${itemTemplateId}:${photoType}`;
}

function uploadedPhotoMaps(photos: InspectionPhotoRecord[] = []) {
  return {
    byItemType: new Set(
      photos.map((photo) => photoKey(photo.item_template_id, photo.photo_type)),
    ),
    byId: new Map(photos.map((photo) => [photo.id, photo])),
  };
}

function hasUploadedPhoto(
  item: InspectionItemPayload,
  type: "before" | "after",
  photos: InspectionPhotoRecord[] = [],
) {
  const { byItemType, byId } = uploadedPhotoMaps(photos);
  if (byItemType.has(photoKey(item.item_template_id, type))) {
    return true;
  }

  return (item.photo_refs ?? []).some((ref) => {
    if (ref.type && ref.type !== type) return false;
    const serverPhotoId = ref.server_photo_id ?? ref.photo_id;
    if (!serverPhotoId) return false;
    const photo = byId.get(serverPhotoId);
    return (
      photo?.item_template_id === item.item_template_id &&
      photo.photo_type === type
    );
  });
}

function hasRequiredPhoto(
  item: InspectionItemPayload,
  type: "before" | "after",
  photos?: InspectionPhotoRecord[],
) {
  if (photos) {
    return hasUploadedPhoto(item, type, photos);
  }

  return hasPayloadPhotoRef(item, type);
}

export function validateItemIdsBelongToTemplate(
  payload: InspectionUpsertPayload,
  template: ChecklistTemplateRecord,
) {
  const itemMap = templateItemMap(template);
  const errors: SubmitValidationDetail[] = [];

  for (const item of payload.items) {
    if (!itemMap.has(item.item_template_id)) {
      errors.push({
        item_template_id: item.item_template_id,
        field: "item_template_id",
        message: "Checklist item does not belong to this template",
      });
    }
  }

  return errors;
}

export function calculateInspectionSummary(
  payload: Pick<InspectionUpsertPayload, "items">,
  template: ChecklistTemplateRecord,
  photos?: InspectionPhotoRecord[],
): InspectionSummary {
  const itemMap = normalizedItemMap(payload.items ?? []);
  const sections = new Map<
    string,
    { name: string; total: number; completed: number; findings: number }
  >();
  const summary: InspectionSummary = {
    total_items: 0,
    completed_items: 0,
    score_1_count: 0,
    score_2_count: 0,
    score_3_count: 0,
    score_4_count: 0,
    na_count: 0,
    findings_count: 0,
    drydock_count: 0,
    missing_score_count: 0,
    missing_required_remarks_count: 0,
    missing_required_photo_count: 0,
    section_summaries: [],
  };

  for (const templateItem of templateItems(template)) {
    summary.total_items += 1;
    const section = sections.get(templateItem.section_code) ?? {
      name: templateItem.section_code,
      total: 0,
      completed: 0,
      findings: 0,
    };
    section.total += 1;

    const item = itemMap.get(templateItem.id);
    const score = item?.score;
    if (!isValidScore(score)) {
      summary.missing_score_count += 1;
      sections.set(templateItem.section_code, section);
      continue;
    }

    summary.completed_items += 1;
    section.completed += 1;

    if (score === "1") summary.score_1_count += 1;
    if (score === "2") summary.score_2_count += 1;
    if (score === "3") summary.score_3_count += 1;
    if (score === "4") summary.score_4_count += 1;
    if (score === "NA") summary.na_count += 1;

    if ((score === "3" || score === "4") && item) {
      summary.findings_count += 1;
      section.findings += 1;

      if (!item.remarks?.trim()) {
        summary.missing_required_remarks_count += 1;
      }

      if (!hasRequiredPhoto(item, "before", photos)) {
        summary.missing_required_photo_count += 1;
      }

      if (item.is_resolved === true && !hasRequiredPhoto(item, "after", photos)) {
        summary.missing_required_photo_count += 1;
      }
    }

    if (score === "4") {
      summary.drydock_count += 1;
    }

    sections.set(templateItem.section_code, section);
  }

  summary.section_summaries = Array.from(sections.entries()).map(([code, value]) => ({
    code,
    name: value.name,
    total_items: value.total,
    completed_items: value.completed,
    findings_count: value.findings,
  }));

  return summary;
}

export function validateInspectionForSubmit(args: {
  payload: InspectionUpsertPayload;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
}) {
  const { payload, template, photos } = args;
  const itemMap = normalizedItemMap(payload.items ?? []);
  const details: SubmitValidationDetail[] = [];

  for (const templateItem of templateItems(template)) {
    const item = itemMap.get(templateItem.id);
    const score = item?.score;

    if (!isValidScore(score)) {
      details.push({
        item_template_id: templateItem.id,
        field: "score",
        message: "Score is required before final submit",
      });
      continue;
    }

    if ((score === "3" || score === "4") && item) {
      if (!item.remarks?.trim()) {
        details.push({
          item_template_id: templateItem.id,
          field: "remarks",
          message: "Remarks are required for score 3 or 4",
        });
      }

      if (!hasUploadedPhoto(item, "before", photos)) {
        details.push({
          item_template_id: templateItem.id,
          field: "before_photo",
          message: "Before photo is required for score 3 or 4",
        });
      }

      if (item.is_resolved === true && !hasUploadedPhoto(item, "after", photos)) {
        details.push({
          item_template_id: templateItem.id,
          field: "after_photo",
          message: "After photo is required for resolved findings",
        });
      }
    }
  }

  return details;
}
