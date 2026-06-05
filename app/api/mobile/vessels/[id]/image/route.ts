import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import type { VesselRecord } from "@/lib/types";
import { pocketBaseFileUrl, vesselImageFilename } from "@/lib/vessel-image";

export const runtime = "nodejs";

function imageContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const pb = await getSuperuserPocketBase();
    const vessel = await pb.collection("vessels").getOne<VesselRecord>(id);
    const filename = vesselImageFilename(vessel);

    if (!filename) {
      return new Response("Vessel image not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const fileUrl = await pocketBaseFileUrl({ pb, record: vessel, filename });
    const response = await fetch(fileUrl, {
      headers: pb.authStore.token
        ? {
            Authorization: pb.authStore.token,
          }
        : undefined,
    });

    if (!response.ok) {
      return new Response("Unable to fetch vessel image.", {
        status: response.status === 404 ? 404 : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") ?? imageContentType(filename),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(await response.arrayBuffer(), { headers });
  } catch (error) {
    if (isPocketBaseResponseError(error) && error.status === 404) {
      return new Response("Vessel image not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response("Unable to load vessel image.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
