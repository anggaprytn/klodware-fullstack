import type PocketBase from "pocketbase";
import { InspectionAccessError } from "./inspections";
import type { UserRecord, VesselRecord } from "./types";

function relationIds(value: UserRecord["inspectable_vessels"]) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function inspectableVesselIds(user: UserRecord) {
  if (user.role === "admin") return null;
  return relationIds(user.inspectable_vessels);
}

function activeVesselFilter(pb: PocketBase) {
  return pb.filter("status = {:status}", { status: "active" });
}

function vesselIdFilter(pb: PocketBase, vesselIds: string[]) {
  const params = Object.fromEntries(
    vesselIds.map((vesselId, index) => [`vesselId${index}`, vesselId]),
  );
  const filter = vesselIds
    .map((_, index) => `id = {:vesselId${index}}`)
    .join(" || ");

  return pb.filter(`(${filter})`, params);
}

export async function getInspectableActiveVessels(
  pb: PocketBase,
  user: UserRecord,
) {
  const vesselIds = inspectableVesselIds(user);
  if (vesselIds?.length === 0) return [];

  const filters = [activeVesselFilter(pb)];
  if (vesselIds) {
    filters.push(vesselIdFilter(pb, vesselIds));
  }

  return pb.collection("vessels").getFullList<VesselRecord>({
    filter: filters.join(" && "),
    sort: "name",
  });
}

export function canInspectVessel(user: UserRecord, vesselId: string) {
  const vesselIds = inspectableVesselIds(user);
  return vesselIds === null || vesselIds.includes(vesselId);
}

export function assertCanInspectVessel(user: UserRecord, vessel: VesselRecord) {
  if (vessel.status !== "active") {
    throw new InspectionAccessError("NOT_FOUND", "Vessel was not found.");
  }

  if (!canInspectVessel(user, vessel.id)) {
    throw new InspectionAccessError(
      "FORBIDDEN",
      "You are not allowed to inspect this vessel.",
    );
  }
}
