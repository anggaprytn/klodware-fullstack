import type PocketBase from "pocketbase";
import { getServerEnv } from "./env";
import type { VesselRecord } from "./types";

export const VESSEL_IMAGE_FIELD = "image";

export const VESSEL_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_VESSEL_IMAGE_BYTES = 5 * 1024 * 1024;

export function vesselImageFilename(vessel: Pick<VesselRecord, "image">) {
  if (Array.isArray(vessel.image)) {
    return vessel.image[0] || null;
  }

  return vessel.image || null;
}

export function vesselImagePath(vessel: Pick<VesselRecord, "id" | "image" | "updated">) {
  const filename = vesselImageFilename(vessel);
  if (!filename) return null;

  const params = new URLSearchParams();
  params.set("v", vessel.updated ?? filename);

  const query = params.toString();
  return `/api/mobile/vessels/${encodeURIComponent(vessel.id)}/image${
    query ? `?${query}` : ""
  }`;
}

export function vesselImageUrl(vessel: Pick<VesselRecord, "id" | "image" | "updated">) {
  const path = vesselImagePath(vessel);
  if (!path) return null;

  return new URL(path, getServerEnv().APP_BASE_URL).toString();
}

export function validateVesselImageFile(file: File) {
  if (file.size === 0) return;

  if (!VESSEL_IMAGE_MIME_TYPES.includes(file.type as (typeof VESSEL_IMAGE_MIME_TYPES)[number])) {
    throw new Error("Vessel image must be a JPEG, PNG, or WebP file.");
  }

  if (file.size > MAX_VESSEL_IMAGE_BYTES) {
    throw new Error("Vessel image must be 5 MB or smaller.");
  }
}

export async function pocketBaseFileUrl(args: {
  pb: PocketBase;
  record: VesselRecord;
  filename: string;
}) {
  let token = "";
  try {
    token = await args.pb.files.getToken();
  } catch {
    token = "";
  }

  return args.pb.files.getURL(
    args.record,
    args.filename,
    token ? { token } : undefined,
  );
}
