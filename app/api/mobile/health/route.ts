import { mobileSuccess } from "@/lib/mobile-response";

export const runtime = "nodejs";

export async function GET() {
  return mobileSuccess({
    status: "ok",
    service: "klodware-api",
  });
}
