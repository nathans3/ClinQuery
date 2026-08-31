import { describe, expect, it } from "vitest";
import {
  bindCitations,
  buildCitations,
  claimBeforeCitation,
  excerptAround,
  figureImmediatelyBefore,
  parseCitationNumbers,
  pickSearchTerm,
} from "@/lib/rag/citations";
import type { RetrievedChunk } from "@/lib/types";

const retrieved: RetrievedChunk[] = [
  {
    index: 1,
    score: 0.9,
    chunk: {
      id: "c1",
      docId: "doc-1",
      title: "estimate.pdf",
      page: 2,
      text: "The interest rate is 6.5 percent and the monthly payment is 2,140. ORR was 64.3%.",
    },
  },
  {
    index: 2,
    score: 0.8,
    chunk: {
      id: "c2",
      docId: "doc-2",
      title: "letter.pdf",
      page: 6,
      text: "Participants with ORR 52.2% in the APaT population. N=251.",
    },
  },
];

describe("parseCitationNumbers", () => {
  it("collects unique citation numbers in order", () => {
    expect(parseCitationNumbers("Rate is 6.5% [1] and lock ends Friday [2] [1].")).toEqual([
      1, 2,
    ]);
  });
});

describe("figureImmediatelyBefore", () => {
  it("returns only the figure sitting next to the marker", () => {
    const answer = "ORR was 52.2% [1] versus 64.3% [1].";
    const matches = [...answer.matchAll(/\[(\d+)\]/g)];

    expect(figureImmediatelyBefore(answer, matches[0].index ?? 0)).toBe("52.2%");
    expect(figureImmediatelyBefore(answer, matches[1].index ?? 0)).toBe("64.3%");
  });
});

describe("claimBeforeCitation", () => {
  it("takes the clause immediately before the marker", () => {
    const answer = "The rate is 6.5% [1] and the payment is 2,140 [1].";
    const second = [...answer.matchAll(/\[(\d+)\]/g)][1];

    expect(claimBeforeCitation(answer, second.index ?? 0)).toContain("2,140");
    expect(claimBeforeCitation(answer, second.index ?? 0)).not.toContain("6.5");
  });
});

describe("pickSearchTerm", () => {
  it("returns the figure from the line that also appears in the chunk", () => {
    const term = pickSearchTerm(
      retrieved[0].chunk.text,
      "the monthly payment is 2,140",
    );

    expect(term).toContain("2,140");
  });

  it("does not cite words when the line has no number", () => {
    expect(
      pickSearchTerm(retrieved[1].chunk.text, "the lock expires on Friday"),
    ).toBe("");
  });
});

describe("excerptAround", () => {
  it("keeps the search term in the excerpt", () => {
    const excerpt = excerptAround(retrieved[0].chunk.text, "6.5");

    expect(excerpt).toContain("6.5");
  });
});

describe("bindCitations", () => {
  it("gives each figure its own number and the matching passage", () => {
    const bound = bindCitations(
      "ORR was 52.2% [1] versus 64.3% [1].",
      retrieved,
    );

    expect(bound.text).toBe("ORR was 52.2% [1] versus 64.3% [2].");
    expect(bound.citations).toHaveLength(2);
    expect(bound.citations[0]).toMatchObject({
      number: 1,
      searchTerm: "52.2%",
      pageNumber: 6,
    });
    expect(bound.citations[1]).toMatchObject({
      number: 2,
      searchTerm: "64.3%",
      pageNumber: 2,
    });
  });

  it("does not attach 64.3 to a 52.2% marker", () => {
    const citations = buildCitations("The rate was 52.2% [1].", retrieved);

    expect(citations).toHaveLength(1);
    expect(citations[0].searchTerm).toBe("52.2%");
    expect(citations[0].searchTerm).not.toContain("64.3");
  });

  it("skips a marker when that line has no number to cite", () => {
    const citations = buildCitations(
      "The lock expires on Friday [2].",
      retrieved,
    );

    expect(citations).toHaveLength(0);
  });

  it("keeps page and document metadata", () => {
    const citations = buildCitations(
      "The interest rate is 6.5 percent [1].",
      retrieved,
    );

    expect(citations[0]).toMatchObject({
      number: 1,
      documentId: "doc-1",
      documentName: "estimate.pdf",
      pageNumber: 2,
      searchTerm: "6.5",
    });
  });
});
