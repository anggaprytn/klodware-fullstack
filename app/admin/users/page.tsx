import { revalidatePath } from "next/cache";
import { AdminShell } from "../AdminShell";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { requireAdminSession } from "@/lib/auth";
import type { UserRecord, UserRole, UserStatus } from "@/lib/types";

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
  const users = await pb.collection("users").getFullList<UserRecord>({
    sort: "username",
  });

  return (
    <AdminShell
      title="Users"
      description="Manage admin and inspector accounts for mobile and web access."
    >
      <div className="admin-grid">
        <section className="panel">
          <h2>Create User</h2>
          <form className="form form-grid" action={createUserAction}>
            <label className="field">
              <span>Username</span>
              <input name="username" required />
            </label>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" />
            </label>
            <label className="field">
              <span>Full name</span>
              <input name="full_name" required />
            </label>
            <label className="field">
              <span>Employee no</span>
              <input name="employee_no" />
            </label>
            <label className="field">
              <span>Role</span>
              <select name="role" defaultValue="inspector">
                <option value="inspector">Inspector</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="password" required />
            </label>
            <button className="button" type="submit">
              Create user
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>User Accounts</h2>
          <div className="crud-list">
            {users.map((user) => (
              <article className="crud-item" key={user.id}>
                <form className="form form-grid" action={updateUserAction}>
                  <input name="id" type="hidden" value={user.id} />
                  <label className="field">
                    <span>Username</span>
                    <input name="username" defaultValue={user.username} required />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input name="email" defaultValue={user.email} type="email" />
                  </label>
                  <label className="field">
                    <span>Full name</span>
                    <input name="full_name" defaultValue={user.full_name} required />
                  </label>
                  <label className="field">
                    <span>Employee no</span>
                    <input name="employee_no" defaultValue={user.employee_no ?? ""} />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select name="role" defaultValue={user.role}>
                      <option value="inspector">Inspector</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select
                      name="status"
                      defaultValue={user.status}
                      disabled={user.id === session.user.id}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <div className="row-actions">
                    <span className={`status-pill ${user.status}`}>
                      {user.role} / {user.status}
                    </span>
                    <button className="button" type="submit">
                      Save
                    </button>
                  </div>
                </form>
                <form className="inline-form" action={resetPasswordAction}>
                  <input name="id" type="hidden" value={user.id} />
                  <input
                    aria-label={`New password for ${user.username}`}
                    name="password"
                    placeholder="New manual password"
                    type="password"
                    required
                  />
                  <button className="button secondary" type="submit">
                    Reset password
                  </button>
                </form>
                {user.id !== session.user.id && user.status === "active" ? (
                  <form action={deactivateUserAction}>
                    <input name="id" type="hidden" value={user.id} />
                    <button className="button danger" type="submit">
                      Deactivate
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
