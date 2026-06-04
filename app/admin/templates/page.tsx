import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "../AdminShell";
import {
  countTemplateItems,
  loadChecklistTemplateFile,
  seedChecklistTemplate,
} from "@/lib/checklist-template";
import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import type { ChecklistTemplateRecord } from "@/lib/types";

async function importTemplateAction() {
  "use server";

  await requireAdminSession();
  let target = "/admin/templates";

  try {
    const result = await seedChecklistTemplate({
      requireCompleteExtraction: true,
    });
    revalidatePath("/admin/templates");
    target = `/admin/templates?message=${encodeURIComponent(
      `${result.action} ${result.record.template_id} v${result.record.version}`,
    )}`;
  } catch (error) {
    target = `/admin/templates?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Template import failed.",
    )}`;
  }

  redirect(target);
}

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const params = (await searchParams) ?? {};
  const selectedId = typeof params.id === "string" ? params.id : "";
  const message = typeof params.message === "string" ? params.message : "";
  const error = typeof params.error === "string" ? params.error : "";
  const pb = await getSuperuserPocketBase();
  const templates = await pb
    .collection("checklist_templates")
    .getFullList<ChecklistTemplateRecord>({ sort: "-active,-version,name" });
  const sourceTemplate = await loadChecklistTemplateFile();
  const sourceItemsCount = countTemplateItems(sourceTemplate);
  const sourceExtractionStatus =
    sourceTemplate.source?.checklist_extraction_status ??
    (sourceTemplate.sections.length >= 29 && sourceItemsCount >= 150
      ? "complete"
      : "incomplete");

  let selected = templates[0] ?? null;
  if (selectedId) {
    try {
      selected = await pb
        .collection("checklist_templates")
        .getOne<ChecklistTemplateRecord>(selectedId);
    } catch (fetchError) {
      if (!isPocketBaseResponseError(fetchError) || fetchError.status !== 404) {
        throw fetchError;
      }
    }
  }

  return (
    <AdminShell
      title="Templates"
      description="Review checklist template versions and import the seeded source safely."
    >
      <div className="admin-grid">
        <section className="panel">
          <h2>Seed Source</h2>
          <dl className="detail-list">
            <div>
              <dt>Template</dt>
              <dd>{sourceTemplate.id}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{sourceTemplate.name}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{sourceTemplate.version}</dd>
            </div>
            <div>
              <dt>Extraction</dt>
              <dd>{sourceExtractionStatus}</dd>
            </div>
            <div>
              <dt>Sections / Items</dt>
              <dd>
                {sourceTemplate.sections.length} / {sourceItemsCount}
              </dd>
            </div>
          </dl>
          {message ? <p className="notice">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <form action={importTemplateAction}>
            <button className="button" type="submit">
              Import seed template
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Templates</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Template ID</th>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Checksum</th>
                  <th>Status</th>
                  <th>Sections</th>
                  <th>Items</th>
                  <th>Validity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const sectionsCount = template.sections_count ?? 0;
                  const itemsCount = template.items_count ?? 0;
                  const active =
                    template.active === true || template.is_active === true;
                  const incomplete = sectionsCount < 29 || itemsCount < 150;

                  return (
                    <tr
                      className={incomplete ? "incomplete-row" : undefined}
                      key={template.id}
                    >
                      <td>{template.template_id}</td>
                      <td>{template.name}</td>
                      <td>{template.version}</td>
                      <td className="checksum">{template.checksum}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            active ? "active" : "inactive"
                          }`}
                        >
                          {active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td>{sectionsCount}</td>
                      <td>{itemsCount}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            incomplete ? "warning" : "active"
                          }`}
                        >
                          {incomplete ? "incomplete" : "valid"}
                        </span>
                      </td>
                      <td>
                        <Link href={`/admin/templates?id=${template.id}`}>View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selected ? (
          <section className="panel">
            <h2>Template Detail</h2>
            <dl className="detail-list">
              <div>
                <dt>Template ID</dt>
                <dd>{selected.template_id}</dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{selected.version}</dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd className="checksum">{selected.checksum}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{String(selected.active === true || selected.is_active === true)}</dd>
              </div>
              <div>
                <dt>Sections / Items</dt>
                <dd>
                  {selected.sections_count ?? 0} / {selected.items_count ?? 0}
                </dd>
              </div>
              <div>
                <dt>Validity</dt>
                <dd>
                  {(selected.sections_count ?? 0) < 29 ||
                  (selected.items_count ?? 0) < 150
                    ? "incomplete"
                    : "valid"}
                </dd>
              </div>
            </dl>
            <pre className="json-preview">
              {JSON.stringify(selected.schema_json ?? selected.source_json, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
