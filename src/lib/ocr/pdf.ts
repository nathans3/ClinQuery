import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfPages(
  bytes: Uint8Array,
): Promise<{ pageCount: number; pageTexts: string[] }> {
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(extracted.text)
    ? extracted.text
    : [extracted.text];

  return {
    pageCount: extracted.totalPages || pageTexts.length,
    pageTexts:
      pageTexts.length >= (extracted.totalPages || pageTexts.length)
        ? pageTexts
        : [
            ...pageTexts,
            ...Array.from(
              { length: (extracted.totalPages || pageTexts.length) - pageTexts.length },
              () => "",
            ),
          ],
  };
}
