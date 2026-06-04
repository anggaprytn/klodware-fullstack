import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSuperuserPocketBase } from "../lib/pocketbase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(
  __dirname,
  "../templates/superintendent-monthly-v1.json",
);

async function main() {
  const pb = await getSuperuserPocketBase();
  const raw = await readFile(templatePath, "utf8");
  const template = JSON.parse(raw) as {
    template_id: string;
    version: number;
    name: string;
    rating_options: unknown;
    sections: unknown;
  };
  const checksum = createHash("sha256").update(raw).digest("hex");
  const body = {
    template_id: template.template_id,
    version: template.version,
    name: template.name,
    checksum,
    is_active: true,
    rating_options_json: template.rating_options,
    sections_json: template.sections,
    source_json: template,
  };
  const filter = pb.filter("template_id = {:templateId} && version = {:version}", {
    templateId: template.template_id,
    version: template.version,
  });

  try {
    const existing = await pb
      .collection("checklist_templates")
      .getFirstListItem(filter);
    await pb.collection("checklist_templates").update(existing.id, body);
    console.log(
      `updated checklist template ${template.template_id} v${template.version} (${checksum})`,
    );
  } catch {
    await pb.collection("checklist_templates").create(body);
    console.log(
      `created checklist template ${template.template_id} v${template.version} (${checksum})`,
    );
  }

  console.warn(
    "TODO: Complete checklist item seeding by extracting every item from the referenced PDF in docs/PRD.md.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
