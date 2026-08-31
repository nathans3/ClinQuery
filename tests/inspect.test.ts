import { describe, expect, it } from "vitest";
import {
  isDigitalPage,
  pendingPagesFromExtracted,
  shouldSkipVisionOcr,
} from "@/lib/ocr/inspect";

describe("isDigitalPage", () => {
  it("treats a real paragraph as digital", () => {
    const text =
      "This loan estimate lists the interest rate, monthly payment, and estimated closing costs for the borrower.";

    expect(isDigitalPage(text)).toBe(true);
  });

  it("treats a numeric table page as digital", () => {
    const text =
      "Principal 320000.00 Interest 1847.22 Taxes 412.00 Insurance 98.50 HOA 0.00 Total monthly 2357.72";

    expect(isDigitalPage(text)).toBe(true);
  });

  it("treats a short or empty page as scanned", () => {
    expect(isDigitalPage("")).toBe(false);
    expect(isDigitalPage("   12  ")).toBe(false);
  });

  it("treats glyph garbage as scanned", () => {
    expect(isDigitalPage("//// #### @@@@ %%%% ~~~~ {{{{ }}}}")).toBe(false);
  });
});

describe("shouldSkipVisionOcr", () => {
  it("skips vision when the document already has a text layer", () => {
    expect(
      shouldSkipVisionOcr([
        "A complete digital paragraph about income, assets, and liabilities for underwriting review.",
        "",
        "Another usable text layer with more than forty characters of English prose.",
      ]),
    ).toBe(true);
  });

  it("keeps vision for a true scan with no text layer", () => {
    expect(shouldSkipVisionOcr(["", "   ", "12"])).toBe(false);
  });
});

describe("pendingPagesFromExtracted", () => {
  it("does not queue vision when the file already has digital text", () => {
    const pages = [
      "A complete digital paragraph about income, assets, and liabilities for underwriting review.",
      "",
      "Another usable text layer with more than forty characters of English prose.",
    ];

    expect(pendingPagesFromExtracted(pages)).toEqual([]);
  });

  it("queues every empty page when nothing was extracted", () => {
    expect(pendingPagesFromExtracted(["", "  "])).toEqual([1, 2]);
  });
});
