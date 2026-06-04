import type { ChecklistTemplateRecord } from "./types";

export type TemplateChecklistItem = {
  id: string;
  section_code: string;
  label: string;
  sort_order: number;
};

export type TemplateChecklistSection = {
  code: string;
  name: string;
  sort_order: number;
  items: TemplateChecklistItem[];
};

type RawTemplateItem = {
  id?: unknown;
  item_template_id?: unknown;
  label?: unknown;
  type?: unknown;
  section_code?: unknown;
  sort_order?: unknown;
};

type RawTemplateSection = {
  code?: unknown;
  name?: unknown;
  title?: unknown;
  sort_order?: unknown;
  items?: unknown;
};

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function templateSections(
  template: ChecklistTemplateRecord,
): TemplateChecklistSection[] {
  const sectionsSource = arrayValue(template.sections_json);

  return sectionsSource.map((sectionSource, sectionIndex) => {
    const section = sectionSource as RawTemplateSection;
    const code = stringValue(section.code);
    const items = arrayValue(section.items)
      .map((itemSource, itemIndex) => {
        const item = itemSource as RawTemplateItem;
        const id = stringValue(item.id, stringValue(item.item_template_id));
        const type = stringValue(item.type, "rating_item");

        if (!id || type !== "rating_item") {
          return null;
        }

        return {
          id,
          section_code: stringValue(item.section_code, code),
          label: stringValue(item.label, id),
          sort_order: numberValue(item.sort_order, itemIndex + 1),
        };
      })
      .filter((item): item is TemplateChecklistItem => Boolean(item));

    return {
      code,
      name: stringValue(section.name, stringValue(section.title, code)),
      sort_order: numberValue(section.sort_order, sectionIndex + 1),
      items,
    };
  });
}

export function templateItems(template: ChecklistTemplateRecord) {
  return templateSections(template).flatMap((section) => section.items);
}

export function templateItemMap(template: ChecklistTemplateRecord) {
  return new Map(templateItems(template).map((item) => [item.id, item]));
}

export function templateSectionSummaries(
  template: ChecklistTemplateRecord,
  summaryBySection: Map<string, { total: number; completed: number; findings: number }>,
) {
  return templateSections(template).map((section) => {
    const summary = summaryBySection.get(section.code) ?? {
      total: section.items.length,
      completed: 0,
      findings: 0,
    };

    return {
      code: section.code,
      name: section.name,
      total_items: section.items.length,
      completed_items: summary.completed,
      findings_count: summary.findings,
    };
  });
}
