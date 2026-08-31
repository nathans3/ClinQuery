export type DocumentStatus =
  | "pending"
  | "ocr"
  | "indexing"
  | "ready"
  | "failed";

export type OcrEngine = "lite" | "vision";

export interface PageRecord {
  page: number;
  engine: OcrEngine;
  markdown: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number;
  status: DocumentStatus;
  pages: PageRecord[];
  pendingPages: number[];
  contentHash?: string;
  cached?: boolean;
  error?: string;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number;
  status: DocumentStatus;
  createdAt: string;
}

export interface ChunkRecord {
  id: string;
  docId: string;
  title: string;
  page: number;
  text: string;
  embedding: number[];
}

export interface RetrievedChunk {
  index: number;
  chunk: Omit<ChunkRecord, "embedding">;
  score: number;
}

export interface Citation {
  id: string;
  number: number;
  documentId: string;
  documentName: string;
  excerpt: string;
  pageNumber: number;
  searchTerm: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export interface ProcessCache {
  contentHash: string;
  mimeType: string;
  pageCount: number;
  pages: PageRecord[];
  chunks: Array<{
    page: number;
    text: string;
    embedding: number[];
  }>;
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MIN_DIGITAL_CHARS = 40;
export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;
export const RETRIEVE_TOP_K = 16;
