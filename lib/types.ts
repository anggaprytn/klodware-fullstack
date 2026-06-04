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
  code: string;
  imo_no?: string;
  status: "active" | "inactive";
};

export type ChecklistTemplateRecord = RecordModel & {
  template_id: string;
  version: number;
  name: string;
  checksum: string;
  is_active: boolean;
  rating_options_json: unknown;
  sections_json: unknown;
};
