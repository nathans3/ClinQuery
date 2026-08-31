import type { DocumentRecord, PageRecord } from "@/lib/types";

export function hasIndexableText(pages: PageRecord[]): boolean {
  return pages.some((page) => page.markdown.replace(/\s+/g, " ").trim().length > 0);
}

export function shouldReuseExistingIndex(
  document: Pick<DocumentRecord, "status" | "pendingPages">,
  chunkCount: number,
): boolean {
  return (
    document.status === "ready" &&
    chunkCount > 0 &&
    document.pendingPages.length === 0
  );
}
