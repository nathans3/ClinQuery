import { jsonError } from "@/lib/http";
import { readDocument, readDocumentFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await readDocument(id);
  const bytes = await readDocumentFile(id);

  if (!document || !bytes) {
    return jsonError("Document not found.", 404);
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
