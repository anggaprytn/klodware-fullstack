import { requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import type { InspectionPhotoRecord } from "@/lib/types";

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
  await requireAdminSession();
  const { id } = await params;

  try {
    const pb = await getSuperuserPocketBase();
    const photo = await pb
      .collection("inspection_photos")
      .getOne<InspectionPhotoRecord>(id);

    if (!photo.file) {
      return new Response("Inspection photo not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    let token = "";
    try {
      token = await pb.files.getToken();
    } catch {
      token = "";
    }

    const fileUrl = pb.files.getURL(
      photo,
      photo.file,
      token ? { token } : undefined,
    );
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return new Response("Unable to fetch inspection photo.", {
        status: response.status === 404 ? 404 : 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const headers = new Headers({
      "Content-Type":
        response.headers.get("content-type") ?? imageContentType(photo.file),
      "Cache-Control": "private, max-age=300",
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(await response.arrayBuffer(), { headers });
  } catch (error) {
    if (isPocketBaseResponseError(error) && error.status === 404) {
      return new Response("Inspection photo not found.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response("Unable to load inspection photo.", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
