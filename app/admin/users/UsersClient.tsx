"use client";

import { useMemo, useState } from "react";
import type { UserRecord, VesselRecord } from "@/lib/types";
import {
  EmptyState,
  PageSection,
  StatusBadge,
  SummaryCard,
} from "../components/AdminUi";
import { ActionForm, type AdminAction } from "../components/ActionForm";

type UserAction = AdminAction;
type DrawerMode = "create" | "edit";

function assignedVesselIds(user?: UserRecord) {
  const vessels = user?.inspectable_vessels;
  if (!vessels) return new Set<string>();
  return new Set(Array.isArray(vessels) ? vessels : [vessels]);
}

function VesselAssignmentFields({
  user,
  vessels,
}: {
  user?: UserRecord;
  vessels: VesselRecord[];
}) {
  const assigned = assignedVesselIds(user);

  return (
    <fieldset className="field assignment-field">
      <legend>Inspectable vessels</legend>
      <div className="checkbox-list">
        {vessels.length > 0 ? (
          vessels.map((vessel) => (
            <label className="checkbox-field" key={vessel.id}>
              <input
                defaultChecked={assigned.has(vessel.id)}
                name="inspectable_vessels"
                type="checkbox"
                value={vessel.id}
              />
              <span>{vessel.name}</span>
            </label>
          ))
        ) : (
          <p className="muted">No active vessels available.</p>
        )}
      </div>
    </fieldset>
  );
}

function UserFields({
  currentUserId,
  mode,
  user,
  vessels,
}: {
  currentUserId: string;
  mode: DrawerMode;
  user?: UserRecord;
  vessels: VesselRecord[];
}) {
  return (
    <>
      {user ? <input name="id" type="hidden" value={user.id} /> : null}
      <label className="field">
        <span>Username</span>
        <input name="username" defaultValue={user?.username ?? ""} required />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" defaultValue={user?.email ?? ""} type="email" />
      </label>
      <label className="field">
        <span>Full name</span>
        <input name="full_name" defaultValue={user?.full_name ?? ""} required />
      </label>
      <label className="field">
        <span>Employee no</span>
        <input name="employee_no" defaultValue={user?.employee_no ?? ""} />
      </label>
      <label className="field">
        <span>Role</span>
        <select name="role" defaultValue={user?.role ?? "inspector"}>
          <option value="inspector">Inspector</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select
          name="status"
          defaultValue={user?.status ?? "active"}
          disabled={user?.id === currentUserId}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <VesselAssignmentFields user={user} vessels={vessels} />
      {mode === "create" ? (
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" required />
        </label>
      ) : null}
    </>
  );
}

function UserDrawer({
  action,
  currentUserId,
  mode,
  onClose,
  user,
  vessels,
}: {
  action: UserAction;
  currentUserId: string;
  mode: DrawerMode;
  onClose: () => void;
  user?: UserRecord;
  vessels: VesselRecord[];
}) {
  return (
    <>
      <button
        aria-label="Close user drawer"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <h2>{mode === "create" ? "Create User" : "Edit User"}</h2>
            <p className="muted">
              Manage web admin access and mobile inspector accounts.
            </p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="drawer-body">
          <ActionForm
            action={action}
            className="form form-grid"
            errorMessage="Unable to save user."
            onSuccess={onClose}
            successMessage={mode === "create" ? "User created." : "User updated."}
          >
            {(pending) => (
              <>
                <UserFields
                  currentUserId={currentUserId}
                  mode={mode}
                  user={user}
                  vessels={vessels}
                />
                <div className="row-actions">
                  <button className="button secondary" onClick={onClose} type="button">
                    Cancel
                  </button>
                  <button className="button" disabled={pending} type="submit">
                    {pending ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </ActionForm>
        </div>
      </aside>
    </>
  );
}

function PasswordResetForm({
  resetPasswordAction,
  user,
}: {
  resetPasswordAction: UserAction;
  user: UserRecord;
}) {
  return (
    <ActionForm
      action={resetPasswordAction}
      className="inline-form"
      confirmMessage={`Reset password for ${user.username}?`}
      errorMessage="Unable to reset password."
      successMessage="Password reset."
    >
      {(pending) => (
        <>
          <input name="id" type="hidden" value={user.id} />
          <input
            aria-label={`New password for ${user.username}`}
            name="password"
            placeholder="New manual password"
            type="password"
            required
          />
          <button className="button secondary" disabled={pending} type="submit">
            {pending ? "Resetting..." : "Reset Password"}
          </button>
        </>
      )}
    </ActionForm>
  );
}

export function AdminUsersClient({
  createAction,
  currentUserId,
  deactivateAction,
  resetPasswordAction,
  updateAction,
  users,
  vessels,
}: {
  createAction: UserAction;
  currentUserId: string;
  deactivateAction: UserAction;
  resetPasswordAction: UserAction;
  updateAction: UserAction;
  users: UserRecord[];
  vessels: VesselRecord[];
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [drawer, setDrawer] = useState<{ mode: DrawerMode; user?: UserRecord } | null>(
    null,
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((user) => {
      const searchText = [
        user.username,
        user.full_name,
        user.employee_no,
        user.email,
        user.role,
        user.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!normalized || searchText.includes(normalized)) &&
        (!role || user.role === role) &&
        (!status || user.status === status)
      );
    });
  }, [query, role, status, users]);

  const activeCount = users.filter((user) => user.status === "active").length;
  const inactiveCount = users.filter((user) => user.status === "inactive").length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const inspectorCount = users.filter((user) => user.role === "inspector").length;

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Users" value={users.length} />
        <SummaryCard label="Active" tone="success" value={activeCount} />
        <SummaryCard label="Inactive" tone={inactiveCount > 0 ? "warning" : "success"} value={inactiveCount} />
        <SummaryCard label="Admins" value={adminCount} />
        <SummaryCard label="Inspectors" value={inspectorCount} />
      </section>

      <PageSection
        actions={
          <button className="button" onClick={() => setDrawer({ mode: "create" })} type="button">
            Create User
          </button>
        }
        title="User Accounts"
      >
        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Username, name, employee no, email"
              value={query}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select onChange={(event) => setRole(event.target.value)} value={role}>
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="inspector">Inspector</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Employee No</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Inspectable Vessels</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const assigned = assignedVesselIds(user).size;
                  const isCurrent = user.id === currentUserId;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="record-title">
                          <strong>{user.full_name || user.username}</strong>
                          <span className="muted">{user.username}</span>
                        </div>
                      </td>
                      <td>{user.employee_no || "Not available"}</td>
                      <td>{user.email || "Not available"}</td>
                      <td>
                        <StatusBadge status={user.role} />
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td>{user.role === "inspector" ? assigned : "Not required"}</td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <button
                            className="button secondary"
                            onClick={() => setDrawer({ mode: "edit", user })}
                            type="button"
                          >
                            Edit
                          </button>
                          <PasswordResetForm resetPasswordAction={resetPasswordAction} user={user} />
                          {!isCurrent && user.status === "active" ? (
                            <ActionForm
                              action={deactivateAction}
                              confirmMessage={`Deactivate ${user.username}?`}
                              errorMessage="Unable to deactivate user."
                              successMessage="User deactivated."
                            >
                              {(pending) => (
                                <>
                                  <input name="id" type="hidden" value={user.id} />
                                  <button className="button danger" disabled={pending} type="submit">
                                    {pending ? "Deactivating..." : "Deactivate"}
                                  </button>
                                </>
                              )}
                            </ActionForm>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={users.length === 0 ? "No users found." : "No users match the current filters."} />
        )}
      </PageSection>

      {drawer ? (
        <UserDrawer
          action={drawer.mode === "create" ? createAction : updateAction}
          currentUserId={currentUserId}
          mode={drawer.mode}
          onClose={() => setDrawer(null)}
          user={drawer.user}
          vessels={vessels}
        />
      ) : null}
    </div>
  );
}
