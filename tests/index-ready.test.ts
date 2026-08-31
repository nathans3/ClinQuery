import { describe, expect, it } from "vitest";
import {
  hasIndexableText,
  shouldReuseExistingIndex,
} from "@/lib/rag/index-ready";

describe("hasIndexableText", () => {
  it("is true when any page has content", () => {
    expect(
      hasIndexableText([
        { page: 1, engine: "lite", markdown: "" },
        { page: 2, engine: "lite", markdown: "Loan estimate for the borrower." },
      ]),
    ).toBe(true);
  });

  it("is false when every page is blank", () => {
    expect(
      hasIndexableText([{ page: 1, engine: "lite", markdown: "   " }]),
    ).toBe(false);
  });
});

describe("shouldReuseExistingIndex", () => {
  it("reuses a finished document", () => {
    expect(
      shouldReuseExistingIndex({ status: "ready", pendingPages: [] }, 4),
    ).toBe(true);
  });

  it("rebuilds when vision OCR is still pending", () => {
    expect(
      shouldReuseExistingIndex({ status: "ready", pendingPages: [3] }, 4),
    ).toBe(false);
  });
});
