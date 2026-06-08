"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDateTime,
  hasPocketBaseFile,
  humanizeStatus,
} from "@/lib/admin-format";
import type { PdfStatus, VesselRecord } from "@/lib/types";
import {
  EmptyState,
  PageSection,
  PdfStatusBadge,
  StatusBadge,
  SummaryCard,
} from "../../components/AdminUi";
import { ActionForm, type AdminAction } from "../../components/ActionForm";

type VesselAction = AdminAction;
type DrawerMode = "create" | "edit" | "view";

export type VesselOperations = {
  inspectionsCount: number;
  lastInspectionDate: string;
  lastReportStatus: PdfStatus | "";
};

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Saving..." : label}
    </button>
  );
}

function VesselImage({
  alt,
  className,
  src,
}: {
  alt: string;
  className: string;
  src: string;
}) {
  if (!src) {
    return <div className={`${className} placeholder`}>No image</div>;
  }

  return (
    // The image is served by an internal proxy route.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />
  );
}

function VesselThumbnail({
  imagePath,
  vessel,
}: {
  imagePath: string;
  vessel: VesselRecord;
}) {
  if (!imagePath) {
    return <div className="thumbnail-placeholder">No image</div>;
  }

  return (
    // The image is served by an internal proxy route.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={`${vessel.name} vessel`} className="thumbnail" src={imagePath} />
  );
}

function ImageUploadPreview({
  currentImagePath,
  vessel,
}: {
  currentImagePath: string;
  vessel?: VesselRecord;
}) {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="image-upload-preview">
      {preview || currentImagePath ? (
        // The selected file preview is a local object URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={vessel ? `${vessel.name} vessel preview` : "Vessel preview"}
          src={preview || currentImagePath}
        />
      ) : (
        <div className="thumbnail-placeholder">No image</div>
      )}
      <label className="field">
        <span>Image</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          name="image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview((oldPreview) => {
              if (oldPreview) URL.revokeObjectURL(oldPreview);
              return file ? URL.createObjectURL(file) : "";
            });
          }}
          type="file"
        />
        <span className="muted">
          {currentImagePath ? "Image available" : "No image uploaded"}
        </span>
      </label>
    </div>
  );
}

function VesselFields({
  currentImagePath,
  mode,
  vessel,
}: {
  currentImagePath: string;
  mode: DrawerMode;
  vessel?: VesselRecord;
}) {
  return (
    <>
      {vessel ? <input name="id" type="hidden" value={vessel.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={vessel?.name ?? ""} required />
      </label>
      <label className="field">
        <span>IMO</span>
        <input
          name="imo"
          defaultValue={vessel?.imo ?? vessel?.imo_no ?? ""}
          required
        />
      </label>
      <label className="field">
        <span>MMSI</span>
        <input name="mmsi" defaultValue={vessel?.mmsi ?? ""} required />
      </label>
      <label className="field">
        <span>Call Sign</span>
        <input name="call_sign" defaultValue={vessel?.call_sign ?? ""} />
      </label>
      <label className="field">
        <span>Flag</span>
        <input name="flag" defaultValue={vessel?.flag ?? ""} />
      </label>
      <label className="field">
        <span>Year Built</span>
        <input
          name="year_built"
          defaultValue={vessel?.year_built ?? ""}
          min="1800"
          type="number"
        />
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" defaultValue={vessel?.status ?? "active"} required>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      {mode !== "view" ? (
        <ImageUploadPreview currentImagePath={currentImagePath} vessel={vessel} />
      ) : null}
    </>
  );
}

function VesselDrawer({
  action,
  imagePath,
  mode,
  onClose,
  operation,
  vessel,
}: {
  action: VesselAction;
  imagePath: string;
  mode: DrawerMode;
  onClose: () => void;
  operation?: VesselOperations;
  vessel?: VesselRecord;
}) {
  const title =
    mode === "create" ? "Create Vessel" : mode === "edit" ? "Edit Vessel" : "Vessel Detail";

  return (
    <>
      <button
        aria-label="Close drawer"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <h2>{title}</h2>
            <p className="muted">
              {mode === "view"
                ? "Vessel metadata and inspection activity."
                : "Changes apply to the mobile vessel catalog."}
            </p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="drawer-body">
          {mode === "view" && vessel ? (
            <>
              <VesselImage
                alt={`${vessel.name} vessel`}
                className="drawer-image"
                src={imagePath}
              />
              <dl className="detail-list">
                <div>
                  <dt>Name</dt>
                  <dd>{vessel.name}</dd>
                </div>
                <div>
                  <dt>IMO</dt>
                  <dd>{vessel.imo ?? vessel.imo_no ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>MMSI</dt>
                  <dd>{vessel.mmsi ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Call Sign</dt>
                  <dd>{vessel.call_sign ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Flag</dt>
                  <dd>{vessel.flag ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Year Built</dt>
                  <dd>{vessel.year_built ?? "Not available"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={vessel.status} />
                  </dd>
                </div>
                <div>
                  <dt>Image</dt>
                  <dd>{hasPocketBaseFile(vessel.image) ? "Image available" : "No image uploaded"}</dd>
                </div>
                <div>
                  <dt>Related Inspections</dt>
                  <dd>{operation?.inspectionsCount ?? 0}</dd>
                </div>
                <div>
                  <dt>Last Inspection</dt>
                  <dd>{formatDateTime(operation?.lastInspectionDate)}</dd>
                </div>
                <div>
                  <dt>Last Report Status</dt>
                  <dd>
                    {operation?.lastReportStatus ? (
                      <PdfStatusBadge status={operation.lastReportStatus} />
                    ) : (
                      "Not available"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(vessel.updated)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <ActionForm
              action={action}
              className="form"
              encType="multipart/form-data"
              errorMessage="Unable to save vessel."
              onSuccess={onClose}
              successMessage={mode === "create" ? "Vessel created." : "Vessel updated."}
            >
              {(pending) => (
                <>
                  <VesselFields
                    currentImagePath={imagePath}
                    mode={mode}
                    vessel={vessel}
                  />
                  <div className="row-actions">
                    <button className="button secondary" onClick={onClose} type="button">
                      Cancel
                    </button>
                    <SubmitButton
                      label={mode === "create" ? "Create Vessel" : "Save Changes"}
                      pending={pending}
                    />
                  </div>
                </>
              )}
            </ActionForm>
          )}
        </div>
      </aside>
    </>
  );
}

export function AdminVesselsClient({
  activateAction,
  createAction,
  deactivateAction,
  imagePaths,
  operations,
  updateAction,
  vessels,
}: {
  activateAction: VesselAction;
  createAction: VesselAction;
  deactivateAction: VesselAction;
  imagePaths: Record<string, string>;
  operations: Record<string, VesselOperations>;
  updateAction: VesselAction;
  vessels: VesselRecord[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [drawer, setDrawer] = useState<{
    mode: DrawerMode;
    vessel?: VesselRecord;
  } | null>(null);

  const filteredVessels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return vessels
      .filter((vessel) => {
        const matchesStatus = status ? vessel.status === status : true;
        const searchValues = [
          vessel.name,
          vessel.imo,
          vessel.imo_no,
          vessel.mmsi,
          vessel.call_sign,
          vessel.flag,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesStatus && searchValues.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sort === "name") return left.name.localeCompare(right.name);
        if (sort === "status") return left.status.localeCompare(right.status);
        return Date.parse(right.updated ?? right.created ?? "") - Date.parse(left.updated ?? left.created ?? "");
      });
  }, [query, sort, status, vessels]);

  const activeCount = vessels.filter((vessel) => vessel.status === "active").length;
  const inactiveCount = vessels.filter((vessel) => vessel.status === "inactive").length;
  const missingImageCount = vessels.filter(
    (vessel) => !hasPocketBaseFile(vessel.image),
  ).length;

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Total Vessels" value={vessels.length} />
        <SummaryCard label="Active" tone="success" value={activeCount} />
        <SummaryCard label="Inactive" tone={inactiveCount > 0 ? "danger" : "success"} value={inactiveCount} />
        <SummaryCard label="Missing Images" tone={missingImageCount > 0 ? "warning" : "success"} value={missingImageCount} />
      </section>

      <PageSection
        actions={
          <button className="button" onClick={() => setDrawer({ mode: "create" })} type="button">
            Create Vessel
          </button>
        }
        title="Vessel Catalog"
      >
        <div className="toolbar">
          <label className="field">
            <span>Search Vessels</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, IMO, MMSI, call sign, flag"
              value={query}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select onChange={(event) => setSort(event.target.value)} value={sort}>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>

        {filteredVessels.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Vessel Name</th>
                  <th>IMO</th>
                  <th>MMSI</th>
                  <th>Call Sign</th>
                  <th>Flag</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVessels.map((vessel) => {
                  const imagePath = imagePaths[vessel.id] ?? "";

                  return (
                    <tr key={vessel.id}>
                      <td>
                        <VesselThumbnail imagePath={imagePath} vessel={vessel} />
                      </td>
                      <td>
                        <div className="record-title">
                          <strong>{vessel.name}</strong>
                          <span className="muted">
                            {hasPocketBaseFile(vessel.image) ? "Image available" : "No image uploaded"}
                          </span>
                        </div>
                      </td>
                      <td>{vessel.imo ?? vessel.imo_no ?? "Not available"}</td>
                      <td>{vessel.mmsi ?? "Not available"}</td>
                      <td>{vessel.call_sign ?? "Not available"}</td>
                      <td>{vessel.flag ?? "Not available"}</td>
                      <td>{vessel.year_built ?? "Not available"}</td>
                      <td>
                        <StatusBadge status={vessel.status} />
                      </td>
                      <td>{formatDateTime(vessel.updated)}</td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <button
                            className="button secondary"
                            onClick={() => setDrawer({ mode: "view", vessel })}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => setDrawer({ mode: "edit", vessel })}
                            type="button"
                          >
                            Edit
                          </button>
                          {vessel.status === "active" ? (
                            <ActionForm
                              action={deactivateAction}
                              confirmMessage={`Deactivate ${vessel.name}?`}
                              errorMessage="Unable to deactivate vessel."
                              successMessage="Vessel deactivated."
                            >
                              {(pending) => (
                                <>
                                  <input name="id" type="hidden" value={vessel.id} />
                                  <button className="button danger" disabled={pending} type="submit">
                                    {pending ? "Deactivating..." : "Deactivate"}
                                  </button>
                                </>
                              )}
                            </ActionForm>
                          ) : (
                            <ActionForm
                              action={activateAction}
                              errorMessage="Unable to activate vessel."
                              successMessage="Vessel activated."
                            >
                              {(pending) => (
                                <>
                                  <input name="id" type="hidden" value={vessel.id} />
                                  <button className="button secondary" disabled={pending} type="submit">
                                    {pending ? "Activating..." : "Activate"}
                                  </button>
                                </>
                              )}
                            </ActionForm>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={
              vessels.length === 0 ? (
                <button className="button" onClick={() => setDrawer({ mode: "create" })} type="button">
                  Create Vessel
                </button>
              ) : null
            }
            title={vessels.length === 0 ? "No vessels yet." : "No vessels match the current filters."}
          />
        )}
      </PageSection>

      {drawer ? (
        <VesselDrawer
          action={drawer.mode === "create" ? createAction : updateAction}
          imagePath={drawer.vessel ? imagePaths[drawer.vessel.id] ?? "" : ""}
          mode={drawer.mode}
          onClose={() => setDrawer(null)}
          operation={drawer.vessel ? operations[drawer.vessel.id] : undefined}
          vessel={drawer.vessel}
        />
      ) : null}
    </div>
  );
}
