import { MIN_DIGITAL_CHARS } from "@/lib/types";

/** Addy's pdf2json shortcut: if the file already has this much text, skip OCR. */
const MIN_DOCUMENT_CHARS_TO_SKIP_VISION = 50;
const MAX_JUNK_RATIO = 0.4;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function junkRatio(text: string): number {
  if (!text) {
    return 1;
  }

  const junkCount = (text.match(/[/#@%~{}[\]|<>*_=~]/g) ?? []).length;

  return junkCount / text.length;
}

/**
 * Born-digital pages have a usable text layer. Only empty pages and
 * broken-font glyph soup should go to vision OCR.
 */
export function isDigitalPage(text: string, minChars = MIN_DIGITAL_CHARS): boolean {
  const cleaned = collapseWhitespace(text);

  if (cleaned.length < minChars) {
    return false;
  }

  return junkRatio(cleaned) <= MAX_JUNK_RATIO;
}

/**
 * Match Addy's local-PDF path: if the file already has real extracted text,
 * do not spend time or money on vision OCR for cover pages or sparse pages.
 */
export function shouldSkipVisionOcr(pageTexts: string[]): boolean {
  const combined = collapseWhitespace(pageTexts.join("\n"));

  if (combined.length >= MIN_DOCUMENT_CHARS_TO_SKIP_VISION && isDigitalPage(combined, MIN_DOCUMENT_CHARS_TO_SKIP_VISION)) {
    return true;
  }

  return pageTexts.some((text) => isDigitalPage(text));
}

export function pendingPagesFromExtracted(
  pageTexts: string[],
  minChars = MIN_DIGITAL_CHARS,
): number[] {
  if (shouldSkipVisionOcr(pageTexts)) {
    return [];
  }

  return pageTexts
    .map((text, index) => (isDigitalPage(text, minChars) ? -1 : index + 1))
    .filter((page) => page > 0);
}
