import type { RecordModel } from "pocketbase";

export type UserRole = "admin" | "inspector" | "viewer";
export type UserStatus = "active" | "inactive";

export type UserRecord = RecordModel & {
  username: string;
  full_name: string;
  employee_no?: string;
  role: UserRole;
  status: UserStatus;
  metadata_json?: unknown;
};

export type MobileUserProfile = {
  id: string;
  username: string;
  full_name: string;
  employee_no: string;
  role: UserRole;
  status: UserStatus;
};

export type VesselRecord = RecordModel & {
  name: string;
  code?: string;
  imo_no?: string;
  imo?: string;
  mmsi?: string;
  call_sign?: string;
  flag?: string;
  year_built?: number;
  image?: string;
  status: "active" | "inactive";
};

export type ChecklistTemplateRecord = RecordModel & {
  template_id: string;
  type: string;
  version: number;
  name: string;
  checksum: string;
  active?: boolean;
  is_active: boolean;
  schema_json?: unknown;
  rating_options_json: unknown;
  sections_json: unknown;
  sections_count?: number;
  items_count?: number;
  source_json?: unknown;
};

export type InspectionStatus = "draft" | "submitted" | "locked";
export type PdfStatus =
  | "not_requested"
  | "queued"
  | "generating"
  | "ready"
  | "failed";

export type InspectionRecord = RecordModel & {
  local_id: string;
  user: string;
  device_id: string;
  idempotency_key: string;
  vessel: string;
  template_id: string;
  template_version: number;
  template_checksum: string;
  inspector_name: string;
  inspector_employee_no?: string;
  place?: string;
  status: InspectionStatus;
  pdf_status: PdfStatus;
  started_at?: string;
  submitted_at?: string;
  synced_at?: string;
  locked_at?: string;
  summary_json?: unknown;
  raw_payload_json?: unknown;
};

export type InspectionPhotoRecord = RecordModel & {
  inspection: string;
  local_photo_id: string;
  photo_idempotency_key: string;
  item_template_id: string;
  section_code?: string;
  photo_type: "before" | "after";
  file: string;
  captured_at: string;
  uploaded_at: string;
  latitude?: number;
  longitude?: number;
  checksum: string;
  metadata_json?: unknown;
};

export type PdfReportRecord = RecordModel & {
  inspection: string;
  status: Exclude<PdfStatus, "not_requested">;
  file?: string;
  generated_at?: string;
  error_message?: string;
  metadata_json?: unknown;
};

export type SyncEventRecord = RecordModel & {
  user?: string;
  device_id?: string;
  request_id?: string;
  event_type: string;
  status: "success" | "failed";
  retryable?: boolean;
  payload_json?: unknown;
  error_json?: unknown;
  occurred_at: string;
};
