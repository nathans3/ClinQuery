import { withDocumentLock } from "@/lib/document-lock";
import { jsonError } from "@/lib/http";
import { indexDocumentRecord } from "@/lib/rag/index-document";
import { shouldReuseExistingIndex } from "@/lib/rag/index-ready";
import { readChunks, readDocument } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const refresh =
    new URL(request.url).searchParams.get("refresh") === "1";

  return withDocumentLock(id, async () => {
    const document = await readDocument(id);

    if (!document) {
      return jsonError("Document not found.", 404);
    }

    const existingChunks = await readChunks(id);

    if (
      !refresh &&
      shouldReuseExistingIndex(document, existingChunks.length)
    ) {
      return Response.json({
        ...document,
        cached: true,
        chunkCount: existingChunks.length,
      });
    }

    try {
      const ready = await indexDocumentRecord(document);

      return Response.json({
        ...ready,
        chunkCount: (await readChunks(id)).length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Indexing failed.";
      const status = message.includes("No text was extracted") ? 400 : 500;

      return jsonError(message, status);
    }
  });
}
