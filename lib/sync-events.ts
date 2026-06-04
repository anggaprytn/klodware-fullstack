import { getSuperuserPocketBase } from "./pocketbase";

type SyncEventArgs = {
  userId?: string;
  deviceId?: string;
  requestId?: string;
  eventType: string;
  status: "success" | "failed";
  retryable?: boolean;
  payload?: unknown;
  error?: unknown;
};

const sensitiveKeyPattern = /password|token|credential|secret/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitize(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = sanitize(entry, depth + 1);
      }
    }
    return output;
  }

  return value;
}

function trimJson(value: unknown) {
  const sanitized = sanitize(value);
  const json = JSON.stringify(sanitized);
  if (json.length <= 4000) {
    return sanitized;
  }

  return {
    truncated: true,
    preview: json.slice(0, 4000),
  };
}

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id") ?? undefined;
}

export function deviceIdFrom(request: Request, fallback?: string) {
  return request.headers.get("x-device-id") ?? fallback ?? undefined;
}

export async function logSyncEvent(args: SyncEventArgs) {
  try {
    const pb = await getSuperuserPocketBase();
    await pb.collection("sync_events").create({
      user: args.userId || undefined,
      device_id: args.deviceId || "",
      request_id: args.requestId || "",
      event_type: args.eventType,
      status: args.status,
      retryable: args.retryable ?? false,
      payload_json: args.payload ? trimJson(args.payload) : null,
      error_json: args.error ? trimJson(args.error) : null,
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Sync logging is diagnostic and must not break the API operation.
  }
}
