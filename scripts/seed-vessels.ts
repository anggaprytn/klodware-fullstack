import { getSuperuserPocketBase } from "../lib/pocketbase";

const devVessel = {
  name: "Klodware Dev Vessel",
  code: "DEV-001",
  imo_no: "0000001",
  type: "general_cargo",
  status: "active",
  metadata_json: {
    seeded_for: "dev-testing",
  },
};

async function main() {
  const pb = await getSuperuserPocketBase();
  const filter = pb.filter("code = {:code}", { code: devVessel.code });

  try {
    const existing = await pb.collection("vessels").getFirstListItem(filter);
    await pb.collection("vessels").update(existing.id, devVessel);
    console.log(`updated vessel ${devVessel.code}`);
  } catch {
    await pb.collection("vessels").create(devVessel);
    console.log(`created vessel ${devVessel.code}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
