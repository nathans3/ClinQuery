import { RETRIEVE_TOP_K, type ChunkRecord, type RetrievedChunk } from "@/lib/types";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function retrieveChunks(
  queryEmbedding: number[],
  chunks: ChunkRecord[],
  selectedDocIds: string[],
  topK = RETRIEVE_TOP_K,
): RetrievedChunk[] {
  const allowed = new Set(selectedDocIds);
  const scored = chunks
    .filter((chunk) => allowed.has(chunk.docId))
    .map((chunk) => ({
      chunk: {
        id: chunk.id,
        docId: chunk.docId,
        title: chunk.title,
        page: chunk.page,
        text: chunk.text,
      },
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((item, index) => ({
    index: index + 1,
    chunk: item.chunk,
    score: item.score,
  }));
}
