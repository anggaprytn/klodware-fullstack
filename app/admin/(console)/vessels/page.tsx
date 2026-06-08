import { revalidatePath } from "next/cache";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { InspectionRecord, PdfReportRecord, VesselRecord } from "@/lib/types";
import { validateVesselImageFile, vesselImagePath } from "@/lib/vessel-image";
import { AdminVesselsClient, type VesselOperations } from "./VesselsClient";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function vesselCode(name: string, imo: string) {
  if (imo) return `IMO-${imo}`;
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function vesselPayload(formData: FormData, includeCode: boolean) {
  const name = textValue(formData, "name");
  const imo = textValue(formData, "imo");
  const mmsi = textValue(formData, "mmsi");
  const rawYearBuilt = textValue(formData, "year_built");
  const yearBuilt = Number(rawYearBuilt);
  const file = formData.get("image");
  const payload = new FormData();

  if (!name) throw new Error("Vessel name is required.");
  if (!imo) throw new Error("IMO is required.");
  if (!mmsi) throw new Error("MMSI is required.");
  if (rawYearBuilt && !Number.isFinite(yearBuilt)) {
    throw new Error("Year built must be numeric.");
  }

  payload.set("name", name);
  payload.set("imo", imo);
  payload.set("imo_no", imo);
  payload.set("mmsi", mmsi);
  payload.set("call_sign", textValue(formData, "call_sign"));
  payload.set("flag", textValue(formData, "flag"));
  payload.set("status", textValue(formData, "status") === "inactive" ? "inactive" : "active");

  const metadata = textValue(formData, "metadata_json");

  if (includeCode) {
    payload.set("code", vesselCode(name, imo));
  }

  if (Number.isFinite(yearBuilt) && yearBuilt > 0) {
    payload.set("year_built", String(yearBuilt));
  }

  if (file instanceof File && file.size > 0) {
    validateVesselImageFile(file);
    payload.set("image", file);
  }

  if (metadata) {
    payload.set("metadata_json", JSON.stringify(JSON.parse(metadata)));
  }

  return payload;
}

async function ensureUniqueVesselIdentifiers(
  imo: string,
  mmsi: string,
  currentId?: string,
) {
  const pb = await getSuperuserPocketBase();
  const filters = [
    pb.filter("(imo = {:imo} || imo_no = {:imo} || mmsi = {:mmsi})", {
      imo,
      mmsi,
    }),
  ];

  if (currentId) {
    filters.push(pb.filter("id != {:currentId}", { currentId }));
  }

  const existing = await pb.collection("vessels").getList<VesselRecord>(1, 1, {
    filter: filters.join(" && "),
  });

  if (existing.totalItems > 0) {
    throw new Error("IMO or MMSI is already used by another vessel.");
  }
}

async function createVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  await ensureUniqueVesselIdentifiers(textValue(formData, "imo"), textValue(formData, "mmsi"));
  await pb.collection("vessels").create(vesselPayload(formData, true));
  revalidatePath("/admin/vessels");
}

async function updateVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const id = textValue(formData, "id");
  await ensureUniqueVesselIdentifiers(textValue(formData, "imo"), textValue(formData, "mmsi"), id);
  await pb
    .collection("vessels")
    .update(id, vesselPayload(formData, false));
  revalidatePath("/admin/vessels");
}

async function deactivateVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  await pb.collection("vessels").update(textValue(formData, "id"), {
    status: "inactive",
  });
  revalidatePath("/admin/vessels");
}

async function activateVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  await pb.collection("vessels").update(textValue(formData, "id"), {
    status: "active",
  });
  revalidatePath("/admin/vessels");
}

function timeValue(value: string | undefined) {
  return value ? Date.parse(value) : 0;
}

function buildVesselOperations(
  vessels: VesselRecord[],
  inspections: InspectionRecord[],
  reports: PdfReportRecord[],
): Record<string, VesselOperations> {
  const reportsByInspection = new Map<string, PdfReportRecord[]>();

  for (const report of reports) {
    const current = reportsByInspection.get(report.inspection) ?? [];
    current.push(report);
    reportsByInspection.set(report.inspection, current);
  }

  return Object.fromEntries(
    vessels.map((vessel) => {
      const vesselInspections = inspections
        .filter((inspection) => inspection.vessel === vessel.id)
        .sort(
          (left, right) =>
            timeValue(right.submitted_at ?? right.synced_at ?? right.updated) -
            timeValue(left.submitted_at ?? left.synced_at ?? left.updated),
        );
      const latestInspection = vesselInspections[0];
      const latestReport = latestInspection
        ? (reportsByInspection.get(latestInspection.id) ?? []).sort(
            (left, right) =>
              timeValue(right.generated_at ?? right.updated) -
              timeValue(left.generated_at ?? left.updated),
          )[0]
        : undefined;

      return [
        vessel.id,
        {
          inspectionsCount: vesselInspections.length,
          lastInspectionDate:
            latestInspection?.submitted_at ?? latestInspection?.synced_at ?? "",
          lastReportStatus:
            latestReport?.status ?? latestInspection?.pdf_status ?? "",
        },
      ];
    }),
  );
}

export default async function AdminVesselsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const [vessels, inspections, reports] = await Promise.all([
    pb.collection("vessels").getFullList<VesselRecord>({
      sort: "name",
    }),
    pb.collection("inspections").getFullList<InspectionRecord>({
      sort: "-submitted_at,-synced_at",
    }),
    pb.collection("pdf_reports").getFullList<PdfReportRecord>({
      sort: "-generated_at",
    }),
  ]);
  const imagePaths = Object.fromEntries(
    vessels.map((vessel) => [vessel.id, vesselImagePath(vessel) ?? ""]),
  );
  const operations = buildVesselOperations(vessels, inspections, reports);

  return (
    <>
      <AdminPageHeader
        title="Vessels"
        description="Manage vessel records used by mobile catalog and inspections."
      />
      <AdminVesselsClient
        activateAction={activateVesselAction}
        createAction={createVesselAction}
        deactivateAction={deactivateVesselAction}
        imagePaths={imagePaths}
        operations={operations}
        updateAction={updateVesselAction}
        vessels={vessels}
      />
    </>
  );
}
