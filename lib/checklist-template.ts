import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type PocketBase from "pocketbase";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "./pocketbase";
import type { ChecklistTemplateRecord } from "./types";

export const SUPERINTENDENT_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "templates/superintendent-monthly-v1.json",
);

type RatingOption = {
  value: string;
  label: string;
  requires_remarks?: boolean;
  requires_photo?: boolean;
};

type TemplateItem = {
  id?: string;
  item_template_id?: string;
  label: string;
  type?: string;
  section_code?: string;
  sort_order?: number;
  [key: string]: unknown;
};

type TemplateSection = {
  code: string;
  title: string;
  items: TemplateItem[];
};

export type ChecklistTemplateSource = {
  template_id: string;
  type?: string;
  version: number;
  name: string;
  source?: {
    checklist_extraction_status?: string;
    [key: string]: unknown;
  };
  rating_options: RatingOption[];
  sections: TemplateSection[];
};

export type NormalizedChecklistTemplate = ChecklistTemplateSource & {
  type: string;
  sections: TemplateSection[];
};

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function checksumTemplate(template: NormalizedChecklistTemplate) {
  return createHash("sha256").update(stableStringify(template)).digest("hex");
}

export function countTemplateItems(template: NormalizedChecklistTemplate) {
  return template.sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
}

function validateCompleteTemplate(template: NormalizedChecklistTemplate) {
  const errors: string[] = [];

  for (const section of template.sections) {
    if (!section.code || !section.title) {
      errors.push("Each section must have code and title.");
    }

    for (const item of section.items) {
      if (!item.id) {
        errors.push(`Section ${section.code} has an item without a stable id.`);
      }

      if (!item.label || !item.type || !item.section_code || !item.sort_order) {
        errors.push(
          `Item ${item.id ?? "unknown"} is missing label, type, section_code, or sort_order.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function isTemplateExtractionComplete(template: ChecklistTemplateSource) {
  return template.source?.checklist_extraction_status === "complete";
}

export function normalizeTemplate(
  source: ChecklistTemplateSource,
): NormalizedChecklistTemplate {
  return {
    ...source,
    type: source.type ?? "superintendent-monthly",
    sections: source.sections.map((section, sectionIndex) => ({
      ...section,
      items: section.items.map((item, itemIndex) => {
        const id = item.id ?? item.item_template_id;
        return {
          ...item,
          id,
          item_template_id: id,
          type: item.type ?? "rating",
          section_code: item.section_code ?? section.code,
          sort_order: item.sort_order ?? itemIndex + 1,
        };
      }),
      sort_order: sectionIndex + 1,
    })),
  };
}

export async function loadChecklistTemplateFile(
  templatePath = SUPERINTENDENT_TEMPLATE_PATH,
) {
  const raw = await readFile(templatePath, "utf8");
  return normalizeTemplate(JSON.parse(raw) as ChecklistTemplateSource);
}

async function hasInspectionsForTemplate(
  pb: PocketBase,
  template: NormalizedChecklistTemplate,
  checksum: string,
) {
  const filter = pb.filter(
    "template_id = {:templateId} && template_version = {:version} && template_checksum != {:checksum}",
    {
      templateId: template.template_id,
      version: template.version,
      checksum,
    },
  );

  try {
    const records = await pb.collection("inspections").getList(1, 1, { filter });
    return records.totalItems > 0;
  } catch {
    return false;
  }
}

export async function seedChecklistTemplate({
  templatePath = SUPERINTENDENT_TEMPLATE_PATH,
  requireCompleteExtraction = true,
}: {
  templatePath?: string;
  requireCompleteExtraction?: boolean;
} = {}) {
  const pb = await getSuperuserPocketBase();
  const template = await loadChecklistTemplateFile(templatePath);

  if (requireCompleteExtraction && !isTemplateExtractionComplete(template)) {
    throw new Error(
      "Checklist PDF is missing from repo. Please add it to docs/reference before full extraction.",
    );
  }

  if (requireCompleteExtraction) {
    validateCompleteTemplate(template);
  }

  const checksum = checksumTemplate(template);
  const sectionsCount = template.sections.length;
  const itemsCount = countTemplateItems(template);
  const body = {
    template_id: template.template_id,
    type: template.type,
    version: template.version,
    name: template.name,
    checksum,
    active: true,
    is_active: true,
    schema_json: template,
    rating_options_json: template.rating_options,
    sections_json: template.sections,
    source_json: template,
    sections_count: sectionsCount,
    items_count: itemsCount,
  };
  const filter = pb.filter("template_id = {:templateId} && version = {:version}", {
    templateId: template.template_id,
    version: template.version,
  });

  let record: ChecklistTemplateRecord;
  let action: "created" | "updated" | "unchanged";

  try {
    const existing = await pb
      .collection("checklist_templates")
      .getFirstListItem<ChecklistTemplateRecord>(filter);

    if (existing.checksum && existing.checksum !== checksum) {
      const wouldBreakOldInspections = await hasInspectionsForTemplate(
        pb,
        template,
        checksum,
      );

      if (wouldBreakOldInspections) {
        throw new Error(
          `Existing template ${template.template_id} v${template.version} has inspections with a different checksum. Bump the template version instead of mutating it.`,
        );
      }
    }

    if (existing.checksum === checksum && existing.active === true) {
      record = existing;
      action = "unchanged";
    } else {
      record = await pb
        .collection("checklist_templates")
        .update<ChecklistTemplateRecord>(existing.id, body);
      action = "updated";
    }
  } catch (error) {
    if (!isPocketBaseResponseError(error) || error.status !== 404) {
      throw error;
    }

    record = await pb
      .collection("checklist_templates")
      .create<ChecklistTemplateRecord>(body);
    action = "created";
  }

  const activeFilter = pb.filter(
    "type = {:type} && active = true && id != {:id}",
    {
      type: template.type,
      id: record.id,
    },
  );
  const activeTemplates = await pb
    .collection("checklist_templates")
    .getFullList<ChecklistTemplateRecord>({ filter: activeFilter });

  await Promise.all(
    activeTemplates.map((activeTemplate) =>
      pb.collection("checklist_templates").update(activeTemplate.id, {
        active: false,
        is_active: false,
      }),
    ),
  );

  return {
    action,
    record,
    checksum,
    sectionsCount,
    itemsCount,
    deactivatedCount: activeTemplates.length,
  };
}
