import { revalidatePath } from "next/cache";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { requireAdminSession } from "@/lib/auth";
import type { UserRecord, UserRole, UserStatus, VesselRecord } from "@/lib/types";
import { AdminUsersClient } from "./UsersClient";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function roleValue(formData: FormData): UserRole {
  const role = textValue(formData, "role");
  return role === "admin" || role === "viewer" ? role : "inspector";
}

function statusValue(formData: FormData): UserStatus {
  return textValue(formData, "status") === "inactive" ? "inactive" : "active";
}

function vesselIdsValue(formData: FormData) {
  return formData
    .getAll("inspectable_vessels")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function inspectableVesselsValue(formData: FormData) {
  return roleValue(formData) === "inspector" ? vesselIdsValue(formData) : [];
}

async function createUserAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const password = textValue(formData, "password");

  if (!password) {
    throw new Error("Password is required.");
  }

  await pb.collection("users").create({
    username: textValue(formData, "username"),
    email: textValue(formData, "email"),
    emailVisibility: false,
    password,
    passwordConfirm: password,
    full_name: textValue(formData, "full_name"),
    employee_no: textValue(formData, "employee_no"),
    role: roleValue(formData),
    status: statusValue(formData),
    inspectable_vessels: inspectableVesselsValue(formData),
  });

  revalidatePath("/admin/users");
}

async function updateUserAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const userId = textValue(formData, "id");
  const status = statusValue(formData);

  if (userId === session.user.id && status === "inactive") {
    throw new Error("Current admin user cannot be deactivated.");
  }

  await pb.collection("users").update(userId, {
    username: textValue(formData, "username"),
    email: textValue(formData, "email"),
    full_name: textValue(formData, "full_name"),
    employee_no: textValue(formData, "employee_no"),
    role: roleValue(formData),
    status,
    inspectable_vessels: inspectableVesselsValue(formData),
  });

  revalidatePath("/admin/users");
}

async function resetPasswordAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const password = textValue(formData, "password");

  if (!password) {
    throw new Error("Password is required.");
  }

  await pb.collection("users").update(textValue(formData, "id"), {
    password,
    passwordConfirm: password,
  });

  revalidatePath("/admin/users");
}

async function deactivateUserAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const id = textValue(formData, "id");

  if (id === session.user.id) {
    throw new Error("Current admin user cannot be deactivated.");
  }

  const pb = await getSuperuserPocketBase();
  await pb.collection("users").update(id, { status: "inactive" });
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const session = await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const [users, vessels] = await Promise.all([
    pb.collection("users").getFullList<UserRecord>({
      sort: "username",
    }),
    pb.collection("vessels").getFullList<VesselRecord>({
      filter: pb.filter("status = {:status}", { status: "active" }),
      sort: "name",
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Manage admin and inspector accounts for mobile and web access."
      />
      <AdminUsersClient
        createAction={createUserAction}
        currentUserId={session.user.id}
        deactivateAction={deactivateUserAction}
        resetPasswordAction={resetPasswordAction}
        updateAction={updateUserAction}
        users={users}
        vessels={vessels}
      />
    </>
  );
}
