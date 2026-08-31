import { jsonError } from "@/lib/http";
import { deleteDocument, readDocument } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await readDocument(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  return Response.json(document);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await readDocument(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  await deleteDocument(id);

  return Response.json({ ok: true });
}
