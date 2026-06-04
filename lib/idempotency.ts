import { createHash } from "node:crypto";

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function inspectionIdempotencyKey(args: {
  userId: string;
  deviceId: string;
  localId: string;
}) {
  return sha256(`${args.userId}:${args.deviceId}:${args.localId}`);
}

export function photoIdempotencyKey(args: {
  inspectionId: string;
  localPhotoId: string;
}) {
  return sha256(`${args.inspectionId}:${args.localPhotoId}`);
}
