import { describe, expect, it } from "vitest";
import { cosineSimilarity, retrieveChunks } from "@/lib/rag/retrieve";
import type { ChunkRecord } from "@/lib/types";

function chunk(
  id: string,
  docId: string,
  embedding: number[],
  text = id,
): ChunkRecord {
  return {
    id,
    docId,
    title: `${docId}.pdf`,
    page: 1,
    text,
    embedding,
  };
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("retrieveChunks", () => {
  const chunks = [
    chunk("a", "doc-1", [1, 0, 0], "interest rate is 6.5 percent"),
    chunk("b", "doc-1", [0.1, 0.9, 0], "borrower lives in Austin"),
    chunk("c", "doc-2", [0.95, 0.05, 0], "rate lock expires Friday"),
  ];

  it("ranks by similarity and keeps only selected docs", () => {
    const results = retrieveChunks([1, 0, 0], chunks, ["doc-1"], 5);

    expect(results.map((item) => item.chunk.id)).toEqual(["a", "b"]);
    expect(results[0].index).toBe(1);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("does not return chunks from unchecked documents", () => {
    const results = retrieveChunks([1, 0, 0], chunks, ["doc-2"], 5);

    expect(results.map((item) => item.chunk.id)).toEqual(["c"]);
  });
});
