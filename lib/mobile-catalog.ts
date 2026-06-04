import type { ChecklistTemplateRecord, VesselRecord } from "./types";

function templateSchema(template: ChecklistTemplateRecord) {
  return (
    template.schema_json ?? {
      template_id: template.template_id,
      type: template.type,
      version: template.version,
      name: template.name,
      rating_options: template.rating_options_json,
      sections: template.sections_json,
    }
  );
}

export function toMobileVessel(vessel: VesselRecord) {
  return {
    id: vessel.id,
    name: vessel.name,
    imo: vessel.imo ?? vessel.imo_no ?? "",
    mmsi: vessel.mmsi ?? "",
    call_sign: vessel.call_sign ?? "",
    flag: vessel.flag ?? "",
    year_built: vessel.year_built ?? null,
    status: vessel.status,
    image: vessel.image ?? "",
  };
}

export function toMobileTemplateMetadata(template: ChecklistTemplateRecord) {
  const schema = templateSchema(template) as {
    type?: string;
    sections?: unknown[];
  };
  const type =
    template.type ||
    schema.type ||
    (template.template_id.startsWith("superintendent-monthly")
      ? "superintendent-monthly"
      : "checklist");

  return {
    id: template.template_id,
    record_id: template.id,
    type,
    name: template.name,
    version: template.version,
    checksum: template.checksum,
    active: template.active === true || template.is_active === true,
    sections_count:
      template.sections_count ??
      (Array.isArray(schema.sections) ? schema.sections.length : 0),
    items_count: template.items_count ?? 0,
  };
}

export function toMobileTemplateDetail(template: ChecklistTemplateRecord) {
  return {
    ...toMobileTemplateMetadata(template),
    schema: templateSchema(template),
  };
}
