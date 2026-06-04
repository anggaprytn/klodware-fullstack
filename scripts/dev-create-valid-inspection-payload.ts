import { randomUUID } from "node:crypto";
import { getSuperuserPocketBase } from "../lib/pocketbase";
import type { ChecklistTemplateRecord, VesselRecord } from "../lib/types";

type TemplateSection = {
  code?: string;
  items?: Array<{
    id?: string;
    item_template_id?: string;
    type?: string;
    section_code?: string;
  }>;
};

type RunningHour = {
  id?: string;
  label?: string;
};

type PayloadItem = {
  item_template_id: string;
  section_code: string;
  score: string;
  remarks: string;
  is_resolved: boolean;
  photo_refs: Array<{
    local_photo_id: string;
    type: "before" | "after";
  }>;
  updated_at: string;
};

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const pb = await getSuperuserPocketBase();
  const template = await pb
    .collection("checklist_templates")
    .getFirstListItem<ChecklistTemplateRecord>(
      "active = true || is_active = true",
      { sort: "-version" },
    );
  const vesselCode = argValue("vessel-code") ?? "DEV-001";
  const vessel = await pb
    .collection("vessels")
    .getFirstListItem<VesselRecord>(
      pb.filter("code = {:code} || id = {:code}", { code: vesselCode }),
    );
  const sections = (Array.isArray(template.sections_json)
    ? template.sections_json
    : []) as TemplateSection[];
  const items: PayloadItem[] = sections.flatMap((section) =>
    (section.items ?? [])
      .filter((item) => (item.type ?? "rating_item") === "rating_item")
      .map((item) => ({
        item_template_id: item.id ?? item.item_template_id ?? "",
        section_code: item.section_code ?? section.code ?? "",
        score: "1",
        remarks: "",
        is_resolved: false,
        photo_refs: [],
        updated_at: new Date().toISOString(),
      })),
  );

  if (hasFlag("finding") && items[0]) {
    items[0] = {
      ...items[0],
      score: "3",
      remarks: "Smoke-test finding with before photo evidence.",
      photo_refs: [
        {
          local_photo_id: argValue("local-photo-id") ?? "smoke-before-photo-001",
          type: "before",
        },
      ],
    };
  }

  const schema = template.schema_json as { running_hours?: RunningHour[] } | undefined;
  const runningHours = (schema?.running_hours ?? []).map((entry) => ({
    equipment: entry.label ?? entry.id ?? "",
    value: "",
  }));

  const payload = {
    local_id: argValue("local-id") ?? `local-${randomUUID()}`,
    device_id: argValue("device-id") ?? "dev-smoke-device",
    template_id: template.template_id,
    template_version: template.version,
    template_checksum: template.checksum,
    vessel_id: vessel.id,
    place: argValue("place") ?? "Dev smoke test",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "draft",
    items,
    running_hours: runningHours,
    other_comments: "",
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
