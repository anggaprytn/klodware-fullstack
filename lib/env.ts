import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PB_URL: z.string().url(),
  PB_SUPERUSER_EMAIL: z.string().email(),
  PB_SUPERUSER_PASSWORD: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  MAX_INSPECTION_PHOTO_BYTES: z.coerce.number().int().positive().optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | null = null;
let attemptedLocalEnvLoad = false;

function loadLocalEnvFile() {
  if (attemptedLocalEnvLoad) return;
  attemptedLocalEnvLoad = true;

  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("Server environment cannot be read in the browser.");
  }

  loadLocalEnvFile();

  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
