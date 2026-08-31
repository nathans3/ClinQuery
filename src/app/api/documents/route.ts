import { randomUUID } from "node:crypto";
import { hashFileBytes } from "@/lib/hash";
import { jsonError } from "@/lib/http";
import { digitalPagesFromTexts } from "@/lib/ocr/pipeline";
import { extractPdfPages } from "@/lib/ocr/pdf";
import { hasIndexableText } from "@/lib/rag/index-ready";
import { indexDocumentRecord } from "@/lib/rag/index-document";
import {
  findDocumentByHash,
  listDocuments,
  persistDocument,
  readCachedFile,
  readProcessCache,
  saveChunks,
  saveDocumentFile,
} from "@/lib/storage";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type ChunkRecord,
  type DocumentRecord,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolveMime(file: File): string {
  if (file.type) {
    return file.type;
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (name.endsWith(".png")) {
    return "image/png";
  }

  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (name.endsWith(".md")) {
    return "text/markdown";
  }

  if (name.endsWith(".txt")) {
    return "text/plain";
  }

  return "";
}

export async function GET() {
  const documents = await listDocuments();

  return Response.json({ documents });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a file under the `file` field.");
  }

  const mimeType = resolveMime(file);

  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return jsonError("Supported types: PDF, PNG, JPEG, TXT, MD.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("File is larger than 25 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = hashFileBytes(bytes);
  const existing = await findDocumentByHash(contentHash);

  if (existing) {
    return Response.json({ ...existing, cached: true });
  }

  const cached = await readProcessCache(contentHash);

  if (cached) {
    const id = randomUUID();
    const cachedFile = (await readCachedFile(contentHash)) ?? bytes;
    await saveDocumentFile(id, cachedFile, mimeType);
    const chunks: ChunkRecord[] = cached.chunks.map((chunk) => ({
      id: randomUUID(),
      docId: id,
      title: file.name,
      page: chunk.page,
      text: chunk.text,
      embedding: chunk.embedding,
    }));
    await saveChunks(id, chunks);
    const record: DocumentRecord = {
      id,
      name: file.name,
      mimeType,
      pageCount: cached.pageCount,
      status: "ready",
      pages: cached.pages,
      pendingPages: [],
      contentHash,
      cached: true,
      createdAt: new Date().toISOString(),
    };
    await persistDocument(record);

    return Response.json(record, { status: 201 });
  }

  const id = randomUUID();
  await saveDocumentFile(id, bytes, mimeType);

  let pageCount = 1;
  let pages: DocumentRecord["pages"] = [];
  let pendingPages = [1];

  try {
    if (mimeType === "application/pdf") {
      const extracted = await extractPdfPages(new Uint8Array(bytes));
      pageCount = extracted.pageCount;
      const routed = digitalPagesFromTexts(extracted.pageTexts);
      pages = routed.pages;
      pendingPages = routed.pendingPages;
    } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
      const text = bytes.toString("utf8");
      const routed = digitalPagesFromTexts([text]);
      pages = routed.pages;
      pendingPages = routed.pendingPages;
    }
  } catch (error) {
    pendingPages = Array.from({ length: pageCount }, (_, index) => index + 1);
    pages = [];
    console.error("Initial extract failed", error);
  }

  const record: DocumentRecord = {
    id,
    name: file.name,
    mimeType,
    pageCount,
    status: pendingPages.length > 0 ? "ocr" : "pending",
    pages,
    pendingPages,
    contentHash,
    createdAt: new Date().toISOString(),
  };

  await persistDocument(record);

  if (!hasIndexableText(pages)) {
    return Response.json(record, { status: 201 });
  }

  try {
    const ready = await indexDocumentRecord(record);

    return Response.json(ready, { status: 201 });
  } catch (error) {
    console.error("Index after extract failed", error);

    return Response.json(record, { status: 201 });
  }
}
