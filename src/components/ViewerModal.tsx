"use client";

import { useEffect } from "react";
import { DocumentViewer } from "@/components/DocumentViewer";
import type { Citation } from "@/lib/types";

interface ViewerModalProps {
  citation: Citation;
  onClose: () => void;
}

export function ViewerModal({ citation, onClose }: ViewerModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="viewer-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={citation.documentName}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="viewer-modal-header">
          <div>
            <p className="eyebrow">See in document</p>
            <h2>{citation.documentName}</h2>
            <p>
              Page {citation.pageNumber}
              {citation.searchTerm ? ` · highlighting “${citation.searchTerm}”` : ""}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="viewer-modal-body">
          <DocumentViewer
            key={`${citation.documentId}-${citation.pageNumber}-${citation.searchTerm}`}
            docId={citation.documentId}
            page={citation.pageNumber}
            search={citation.searchTerm}
          />
        </div>
      </div>
    </div>
  );
}
