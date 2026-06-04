import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type PocketBase from "pocketbase";
import {
  createPocketBaseClient,
  getSuperuserPocketBase,
  isPocketBaseResponseError,
} from "./pocketbase";
import type { MobileUserProfile, UserRecord } from "./types";

export const ADMIN_COOKIE = "klodware_admin_token";

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CREDENTIALS"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "USER_INACTIVE"
      | "SESSION_EXPIRED",
    message: string,
  ) {
    super(message);
  }
}

export function toMobileUserProfile(user: UserRecord): MobileUserProfile {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    employee_no: user.employee_no ?? "",
    role: user.role,
    status: user.status,
  };
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function getJwtExpiresAt(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { exp?: number };
    return parsed.exp ? new Date(parsed.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

export async function authenticateMobileLogin(
  username: string,
  password: string,
) {
  const pb = createPocketBaseClient();

  try {
    const auth = await pb
      .collection("users")
      .authWithPassword<UserRecord>(username, password);

    if (auth.record.status !== "active") {
      throw new AuthError("USER_INACTIVE", "User account is inactive.");
    }

    if (!["admin", "inspector"].includes(auth.record.role)) {
      throw new AuthError("FORBIDDEN", "User is not allowed to use mobile.");
    }

    return {
      token: auth.token,
      expiresAt: getJwtExpiresAt(auth.token),
      user: auth.record,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    if (isPocketBaseResponseError(error)) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Username or password is incorrect.",
      );
    }

    throw error;
  }
}

export async function requireMobileUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new AuthError("UNAUTHORIZED", "Missing bearer token.");
  }

  const pb = createPocketBaseClient();
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection("users").authRefresh<UserRecord>();

    if (auth.record.status !== "active") {
      throw new AuthError("USER_INACTIVE", "User account is inactive.");
    }

    if (!["admin", "inspector"].includes(auth.record.role)) {
      throw new AuthError("FORBIDDEN", "User is not allowed to use mobile.");
    }

    return {
      pb,
      token: auth.token,
      user: auth.record,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError("SESSION_EXPIRED", "Session expired. Please login again.");
  }
}

export async function authenticateAdminLogin(username: string, password: string) {
  const result = await authenticateMobileLogin(username, password);

  if (result.user.role !== "admin") {
    throw new AuthError("FORBIDDEN", "Admin access is required.");
  }

  return result;
}

export async function refreshAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const pb = createPocketBaseClient();
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection("users").authRefresh<UserRecord>();

    if (auth.record.status !== "active" || auth.record.role !== "admin") {
      return null;
    }

    return {
      pb,
      token: auth.token,
      user: auth.record,
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  const session = await refreshAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export async function getAdminStats(_pb: PocketBase) {
  const pb = await getSuperuserPocketBase();
  const [vessels, templates, inspections, reports, users] = await Promise.all([
    pb.collection("vessels").getList(1, 1),
    pb.collection("checklist_templates").getList(1, 1),
    pb.collection("inspections").getList(1, 1),
    pb.collection("pdf_reports").getList(1, 1),
    pb.collection("users").getList(1, 1),
  ]);

  return {
    vessels: vessels.totalItems,
    templates: templates.totalItems,
    inspections: inspections.totalItems,
    reports: reports.totalItems,
    users: users.totalItems,
  };
}
