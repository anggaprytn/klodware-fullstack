import { revalidatePath } from "next/cache";
import { AdminShell } from "../AdminShell";
import {
  countTemplateItems,
  loadChecklistTemplateFile,
  seedChecklistTemplate,
} from "@/lib/checklist-template";
import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { ChecklistTemplateRecord } from "@/lib/types";
import { AdminTemplatesClient } from "./TemplatesClient";

async function importTemplateAction() {
  "use server";

  await requireAdminSession();
  await seedChecklistTemplate({
    requireCompleteExtraction: true,
  });
  revalidatePath("/admin/templates");
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

  const orderedTemplates = selectedId
    ? [
        ...templates.filter((template) => template.id === selectedId),
        ...templates.filter((template) => template.id !== selectedId),
      ]
    : templates;

  return (
    <AdminShell
      title="Templates"
      description="Manage checklist versions used by mobile inspections."
    >
      <AdminTemplatesClient
        error={error}
        importAction={importTemplateAction}
        initialSelectedId={selectedId}
        message={message}
        seedSource={{
          extractionStatus: sourceExtractionStatus,
          id: sourceTemplate.id,
          itemsCount: sourceItemsCount,
          name: sourceTemplate.name,
          sectionsCount: sourceTemplate.sections.length,
          version: sourceTemplate.version,
        }}
        templates={orderedTemplates}
      />
    </AdminShell>
  );
}
