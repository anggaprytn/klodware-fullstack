import { createHash } from "node:crypto";
import type PocketBase from "pocketbase";
import { calculateInspectionSummary, type InspectionItemPayload } from "@/lib/inspection-summary";
import { rawPayloadFromInspection } from "@/lib/inspections";
import { templateItemMap, templateSections } from "@/lib/inspection-template";
import type {
  ChecklistTemplateRecord,
  InspectionPhotoRecord,
  InspectionRecord,
  VesselRecord,
} from "@/lib/types";
import {
  renderInspectionReportHtml as renderReportHtml,
  type InspectionReportData,
} from "./report-html";

type RunningHourValue = {
  equipment?: unknown;
  label?: unknown;
  id?: unknown;
  value?: unknown;
};

type RatingOption = {
  score?: unknown;
  value?: unknown;
  label?: unknown;
  description?: unknown;
};

function stringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function itemPayloadMap(items: InspectionItemPayload[]) {
  return new Map(items.map((item) => [item.item_template_id, item]));
}

function photoKey(itemTemplateId: string, photoType: string) {
  return `${itemTemplateId}:${photoType}`;
}

function hasPhoto(args: {
  item: InspectionItemPayload | undefined;
  itemTemplateId: string;
  photoType: "before" | "after";
  uploadedPhotoKeys: Set<string>;
}) {
  if (args.uploadedPhotoKeys.has(photoKey(args.itemTemplateId, args.photoType))) {
    return true;
  }

  return (args.item?.photo_refs ?? []).some(
    (ref) =>
      ref.type === args.photoType &&
      Boolean(ref.local_photo_id || ref.server_photo_id || ref.photo_id),
  );
}

function gpsValue(photo: InspectionPhotoRecord) {
  if (photo.latitude === undefined || photo.longitude === undefined) {
    return "";
  }
  return `${photo.latitude}, ${photo.longitude}`;
}

function scoreLegend(template: ChecklistTemplateRecord) {
  const options = arrayValue(template.rating_options_json)
    .map((entry) => {
      const option = entry as RatingOption;
      const score = stringValue(option.score, stringValue(option.value));
      if (!score) return null;
      return {
        score,
        label: stringValue(
          option.label,
          stringValue(option.description, score),
        ),
      };
    })
    .filter((entry): entry is { score: string; label: string } => Boolean(entry));

  if (options.length > 0) return options;

  return [
    { score: "1", label: "Good condition" },
    { score: "2", label: "Acceptable condition" },
    { score: "3", label: "Finding requires attention" },
    { score: "4", label: "Critical or drydock item" },
    { score: "NA", label: "Not applicable" },
  ];
}

function reportChecksum(data: unknown) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function fileUrl(args: {
  pb: PocketBase;
  photo: InspectionPhotoRecord;
  fileAccessToken?: string;
}) {
  const options: Record<string, string> = { thumb: "900x900" };
  if (args.fileAccessToken) {
    options.token = args.fileAccessToken;
  }
  return args.pb.files.getURL(args.photo, args.photo.file, options);
}

export function buildInspectionReportData(args: {
  pb: PocketBase;
  inspection: InspectionRecord;
  vessel: VesselRecord;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
  generatedAt?: string;
  fileAccessToken?: string;
}): InspectionReportData {
  const payload = rawPayloadFromInspection(args.inspection);
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const summary =
    (args.inspection.summary_json as ReturnType<
      typeof calculateInspectionSummary
    > | null) ?? calculateInspectionSummary(payload, args.template, args.photos);
  const payloadItems = itemPayloadMap(payload.items);
  const templateItems = templateItemMap(args.template);
  const uploadedPhotoKeys = new Set(
    args.photos.map((photo) => photoKey(photo.item_template_id, photo.photo_type)),
  );

  const sections = templateSections(args.template).map((section) => ({
    code: section.code,
    name: section.name,
    items: section.items.map((templateItem) => {
      const item = payloadItems.get(templateItem.id);
      return {
        id: templateItem.id,
        label: templateItem.label,
        score: stringValue(item?.score),
        remarks: item?.remarks ?? "",
        hasBeforePhoto: hasPhoto({
          item,
          itemTemplateId: templateItem.id,
          photoType: "before",
          uploadedPhotoKeys,
        }),
        hasAfterPhoto: hasPhoto({
          item,
          itemTemplateId: templateItem.id,
          photoType: "after",
          uploadedPhotoKeys,
        }),
      };
    }),
  }));

  const findings = payload.items
    .filter((item) => item.score === "3" || item.score === "4")
    .map((item) => ({
      itemLabel: templateItems.get(item.item_template_id)?.label ?? item.item_template_id,
      score: stringValue(item.score),
      remarks: item.remarks ?? "",
    }));
  const drydockItems = payload.items
    .filter((item) => item.score === "4")
    .map((item) => ({
      itemLabel: templateItems.get(item.item_template_id)?.label ?? item.item_template_id,
      remarks: item.remarks ?? "",
    }));

  const runningHours = arrayValue(payload.running_hours).map((entry) => {
    const value = entry as RunningHourValue;
    return {
      equipment: stringValue(
        value.equipment,
        stringValue(value.label, stringValue(value.id, "Running hour")),
      ),
      value: stringValue(value.value),
    };
  });

  const photos = args.photos.map((photo) => ({
    id: photo.id,
    itemLabel: templateItems.get(photo.item_template_id)?.label ?? photo.item_template_id,
    photoType: photo.photo_type,
    capturedAt: photo.captured_at,
    gps: gpsValue(photo),
    imageUrl: fileUrl({
      pb: args.pb,
      photo,
      fileAccessToken: args.fileAccessToken,
    }),
  }));

  const checksum = reportChecksum({
    inspection_id: args.inspection.id,
    inspection_updated: args.inspection.updated,
    template_checksum: args.template.checksum,
    summary,
    payload,
    photo_checksums: args.photos.map((photo) => photo.checksum),
  });

  return {
    title: "Superintendent Monthly Inspection Report",
    vesselName: args.vessel.name,
    inspectionDate:
      args.inspection.submitted_at ?? args.inspection.started_at ?? args.inspection.created,
    place: args.inspection.place ?? "",
    inspectorName: args.inspection.inspector_name,
    scoreLegend: scoreLegend(args.template),
    summary: {
      totalItems: summary.total_items,
      completedItems: summary.completed_items,
      scoreDistribution: [
        { score: "1", count: summary.score_1_count },
        { score: "2", count: summary.score_2_count },
        { score: "3", count: summary.score_3_count },
        { score: "4", count: summary.score_4_count },
        { score: "NA", count: summary.na_count },
      ],
      findingsCount: summary.findings_count,
      drydockCount: summary.drydock_count,
    },
    findings,
    drydockItems,
    sections,
    photos,
    runningHours,
    otherComments: payload.other_comments ?? "",
    generatedAt,
    reportVersion: "phase-2c-v1",
    checksum,
  };
}

export function renderInspectionReportHtml(args: {
  pb: PocketBase;
  inspection: InspectionRecord;
  vessel: VesselRecord;
  template: ChecklistTemplateRecord;
  photos: InspectionPhotoRecord[];
  generatedAt?: string;
  fileAccessToken?: string;
}) {
  return renderReportHtml(buildInspectionReportData(args));
}
