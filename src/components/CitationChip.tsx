"use client";

import type { Citation } from "@/lib/types";

interface CitationChipProps {
  citation: Citation;
  onOpen: (citation: Citation) => void;
}

export function CitationChip({ citation, onOpen }: CitationChipProps) {
  return (
    <span className="citation-wrap">
      <button
        type="button"
        className="citation-chip"
        aria-label={`Cited ${citation.searchTerm || "passage"} in ${citation.documentName}, page ${citation.pageNumber}`}
        title={`${citation.searchTerm || citation.documentName} · See in document`}
        onClick={() => onOpen(citation)}
      >
        {citation.number}
      </button>
      <span className="citation-hover" role="tooltip">
        <strong>{citation.searchTerm || citation.documentName}</strong>
        <span>
          {citation.documentName} · page {citation.pageNumber}
        </span>
        <span>See in document</span>
      </span>
    </span>
  );
}
