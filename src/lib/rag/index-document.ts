import { randomUUID } from "node:crypto";
import { chunkDocumentPages } from "@/lib/rag/chunker";
import { embedTexts } from "@/lib/rag/embeddings";
import { persistDocument, readDocumentFile, saveChunks, saveProcessCache } from "@/lib/storage";
import type { ChunkRecord, DocumentRecord } from "@/lib/types";

export async function indexDocumentRecord(
  document: DocumentRecord,
): Promise<DocumentRecord> {
  const pages = Array.from({ length: document.pageCount }, (_, index) => {
    const page = index + 1;

    return (
      document.pages.find((item) => item.page === page) ?? {
        page,
        engine: "lite" as const,
        markdown: "",
      }
    );
  });
  const readyToIndex = {
    ...document,
    pages,
  };
  const textChunks = chunkDocumentPages(readyToIndex.pages);

  if (textChunks.length === 0) {
    const failed = {
      ...readyToIndex,
      status: "failed" as const,
      error: "No text was extracted from this document.",
    };
    await persistDocument(failed);

    throw new Error(failed.error);
  }

  if (document.status !== "ready") {
    await persistDocument({ ...readyToIndex, status: "indexing" });
  }
  const embeddings = await embedTexts(textChunks.map((chunk) => chunk.text));
  const records: ChunkRecord[] = textChunks.map((chunk, index) => ({
    id: randomUUID(),
    docId: readyToIndex.id,
    title: readyToIndex.name,
    page: chunk.page,
    text: chunk.text,
    embedding: embeddings[index],
  }));

  await saveChunks(readyToIndex.id, records);

  if (readyToIndex.contentHash && readyToIndex.pendingPages.length === 0) {
    const original = await readDocumentFile(readyToIndex.id);

    if (original) {
      await saveProcessCache(readyToIndex.contentHash, readyToIndex.mimeType, original, {
        pageCount: readyToIndex.pageCount,
        pages: readyToIndex.pages,
        chunks: records.map((chunk) => ({
          page: chunk.page,
          text: chunk.text,
          embedding: chunk.embedding,
        })),
      });
    }
  }

  const ready = {
    ...readyToIndex,
    status: "ready" as const,
    error: undefined,
  };
  await persistDocument(ready);

  return ready;
}
