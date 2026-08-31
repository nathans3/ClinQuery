import { describe, expect, it } from "vitest";
import { chunkDocumentPages, chunkPageText } from "@/lib/rag/chunker";

describe("chunkPageText", () => {
  it("keeps short text as a single chunk with its page", () => {
    const chunks = chunkPageText("Short page text.", 3);

    expect(chunks).toEqual([{ page: 3, text: "Short page text." }]);
  });

  it("splits long text and keeps the page number", () => {
    const text = Array.from({ length: 40 }, (_, index) => `Sentence number ${index}.`).join(" ");
    const chunks = chunkPageText(text, 2, 80, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.page === 2)).toBe(true);
    expect(chunks.every((chunk) => chunk.text.length > 0)).toBe(true);
  });
});

describe("chunkDocumentPages", () => {
  it("chunks each page independently", () => {
    const chunks = chunkDocumentPages([
      { page: 1, markdown: "First page content that stays together." },
      { page: 2, markdown: "Second page content that also stays together." },
    ]);

    expect(chunks.map((chunk) => chunk.page)).toEqual([1, 2]);
  });

  it("keeps markdown tables as a single chunk", () => {
    const table = [
      "| Name | Amount |",
      "| --- | --- |",
      "| Principal | 1200 |",
      "| Interest | 80 |",
    ].join("\n");
    const chunks = chunkPageText(`Intro paragraph.\n\n${table}`, 4, 80, 10);
    const tableChunk = chunks.find((chunk) => chunk.text.includes("| Principal |"));

    expect(tableChunk?.page).toBe(4);
    expect(tableChunk?.text).toContain("| Interest | 80 |");
  });
});
