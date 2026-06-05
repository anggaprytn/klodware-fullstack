"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { formatDateTime, shortenId } from "@/lib/admin-format";
import type { ChecklistTemplateRecord } from "@/lib/types";
import {
  Badge,
  EmptyState,
  PageSection,
  ShortCode,
  StatusBadge,
  SummaryCard,
} from "../components/AdminUi";
import { CopyButton } from "../components/CopyButton";

type TemplateAction = () => Promise<void>;
type DetailTab = "overview" | "sections" | "rules" | "raw";

type SeedSource = {
  id: string;
  name: string;
  version: number;
  sectionsCount: number;
  itemsCount: number;
  extractionStatus: string;
};

type RatingOption = {
  value?: unknown;
  label?: unknown;
  requires_photo?: unknown;
  requires_remarks?: unknown;
};

type RawTemplateSection = {
  code?: unknown;
  name?: unknown;
  title?: unknown;
  items?: unknown;
};

type RawTemplateItem = {
  id?: unknown;
  label?: unknown;
};

function ImportButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Importing..." : "Import Seed Template"}
    </button>
  );
}

function isActiveTemplate(template: ChecklistTemplateRecord) {
  return template.active === true || template.is_active === true;
}

function templateValidity(template: ChecklistTemplateRecord) {
  const invalid = (template.sections_count ?? 0) < 29 || (template.items_count ?? 0) < 150;
  return invalid ? "invalid" : "valid";
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function ratingOptions(template: ChecklistTemplateRecord) {
  return arrayValue(template.rating_options_json) as RatingOption[];
}

function templateSections(template: ChecklistTemplateRecord) {
  return arrayValue(template.sections_json).map((source, index) => {
    const section = source as RawTemplateSection;
    const items = arrayValue(section.items) as RawTemplateItem[];

    return {
      code: textValue(section.code, String(index + 1)),
      name: textValue(section.name, textValue(section.title, `Section ${index + 1}`)),
      items,
    };
  });
}

function valuesRequiring(
  options: RatingOption[],
  key: "requires_photo" | "requires_remarks",
) {
  return options
    .filter((option) => option[key] === true)
    .map((option) => textValue(option.label, textValue(option.value)))
    .filter(Boolean);
}

function rulesSummary(template: ChecklistTemplateRecord) {
  const options = ratingOptions(template);
  const photoRatings = valuesRequiring(options, "requires_photo");
  const remarksRatings = valuesRequiring(options, "requires_remarks");

  return {
    photo:
      photoRatings.length > 0
        ? `Required for ${photoRatings.join(", ")}`
        : "Required for findings by submit validation",
    remarks:
      remarksRatings.length > 0
        ? `Required for ${remarksRatings.join(", ")}`
        : "Required for findings by submit validation",
  };
}

function Drawer({
  onClose,
  template,
}: {
  onClose: () => void;
  template: ChecklistTemplateRecord;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const sections = templateSections(template);
  const options = ratingOptions(template);
  const rules = rulesSummary(template);
  const active = isActiveTemplate(template);
  const validity = templateValidity(template);

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
            <h2>{template.name}</h2>
            <p className="muted">
              {template.template_id} v{template.version}
            </p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="drawer-body">
          <div className="tabs">
            {[
              ["overview", "Overview"],
              ["sections", "Sections"],
              ["rules", "Rules"],
              ["raw", "Raw JSON"],
            ].map(([value, label]) => (
              <button
                className={`tab-button ${tab === value ? "active" : ""}`}
                key={value}
                onClick={() => setTab(value as DetailTab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <dl className="detail-list">
              <div>
                <dt>Template Name</dt>
                <dd>{template.name}</dd>
              </div>
              <div>
                <dt>Template ID</dt>
                <dd>{template.template_id}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{template.version}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={active ? "active" : "inactive"} />
                </dd>
              </div>
              <div>
                <dt>Validity</dt>
                <dd>
                  <StatusBadge status={validity} />
                </dd>
              </div>
              <div>
                <dt>Sections / Items</dt>
                <dd>
                  {template.sections_count ?? 0} / {template.items_count ?? 0}
                </dd>
              </div>
              <div>
                <dt>Photo Policy</dt>
                <dd>{rules.photo}</dd>
              </div>
              <div>
                <dt>Remarks Policy</dt>
                <dd>{rules.remarks}</dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd className="code-row">
                  <ShortCode edge={8} value={template.checksum} />
                  <CopyButton value={template.checksum} />
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDateTime(template.updated)}</dd>
              </div>
            </dl>
          ) : null}

          {tab === "sections" ? (
            sections.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Items</th>
                      <th>Photo Rules</th>
                      <th>Remarks Rules</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => (
                      <tr key={section.code}>
                        <td>
                          <strong>{section.code}</strong> {section.name}
                        </td>
                        <td>{section.items.length}</td>
                        <td>{rules.photo}</td>
                        <td>{rules.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No sections found in this template." />
            )
          ) : null}

          {tab === "rules" ? (
            <div className="admin-grid">
              <dl className="detail-list">
                <div>
                  <dt>Rating Options</dt>
                  <dd>
                    {options
                      .map((option) => textValue(option.label, textValue(option.value)))
                      .filter(Boolean)
                      .join(", ") || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt>Ratings Require Photo</dt>
                  <dd>{rules.photo}</dd>
                </div>
                <div>
                  <dt>Ratings Require Remarks</dt>
                  <dd>{rules.remarks}</dd>
                </div>
                <div>
                  <dt>NA Behavior</dt>
                  <dd>Available as a rating option when present in template schema.</dd>
                </div>
                <div>
                  <dt>Drydock Logic</dt>
                  <dd>Score 4 is counted as drydock by inspection summary validation.</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {tab === "raw" ? (
            <div className="admin-grid">
              <div className="row-actions">
                <CopyButton
                  value={JSON.stringify(template.schema_json ?? template.source_json, null, 2)}
                />
              </div>
              <pre className="json-preview">
                {JSON.stringify(template.schema_json ?? template.source_json, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function AdminTemplatesClient({
  error,
  importAction,
  initialSelectedId,
  message,
  seedSource,
  templates,
}: {
  error: string;
  importAction: TemplateAction;
  initialSelectedId: string;
  message: string;
  seedSource: SeedSource;
  templates: ChecklistTemplateRecord[];
}) {
  const [selected, setSelected] = useState<ChecklistTemplateRecord | null>(
    templates.find((template) => template.id === initialSelectedId) ?? null,
  );
  const activeTemplates = templates.filter(isActiveTemplate);
  const invalidTemplates = templates.filter(
    (template) => templateValidity(template) === "invalid",
  );
  const rows = useMemo(
    () =>
      [...templates].sort((left, right) => {
        if (isActiveTemplate(left) !== isActiveTemplate(right)) {
          return isActiveTemplate(left) ? -1 : 1;
        }
        return right.version - left.version || left.name.localeCompare(right.name);
      }),
    [templates],
  );

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Templates" value={templates.length} />
        <SummaryCard label="Active" tone={activeTemplates.length > 0 ? "success" : "danger"} value={activeTemplates.length} />
        <SummaryCard label="Invalid" tone={invalidTemplates.length > 0 ? "danger" : "success"} value={invalidTemplates.length} />
        <SummaryCard label="Seed Items" value={seedSource.itemsCount} />
      </section>

      <section className="panel compact-card">
        <div className="section-heading">
          <div>
            <h2>Seed Source</h2>
            <p className="muted">{seedSource.name}</p>
          </div>
          <form
            action={importAction}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Importing this template may replace or update the active checklist template.",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <ImportButton />
          </form>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Template</dt>
            <dd>{seedSource.id}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{seedSource.version}</dd>
          </div>
          <div>
            <dt>Sections / Items</dt>
            <dd>
              {seedSource.sectionsCount} / {seedSource.itemsCount}
            </dd>
          </div>
          <div>
            <dt>Extraction</dt>
            <dd>
              <Badge
                label={seedSource.extractionStatus}
                tone={seedSource.extractionStatus === "complete" ? "success" : "warning"}
              />
            </dd>
          </div>
        </dl>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <PageSection title="Checklist Templates">
        {rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Template ID</th>
                  <th>Version</th>
                  <th>Sections</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Validity</th>
                  <th>Checksum</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((template) => {
                  const validity = templateValidity(template);

                  return (
                    <tr
                      className={validity === "invalid" ? "incomplete-row" : undefined}
                      key={template.id}
                    >
                      <td>{template.name}</td>
                      <td>{template.template_id}</td>
                      <td>{template.version}</td>
                      <td>{template.sections_count ?? 0}</td>
                      <td>{template.items_count ?? 0}</td>
                      <td>
                        <StatusBadge status={isActiveTemplate(template) ? "active" : "inactive"} />
                      </td>
                      <td>
                        <StatusBadge status={validity} />
                      </td>
                      <td>
                        <span className="code-row">
                          <code className="checksum" title={template.checksum}>
                            {shortenId(template.checksum, 8)}
                          </code>
                          <CopyButton value={template.checksum} />
                        </span>
                      </td>
                      <td>{formatDateTime(template.updated)}</td>
                      <td className="actions-cell">
                        <button
                          className="button secondary"
                          onClick={() => setSelected(template)}
                          type="button"
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No checklist templates yet." />
        )}
      </PageSection>

      {selected ? <Drawer onClose={() => setSelected(null)} template={selected} /> : null}
    </div>
  );
}
