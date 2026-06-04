import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type PocketBase from "pocketbase";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "./pocketbase";
import type { ChecklistTemplateRecord } from "./types";

export const SUPERINTENDENT_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "templates/superintendent-monthly-v1.json",
);

export const SUPERINTENDENT_CHECKLIST_PDF_PATH = path.resolve(
  process.cwd(),
  "docs/reference/5.7-superintendent-monthly-inspection-checklist-v1.2.pdf",
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
  label?: string;
  type?: string;
  section_code?: string;
  sort_order?: number;
  [key: string]: unknown;
};

type TemplateSection = {
  code?: string;
  name?: string;
  title?: string;
  sort_order?: number;
  items: TemplateItem[];
};

type RunningHourItem = {
  id?: string;
  label?: string;
  type?: string;
  sort_order?: number;
};

type OtherComments = {
  id?: string;
  label?: string;
  type?: string;
};

export type ChecklistTemplateSource = {
  id?: string;
  template_id?: string;
  type?: string;
  version: number;
  name: string;
  photo_policy?: unknown;
  source?: {
    checklist_extraction_status?: string;
    [key: string]: unknown;
  };
  rating_options?: RatingOption[];
  sections?: TemplateSection[];
  running_hours?: RunningHourItem[];
  other_comments?: OtherComments;
};

export type NormalizedChecklistTemplate = Omit<
  ChecklistTemplateSource,
  "id" | "template_id" | "rating_options" | "sections" | "running_hours"
> & {
  id: string;
  template_id: string;
  type: string;
  rating_options: RatingOption[];
  sections: Array<TemplateSection & { code: string; name: string }>;
  running_hours: RunningHourItem[];
  other_comments?: OtherComments;
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

export function validateCompleteTemplate(template: NormalizedChecklistTemplate) {
  const errors: string[] = [];
  const itemIds = new Set<string>();
  const requiredRatings = new Set(["1", "2", "3", "4", "NA"]);
  const sectionsCount = template.sections.length;
  const itemsCount = countTemplateItems(template);

  if (!template.id || !template.template_id) {
    errors.push("Template must have an id.");
  }

  if (sectionsCount < 29) {
    errors.push(`Template must have at least 29 sections; found ${sectionsCount}.`);
  }

  if (itemsCount < 150) {
    errors.push(
      `Template must have at least 150 normal checklist items; found ${itemsCount}.`,
    );
  }

  if (!Array.isArray(template.rating_options) || template.rating_options.length === 0) {
    errors.push("Template rating options are missing.");
  } else {
    for (const option of template.rating_options) {
      requiredRatings.delete(option.value);
    }

    if (requiredRatings.size > 0) {
      errors.push(
        `Template rating options are missing values: ${[...requiredRatings].join(", ")}.`,
      );
    }
  }

  if (
    !Array.isArray(template.running_hours) ||
    template.running_hours.length === 0
  ) {
    errors.push("Template running_hours is missing.");
  } else {
    for (const runningHour of template.running_hours) {
      if (
        !runningHour.id ||
        !runningHour.label ||
        runningHour.type !== "running_hour" ||
        !runningHour.sort_order
      ) {
        errors.push(
          `Running hour ${runningHour.id ?? "unknown"} is missing id, label, type, or sort_order.`,
        );
      }
    }
  }

  if (
    !template.other_comments ||
    !template.other_comments.id ||
    !template.other_comments.label ||
    template.other_comments.type !== "textarea"
  ) {
    errors.push("Template other_comments is missing.");
  }

  for (const section of template.sections) {
    if (!section.code) {
      errors.push("Each section must have a code.");
    }

    if (!section.name) {
      errors.push(`Section ${section.code ?? "unknown"} must have a name.`);
    }

    for (const item of section.items) {
      if (!item.id) {
        errors.push(`Section ${section.code} has an item without a stable id.`);
      } else if (itemIds.has(item.id)) {
        errors.push(`Duplicate checklist item id: ${item.id}.`);
      } else {
        itemIds.add(item.id);
      }

      if (
        !item.label ||
        item.type !== "rating_item" ||
        !item.section_code ||
        !item.sort_order
      ) {
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
  if (template.source?.checklist_extraction_status === "complete") {
    return true;
  }

  return Boolean(
    template.sections?.length &&
      template.rating_options?.length &&
      template.running_hours?.length &&
      template.other_comments,
  );
}

export function normalizeTemplate(
  source: ChecklistTemplateSource,
): NormalizedChecklistTemplate {
  const templateId = source.id ?? source.template_id ?? "";

  return {
    ...source,
    id: templateId,
    template_id: templateId,
    type: source.type ?? "superintendent_monthly",
    rating_options: source.rating_options ?? [],
    running_hours: (source.running_hours ?? []).map((runningHour, index) => ({
      ...runningHour,
      type: runningHour.type ?? "running_hour",
      sort_order: runningHour.sort_order ?? index + 1,
    })),
    sections: (source.sections ?? []).map((section, sectionIndex) => ({
      ...section,
      code: section.code ?? "",
      name: section.name ?? section.title ?? "",
      items: section.items.map((item, itemIndex) => {
        const id = item.id ?? item.item_template_id;
        return {
          ...item,
          id,
          type: item.type ?? "rating_item",
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

function ensureChecklistPdfExists() {
  if (!existsSync(SUPERINTENDENT_CHECKLIST_PDF_PATH)) {
    throw new Error(
      "Checklist PDF is missing from repo. Please add it to docs/reference before full extraction.",
    );
  }
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

  if (requireCompleteExtraction) {
    ensureChecklistPdfExists();
  }

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

    if (
      existing.checksum === checksum &&
      existing.active === true &&
      existing.is_active === true &&
      existing.sections_count === sectionsCount &&
      existing.items_count === itemsCount
    ) {
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
    "(template_id = {:templateId} || type = {:type} || type = 'superintendent-monthly' || type = 'superintendent_monthly') && (active = true || is_active = true) && id != {:id}",
    {
      templateId: template.template_id,
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

  const zeroItemActiveFilter = pb.filter(
    "(template_id = {:templateId} || type = {:type} || type = 'superintendent-monthly' || type = 'superintendent_monthly') && (active = true || is_active = true) && items_count = 0",
    {
      templateId: template.template_id,
      type: template.type,
    },
  );
  const zeroItemActiveTemplates = await pb
    .collection("checklist_templates")
    .getFullList<ChecklistTemplateRecord>({ filter: zeroItemActiveFilter });

  if (zeroItemActiveTemplates.length > 0) {
    throw new Error(
      "Active superintendent monthly templates with items_count: 0 still exist after seeding.",
    );
  }

  return {
    action,
    record,
    checksum,
    sectionsCount,
    itemsCount,
    deactivatedCount: activeTemplates.length,
    zeroItemActiveCount: zeroItemActiveTemplates.length,
  };
}
