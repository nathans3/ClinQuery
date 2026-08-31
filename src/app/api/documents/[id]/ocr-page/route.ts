import { withDocumentLock } from "@/lib/document-lock";
import { jsonError, isImageMime } from "@/lib/http";
import { processPage } from "@/lib/ocr/pipeline";
import { toDataUrl } from "@/lib/ocr/vision";
import { persistDocument, readDocument, readDocumentFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

interface OcrPageBody {
  page?: number;
  text?: string;
  imageBase64?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as OcrPageBody;

  return withDocumentLock(id, async () => {
  const document = await readDocument(id);

  if (!document) {
    return jsonError("Document not found.", 404);
  }

  const page = Number(body.page);

  if (!Number.isInteger(page) || page < 1 || page > document.pageCount) {
    return jsonError("A valid page number is required.");
  }

  try {
    let imageDataUrl = body.imageBase64;

    if (!body.text && !imageDataUrl && isImageMime(document.mimeType)) {
      const bytes = await readDocumentFile(id);

      if (!bytes) {
        return jsonError("Original file is missing.", 404);
      }

      imageDataUrl = toDataUrl(new Uint8Array(bytes), document.mimeType);
    }

    const pageRecord = await processPage({
      page,
      text: body.text,
      imageDataUrl,
    });

    const pages = [
      ...document.pages.filter((item) => item.page !== page),
      pageRecord,
    ].sort((a, b) => a.page - b.page);
    const pendingPages = document.pendingPages.filter((item) => item !== page);

    const next = {
      ...document,
      pages,
      pendingPages,
      status:
        document.status === "ready"
          ? ("ready" as const)
          : pendingPages.length === 0
            ? ("pending" as const)
            : ("ocr" as const),
      error: undefined,
    };

    await persistDocument(next);

    return Response.json(next);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OCR failed for this page.";
    const pages = document.pages.some((item) => item.page === page)
      ? document.pages
      : [
          ...document.pages,
          { page, engine: "lite" as const, markdown: body.text?.trim() || "" },
        ].sort((a, b) => a.page - b.page);
    const pendingPages = document.pendingPages.filter((item) => item !== page);
    const next = {
      ...document,
      pages,
      pendingPages,
      status:
        document.status === "ready"
          ? ("ready" as const)
          : pendingPages.length === 0
            ? ("pending" as const)
            : ("ocr" as const),
      error: message,
    };
    await persistDocument(next);

    return Response.json(next);
  }
  });
}
