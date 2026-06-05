import type { CollectionModel } from "pocketbase";
import { getSuperuserPocketBase } from "../lib/pocketbase";

type FieldSpec = {
  name: string;
  type: string;
  required?: boolean;
  [key: string]: unknown;
};

type CollectionSpec = {
  name: string;
  type: "auth" | "base";
  fields: FieldSpec[];
  indexes?: string[];
};

const select = (name: string, values: string[], required = false): FieldSpec => ({
  name,
  type: "select",
  required,
  maxSelect: 1,
  values,
});

const text = (name: string, required = false): FieldSpec => ({
  name,
  type: "text",
  required,
});

const number = (name: string, required = false): FieldSpec => ({
  name,
  type: "number",
  required,
});

const date = (name: string, required = false): FieldSpec => ({
  name,
  type: "date",
  required,
});

const json = (name: string, required = false): FieldSpec => ({
  name,
  type: "json",
  required,
});

const bool = (name: string, required = false): FieldSpec => ({
  name,
  type: "bool",
  required,
});

const file = (
  name: string,
  required = false,
  mimeTypes = ["image/jpeg", "image/png", "application/pdf"],
): FieldSpec => ({
  name,
  type: "file",
  required,
  maxSelect: 1,
  maxSize: 20 * 1024 * 1024,
  mimeTypes,
});

const imageFile = (name: string, required = false): FieldSpec =>
  file(name, required, ["image/jpeg", "image/png", "image/webp"]);

const relation = (
  name: string,
  collectionId: string,
  required = false,
): FieldSpec => ({
  name,
  type: "relation",
  required,
  collectionId,
  maxSelect: 1,
});

const relationMany = (name: string, collectionId: string): FieldSpec => ({
  name,
  type: "relation",
  required: false,
  collectionId,
  maxSelect: 999,
});

async function getCollection(name: string) {
  const pb = await getSuperuserPocketBase();

  try {
    return await pb.collections.getOne(name);
  } catch {
    return null;
  }
}

function fieldSummary(field: FieldSpec) {
  return `${field.name}:${field.type}`;
}

function sameStringArray(a: unknown, b: unknown) {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return [...a].sort().join("\n") === [...b].sort().join("\n");
}

function fieldNeedsOptionUpdate(existing: FieldSpec, desired: FieldSpec) {
  if (existing.type !== desired.type) return false;

  if (desired.type === "file") {
    return (
      existing.maxSelect !== desired.maxSelect ||
      existing.maxSize !== desired.maxSize ||
      !sameStringArray(existing.mimeTypes, desired.mimeTypes)
    );
  }

  return false;
}

async function createCollection(spec: CollectionSpec) {
  const pb = await getSuperuserPocketBase();

  if (spec.type === "auth") {
    const scaffolds = await pb.collections.getScaffolds();
    const authScaffold = scaffolds.auth as CollectionModel;
    const scaffoldFields = authScaffold.fields ?? [];
    const scaffoldFieldNames = new Set(scaffoldFields.map((field) => field.name));

    return pb.collections.create({
      ...authScaffold,
      id: undefined,
      name: spec.name,
      type: "auth",
      fields: [
        ...scaffoldFields,
        ...spec.fields.filter((field) => !scaffoldFieldNames.has(field.name)),
      ],
      indexes: spec.indexes ?? [],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: null,
      updateRule: '@request.auth.id = id || @request.auth.role = "admin"',
      deleteRule: null,
      passwordAuth: {
        ...(authScaffold as Record<string, any>).passwordAuth,
        enabled: true,
        identityFields: ["username", "email"],
      },
    } as unknown as CollectionModel);
  }

  return pb.collections.create({
    name: spec.name,
    type: "base",
    fields: spec.fields,
    indexes: spec.indexes ?? [],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  } as unknown as CollectionModel);
}

async function resolveRelationTargets(spec: CollectionSpec): Promise<CollectionSpec> {
  const resolvedFields = await Promise.all(
    spec.fields.map(async (field) => {
      if (field.type !== "relation" || typeof field.collectionId !== "string") {
        return field;
      }

      const target = await getCollection(field.collectionId);
      if (!target) {
        return field;
      }

      return {
        ...field,
        collectionId: target.id,
      };
    }),
  );

  return {
    ...spec,
    fields: resolvedFields,
  };
}

async function ensureCollection(spec: CollectionSpec) {
  const pb = await getSuperuserPocketBase();
  const resolvedSpec = await resolveRelationTargets(spec);
  const existing = await getCollection(resolvedSpec.name);

  if (!existing) {
    await createCollection(resolvedSpec);
    console.log(`created collection ${resolvedSpec.name}`);
    return;
  }

  const existingFields = new Map(existing.fields.map((field) => [field.name, field]));
  const missing = resolvedSpec.fields.filter((field) => !existingFields.has(field.name));
  const optionUpdates = resolvedSpec.fields.filter((field) => {
    const existingField = existingFields.get(field.name);
    return existingField && fieldNeedsOptionUpdate(existingField as FieldSpec, field);
  });
  const mismatches = resolvedSpec.fields.filter((field) => {
    const existingField = existingFields.get(field.name);
    return existingField && existingField.type !== field.type;
  });

  if (mismatches.length > 0) {
    console.warn(
      `collection ${resolvedSpec.name} has field type mismatches: ${mismatches
        .map(fieldSummary)
        .join(", ")}`,
    );
  }

  if (missing.length === 0 && optionUpdates.length === 0) {
    console.log(`verified collection ${resolvedSpec.name}`);
  } else {
    const desiredFields = new Map(resolvedSpec.fields.map((field) => [field.name, field]));
    await pb.collections.update(existing.id, {
      fields: [
        ...existing.fields.map((field) => {
          const desired = desiredFields.get(field.name);
          if (!desired || !fieldNeedsOptionUpdate(field as FieldSpec, desired)) {
            return field;
          }

          return {
            ...field,
            ...desired,
          };
        }),
        ...missing,
      ],
    });
    console.log(
      `updated collection ${resolvedSpec.name}; ${
        missing.length > 0
          ? `added fields ${missing.map(fieldSummary).join(", ")}`
          : "updated field options"
      }`,
    );
  }

  const existingIndexes = existing.indexes ?? [];
  const missingIndexes = (resolvedSpec.indexes ?? []).filter(
    (index) => !existingIndexes.includes(index),
  );

  if (missingIndexes.length > 0) {
    await pb.collections.update(existing.id, {
      indexes: [...existingIndexes, ...missingIndexes],
    });
    console.log(
      `updated collection ${resolvedSpec.name}; added indexes ${missingIndexes.join(", ")}`,
    );
  }

  if (resolvedSpec.type === "auth") {
    await pb.collections.update(existing.id, {
      passwordAuth: {
        ...(existing as Record<string, any>).passwordAuth,
        enabled: true,
        identityFields: ["username", "email"],
      },
    });
    console.log(`verified auth settings for ${resolvedSpec.name}`);
  }
}

async function buildSpecs(): Promise<CollectionSpec[]> {
  const users = await getCollection("users");
  const vessels = await getCollection("vessels");
  const inspections = await getCollection("inspections");

  const userCollectionId = users?.id ?? "users";
  const vesselCollectionId = vessels?.id ?? "vessels";
  const inspectionCollectionId = inspections?.id ?? "inspections";

  return [
    {
      name: "app_configs",
      type: "base",
      fields: [text("key", true), json("value_json", true), text("description")],
      indexes: ["CREATE UNIQUE INDEX idx_app_configs_key ON app_configs (key)"],
    },
    {
      name: "vessels",
      type: "base",
      fields: [
        text("name", true),
        text("code", true),
        text("imo_no"),
        text("imo"),
        text("mmsi"),
        text("call_sign"),
        text("flag"),
        number("year_built"),
        text("type"),
        select("status", ["active", "inactive"], true),
        imageFile("image"),
        json("metadata_json"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_vessels_code ON vessels (code)",
        "CREATE INDEX idx_vessels_imo ON vessels (imo)",
        "CREATE INDEX idx_vessels_status ON vessels (status)",
      ],
    },
    {
      name: "users",
      type: "auth",
      fields: [
        text("username", true),
        text("full_name", true),
        text("employee_no"),
        select("role", ["admin", "inspector", "viewer"], true),
        select("status", ["active", "inactive"], true),
        relationMany("inspectable_vessels", vesselCollectionId),
        json("metadata_json"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_users_username ON users (username) WHERE username != ''",
        "CREATE INDEX idx_users_role ON users (role)",
        "CREATE INDEX idx_users_status ON users (status)",
      ],
    },
    {
      name: "checklist_templates",
      type: "base",
      fields: [
        text("template_id", true),
        text("type"),
        number("version", true),
        text("name", true),
        text("checksum", true),
        bool("active"),
        bool("is_active", true),
        json("schema_json"),
        json("rating_options_json", true),
        json("sections_json", true),
        json("source_json"),
        number("sections_count"),
        number("items_count"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_checklist_templates_identity ON checklist_templates (template_id, version)",
        "CREATE INDEX idx_checklist_templates_type ON checklist_templates (type)",
        "CREATE INDEX idx_checklist_templates_active_new ON checklist_templates (active)",
        "CREATE INDEX idx_checklist_templates_active ON checklist_templates (is_active)",
      ],
    },
    {
      name: "inspections",
      type: "base",
      fields: [
        text("local_id", true),
        relation("user", userCollectionId, true),
        text("device_id", true),
        text("idempotency_key", true),
        relation("vessel", vesselCollectionId, true),
        text("template_id", true),
        number("template_version", true),
        text("template_checksum", true),
        text("inspector_name", true),
        text("inspector_employee_no"),
        text("place"),
        select("status", ["draft", "submitted", "locked"], true),
        select("pdf_status", ["not_requested", "queued", "generating", "ready", "failed"], true),
        date("started_at"),
        date("submitted_at"),
        date("synced_at"),
        date("locked_at"),
        json("summary_json"),
        json("raw_payload_json"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_inspections_idempotency ON inspections (idempotency_key)",
        "CREATE INDEX idx_inspections_user ON inspections (user)",
        "CREATE INDEX idx_inspections_vessel ON inspections (vessel)",
        "CREATE INDEX idx_inspections_status ON inspections (status)",
      ],
    },
    {
      name: "inspection_photos",
      type: "base",
      fields: [
        relation("inspection", inspectionCollectionId, true),
        text("local_photo_id", true),
        text("photo_idempotency_key", true),
        text("item_template_id", true),
        text("section_code"),
        select("photo_type", ["before", "after"], true),
        file("file", true),
        date("captured_at", true),
        date("uploaded_at", true),
        number("latitude"),
        number("longitude"),
        text("checksum", true),
        json("metadata_json"),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_inspection_photos_idempotency ON inspection_photos (photo_idempotency_key)",
        "CREATE INDEX idx_inspection_photos_inspection ON inspection_photos (inspection)",
      ],
    },
    {
      name: "pdf_reports",
      type: "base",
      fields: [
        relation("inspection", inspectionCollectionId, true),
        select("status", ["queued", "generating", "ready", "failed"], true),
        file("file"),
        number("file_size_bytes"),
        date("generated_at"),
        text("error_message"),
        json("metadata_json"),
      ],
      indexes: [
        "CREATE INDEX idx_pdf_reports_inspection ON pdf_reports (inspection)",
        "CREATE INDEX idx_pdf_reports_status ON pdf_reports (status)",
      ],
    },
    {
      name: "sync_events",
      type: "base",
      fields: [
        relation("user", userCollectionId),
        text("device_id"),
        text("request_id"),
        text("event_type", true),
        select("status", ["success", "failed"], true),
        bool("retryable"),
        json("payload_json"),
        json("error_json"),
        date("occurred_at", true),
      ],
      indexes: [
        "CREATE INDEX idx_sync_events_user ON sync_events (user)",
        "CREATE INDEX idx_sync_events_request_id ON sync_events (request_id)",
      ],
    },
  ];
}

async function main() {
  const specs = await buildSpecs();

  for (const spec of specs) {
    await ensureCollection(spec);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
