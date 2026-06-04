import { NextResponse } from "next/server";

export type MobileErrorCode =
  | "BAD_REQUEST"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "USER_INACTIVE"
  | "SESSION_EXPIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type ErrorPayload = {
  code: MobileErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
};

export function mobileSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      server_time: new Date().toISOString(),
      data,
    },
    init,
  );
}

export function mobileError(
  status: number,
  error: ErrorPayload,
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      success: false,
      server_time: new Date().toISOString(),
      error,
    },
    { ...init, status },
  );
}
