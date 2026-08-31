import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { put, del, list } from "@vercel/blob";
import type {
  ChunkRecord,
  DocumentRecord,
  DocumentSummary,
  ProcessCache,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");

function usesBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function fileKey(id: string): string {
  return `docs/${id}/file`;
}

function metaKey(id: string): string {
  return `docs/${id}/meta.json`;
}

function chunksKey(id: string): string {
  return `docs/${id}/chunks.json`;
}

function cachePayloadKey(hash: string): string {
  return `cache/${hash}/payload.json`;
}

function cacheFileKey(hash: string): string {
  return `cache/${hash}/file`;
}

function localPath(key: string): string {
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, key);
}

async function writeLocal(key: string, body: Buffer | string): Promise<void> {
  const fullPath = localPath(key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
}

async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ localPath(key));
  } catch {
    return null;
  }
}

async function deleteLocal(key: string): Promise<void> {
  try {
    await unlink(localPath(key));
  } catch {
    // Missing files are fine during cleanup.
  }
}

async function writeBytes(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!usesBlob()) {
    await writeLocal(key, body);

    return;
  }

  await put(key, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value, null, 2);

  if (!usesBlob()) {
    await writeLocal(key, payload);

    return;
  }

  await put(key, payload, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readBytes(key: string): Promise<Buffer | null> {
  if (!usesBlob()) {
    return readLocal(key);
  }

  const listed = await list({ prefix: key });
  const match = listed.blobs.find((item) => item.pathname === key);

  if (!match) {
    return null;
  }

  const response = await fetch(match.url);

  if (!response.ok) {
    return null;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function readJson<T>(key: string): Promise<T | null> {
  const bytes = await readBytes(key);

  if (!bytes) {
    return null;
  }

  return JSON.parse(bytes.toString("utf8")) as T;
}

export async function saveDocumentFile(
  id: string,
  bytes: Buffer,
  mimeType: string,
): Promise<void> {
  await writeBytes(fileKey(id), bytes, mimeType);
}

export async function readDocumentFile(id: string): Promise<Buffer | null> {
  return readBytes(fileKey(id));
}

export async function saveDocument(record: DocumentRecord): Promise<void> {
  await writeJson(metaKey(record.id), record);
}

export async function readDocument(id: string): Promise<DocumentRecord | null> {
  return readJson<DocumentRecord>(metaKey(id));
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  if (!usesBlob()) {
    const manifest = await readJson<DocumentSummary[]>("manifest.json");

    return (manifest ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const listed = await list({ prefix: "docs/" });
  const metas = listed.blobs.filter((item) => item.pathname.endsWith("/meta.json"));
  const records = await Promise.all(
    metas.map(async (item) => {
      const response = await fetch(item.url);

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as DocumentRecord;
    }),
  );

  return records
    .filter((item): item is DocumentRecord => Boolean(item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      pageCount: item.pageCount,
      status: item.status,
      createdAt: item.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function writeManifest(summaries: DocumentSummary[]): Promise<void> {
  await writeJson("manifest.json", summaries);
}

export async function upsertDocumentSummary(record: DocumentRecord): Promise<void> {
  if (usesBlob()) {
    return;
  }

  const current = (await readJson<DocumentSummary[]>("manifest.json")) ?? [];
  const summary: DocumentSummary = {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    pageCount: record.pageCount,
    status: record.status,
    createdAt: record.createdAt,
  };
  const next = [summary, ...current.filter((item) => item.id !== record.id)];
  await writeManifest(next);
}

export async function saveChunks(id: string, chunks: ChunkRecord[]): Promise<void> {
  await writeJson(chunksKey(id), chunks);
}

export async function readChunks(id: string): Promise<ChunkRecord[]> {
  return (await readJson<ChunkRecord[]>(chunksKey(id))) ?? [];
}

export async function readChunksForDocs(docIds: string[]): Promise<ChunkRecord[]> {
  const groups = await Promise.all(docIds.map((id) => readChunks(id)));

  return groups.flat();
}

export async function deleteDocument(id: string): Promise<void> {
  if (usesBlob()) {
    const listed = await list({ prefix: `docs/${id}/` });
    await Promise.all(listed.blobs.map((item) => del(item.url)));

    return;
  }

  await Promise.all([
    deleteLocal(fileKey(id)),
    deleteLocal(metaKey(id)),
    deleteLocal(chunksKey(id)),
  ]);

  const current = (await readJson<DocumentSummary[]>("manifest.json")) ?? [];
  await writeManifest(current.filter((item) => item.id !== id));
}

export async function persistDocument(record: DocumentRecord): Promise<void> {
  await saveDocument(record);
  await upsertDocumentSummary(record);
}

export async function listDocumentRecords(): Promise<DocumentRecord[]> {
  const summaries = await listDocuments();
  const records = await Promise.all(summaries.map((item) => readDocument(item.id)));

  return records.filter((item): item is DocumentRecord => Boolean(item));
}

export async function findDocumentByHash(
  contentHash: string,
): Promise<DocumentRecord | null> {
  const records = await listDocumentRecords();
  const ready = records.find(
    (item) => item.contentHash === contentHash && item.status === "ready",
  );

  if (ready) {
    return ready;
  }

  return (
    records.find(
      (item) =>
        item.contentHash === contentHash &&
        item.status !== "failed",
    ) ?? null
  );
}

export async function readProcessCache(
  contentHash: string,
): Promise<ProcessCache | null> {
  return readJson<ProcessCache>(cachePayloadKey(contentHash));
}

export async function readCachedFile(contentHash: string): Promise<Buffer | null> {
  return readBytes(cacheFileKey(contentHash));
}

export async function saveProcessCache(
  contentHash: string,
  mimeType: string,
  bytes: Buffer,
  cache: Omit<ProcessCache, "contentHash" | "mimeType">,
): Promise<void> {
  await writeBytes(cacheFileKey(contentHash), bytes, mimeType);
  await writeJson(cachePayloadKey(contentHash), {
    contentHash,
    mimeType,
    ...cache,
  } satisfies ProcessCache);
}
