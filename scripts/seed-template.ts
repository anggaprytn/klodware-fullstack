import { seedChecklistTemplate } from "../lib/checklist-template";

async function main() {
  const result = await seedChecklistTemplate({ requireCompleteExtraction: true });
  console.log(
    `${result.action} checklist template ${result.record.template_id} v${result.record.version} (${result.checksum}); sections=${result.sectionsCount}, items=${result.itemsCount}, deactivated=${result.deactivatedCount}, active_zero_item=${result.zeroItemActiveCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
