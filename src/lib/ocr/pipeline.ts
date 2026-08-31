import { isDigitalPage, pendingPagesFromExtracted } from "@/lib/ocr/inspect";
import { cleanMarkdown } from "@/lib/ocr/normalize";
import { ocrImageWithVision } from "@/lib/ocr/vision";
import type { OcrEngine, PageRecord } from "@/lib/types";

export async function processPage(input: {
  page: number;
  text?: string;
  imageDataUrl?: string;
}): Promise<PageRecord> {
  if (input.text !== undefined && isDigitalPage(input.text)) {
    return {
      page: input.page,
      engine: "lite",
      markdown: cleanMarkdown(input.text),
    };
  }

  if (input.imageDataUrl) {
    const markdown = await ocrImageWithVision(input.imageDataUrl);

    return {
      page: input.page,
      engine: "vision",
      markdown: cleanMarkdown(markdown),
    };
  }

  if (input.text !== undefined) {
    return {
      page: input.page,
      engine: "lite",
      markdown: cleanMarkdown(input.text),
    };
  }

  throw new Error("Page OCR needs extracted text or a page image.");
}

export function digitalPagesFromTexts(
  pageTexts: string[],
): { pages: PageRecord[]; pendingPages: number[] } {
  const pages: PageRecord[] = [];
  const pendingPages = pendingPagesFromExtracted(pageTexts);

  pageTexts.forEach((text, index) => {
    const page = index + 1;
    pages.push({
      page,
      engine: "lite" satisfies OcrEngine,
      markdown: cleanMarkdown(text),
    });
  });

  return { pages, pendingPages };
}
