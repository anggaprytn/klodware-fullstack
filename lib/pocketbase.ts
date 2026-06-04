import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import { getServerEnv } from "./env";

export { ClientResponseError };

let superuserToken = "";
let superuserRecord: RecordModel | null = null;

export function createPocketBaseClient() {
  const env = getServerEnv();
  const pb = new PocketBase(env.PB_URL);
  pb.autoCancellation(false);
  return pb;
}

export async function getSuperuserPocketBase() {
  const env = getServerEnv();
  const pb = createPocketBaseClient();

  if (superuserToken) {
    pb.authStore.save(superuserToken, superuserRecord);
    if (pb.authStore.isValid) {
      try {
        await pb.collection("_superusers").authRefresh();
        superuserToken = pb.authStore.token;
        superuserRecord = pb.authStore.record;
        return pb;
      } catch {
        superuserToken = "";
        superuserRecord = null;
      }
    }
  }

  await pb
    .collection("_superusers")
    .authWithPassword(env.PB_SUPERUSER_EMAIL, env.PB_SUPERUSER_PASSWORD);
  superuserToken = pb.authStore.token;
  superuserRecord = pb.authStore.record;

  return pb;
}

export function isPocketBaseResponseError(error: unknown): error is ClientResponseError {
  return error instanceof ClientResponseError;
}
