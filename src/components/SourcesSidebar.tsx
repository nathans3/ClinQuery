"use client";

import { useMemo, useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/types";

interface SourcesSidebarProps {
  documents: DocumentSummary[];
  selectedIds: string[];
  isUploading: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onUpload: (files: FileList) => void;
}

function statusLabel(status: DocumentSummary["status"]): string {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "indexing") {
    return "Indexing";
  }

  return "Reading";
}

export function SourcesSidebar({
  documents,
  selectedIds,
  isUploading,
  onToggle,
  onToggleAll,
  onUpload,
}: SourcesSidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const selectedCount = selectedIds.length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return documents;
    }

    return documents.filter((item) => item.name.toLowerCase().includes(needle));
  }, [documents, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Sources</h1>
        <p>{selectedCount} selected</p>
      </div>

      <label className="source-search">
        <span className="sr-only">Search sources</span>
        <input
          type="search"
          placeholder="Search sources..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {documents.length > 0 ? (
        <div className="sidebar-toolbar">
          <button type="button" className="text-button select-all" onClick={onToggleAll}>
            <span className="select-all-box" aria-hidden="true">
              {selectedCount === documents.length && documents.length > 0 ? "✓" : ""}
            </span>
            {selectedCount === documents.length && documents.length > 0
              ? "Uncheck all"
              : "Select all"}
          </button>
        </div>
      ) : null}

      <ul className="source-list">
        {documents.length === 0 ? (
          <li className="empty-sources">
            Add a PDF, image, TXT, or Markdown file. Check the sources you want
            used in the answer.
          </li>
        ) : null}
        {visible.map((document) => {
          return (
            <li key={document.id} className="source-item">
              <label title={`${document.name} · ${statusLabel(document.status)}`}>
                <span className="file-icon" aria-hidden="true">
                  {document.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOC"}
                </span>
                <span className="file-name">{document.name}</span>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(document.id)}
                  onChange={() => onToggle(document.id)}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="upload-button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <span aria-hidden="true">+</span>
        {isUploading ? "Preparing document…" : "Add More"}
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.txt,.md,application/pdf,image/png,image/jpeg,text/plain,text/markdown"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            onUpload(event.target.files);
            event.target.value = "";
          }
        }}
      />
    </aside>
  );
}
