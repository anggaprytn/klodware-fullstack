import { revalidatePath } from "next/cache";
import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { VesselRecord } from "@/lib/types";
import { validateVesselImageFile, vesselImagePath } from "@/lib/vessel-image";

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
  const yearBuilt = Number(textValue(formData, "year_built"));
  const file = formData.get("image");
  const payload = new FormData();

  payload.set("name", name);
  payload.set("imo", imo);
  payload.set("imo_no", imo);
  payload.set("mmsi", textValue(formData, "mmsi"));
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

async function createVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  await pb.collection("vessels").create(vesselPayload(formData, true));
  revalidatePath("/admin/vessels");
}

async function updateVesselAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  await pb
    .collection("vessels")
    .update(textValue(formData, "id"), vesselPayload(formData, false));
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

export default async function AdminVesselsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const vessels = await pb.collection("vessels").getFullList<VesselRecord>({
    sort: "name",
  });

  return (
    <AdminShell
      title="Vessels"
      description="Manage vessel records used by mobile catalog and inspections."
    >
      <div className="admin-grid">
        <section className="panel">
          <h2>Create Vessel</h2>
          <form
            action={createVesselAction}
            className="form form-grid"
            encType="multipart/form-data"
          >
            <VesselFields />
            <button className="button" type="submit">
              Create vessel
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Vessel Catalog</h2>
          <div className="crud-list">
            {vessels.map((vessel) => (
              <article className="crud-item" key={vessel.id}>
                <VesselImagePreview vessel={vessel} />
                <form
                  action={updateVesselAction}
                  className="form form-grid"
                  encType="multipart/form-data"
                >
                  <input name="id" type="hidden" value={vessel.id} />
                  <VesselFields vessel={vessel} />
                  <div className="row-actions">
                    <span className={`status-pill ${vessel.status}`}>
                      {vessel.status}
                    </span>
                    <button className="button" type="submit">
                      Save
                    </button>
                  </div>
                </form>
                {vessel.status === "active" ? (
                  <form action={deactivateVesselAction}>
                    <input name="id" type="hidden" value={vessel.id} />
                    <button className="button danger" type="submit">
                      Deactivate
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function VesselFields({ vessel }: { vessel?: VesselRecord }) {
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={vessel?.name ?? ""} required />
      </label>
      <label className="field">
        <span>IMO</span>
        <input name="imo" defaultValue={vessel?.imo ?? vessel?.imo_no ?? ""} />
      </label>
      <label className="field">
        <span>MMSI</span>
        <input name="mmsi" defaultValue={vessel?.mmsi ?? ""} />
      </label>
      <label className="field">
        <span>Call sign</span>
        <input name="call_sign" defaultValue={vessel?.call_sign ?? ""} />
      </label>
      <label className="field">
        <span>Flag</span>
        <input name="flag" defaultValue={vessel?.flag ?? ""} />
      </label>
      <label className="field">
        <span>Year built</span>
        <input
          name="year_built"
          defaultValue={vessel?.year_built ?? ""}
          min="1800"
          type="number"
        />
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" defaultValue={vessel?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="field">
        <span>Image</span>
        <input accept="image/jpeg,image/png,image/webp" name="image" type="file" />
      </label>
    </>
  );
}

function VesselImagePreview({ vessel }: { vessel: VesselRecord }) {
  const imagePath = vesselImagePath(vessel);

  return (
    <div className="vessel-image-preview">
      {imagePath ? (
        // The image is served by the Next.js proxy route, so no remote image config is needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${vessel.name} vessel`} src={imagePath} />
      ) : (
        <div className="vessel-image-placeholder" aria-label="No vessel image">
          No image
        </div>
      )}
      <div>
        <strong>{vessel.name}</strong>
        <span>{vessel.image ? "Image uploaded" : "No image uploaded"}</span>
      </div>
    </div>
  );
}
