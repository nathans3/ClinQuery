"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { SourcesSidebar } from "@/components/SourcesSidebar";
import { ViewerModal } from "@/components/ViewerModal";
import { mapPool } from "@/lib/async-pool";
import { isDigitalPage } from "@/lib/ocr/inspect";
import { OCR_PAGE_CONCURRENCY } from "@/lib/models";
import { hasIndexableText } from "@/lib/rag/index-ready";
import {
  fetchSuggestions,
  getDocument,
  indexDocument,
  listDocuments,
  ocrPage,
  streamChat,
  uploadDocument,
} from "@/lib/client/api";
import {
  extractPdfPageTextFromDoc,
  loadPdf,
  renderPdfPageFromDoc,
} from "@/lib/client/pdf";
import type { ChatMessage, Citation, DocumentRecord, DocumentSummary } from "@/lib/types";

function toSummary(document: {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number;
  status: DocumentSummary["status"];
  createdAt: string;
}): DocumentSummary {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    pageCount: document.pageCount,
    status: document.status,
    createdAt: document.createdAt,
  };
}

async function processPendingPages(
  file: File,
  documentId: string,
  onUpdate: (document: DocumentRecord) => void,
) {
  let current = await getDocument(documentId);

  if (current.cached || current.status === "ready") {
    return current;
  }

  if (hasIndexableText(current.pages)) {
    current = await indexDocument(documentId);
    onUpdate(current);

    return current;
  }

  if (current.pendingPages.length === 0) {
    current = await indexDocument(documentId);
    onUpdate(current);

    return current;
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const pdf = isPdf ? await loadPdf(file) : null;
  const pending = [...current.pendingPages];
  let pdfLock: Promise<void> = Promise.resolve();

  const withPdfLock = async <T,>(work: () => Promise<T>): Promise<T> => {
    const previous = pdfLock;
    let release = () => {};
    pdfLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  };

  const runPage = async (page: number) => {
    let text = current.pages.find((item) => item.page === page)?.markdown ?? "";
    let imageBase64: string | undefined;

    if (pdf) {
      try {
        const extracted = await withPdfLock(() =>
          extractPdfPageTextFromDoc(pdf, page),
        );

        if (extracted) {
          text = extracted;
        }
      } catch {
        // Fall through to a rendered page.
      }
    }

    if (pdf && !isDigitalPage(text)) {
      try {
        imageBase64 = await withPdfLock(() => renderPdfPageFromDoc(pdf, page));
      } catch {
        imageBase64 = undefined;
      }
    }

    try {
      current = await ocrPage(documentId, { page, text, imageBase64 });
      onUpdate(current);
    } catch (pageError) {
      console.error(`Page ${page} OCR failed`, pageError);

      try {
        current = await ocrPage(documentId, { page, text });
        onUpdate(current);
      } catch {
        // Indexing will use whatever text is already stored for this page.
      }
    }
  };

  const [firstPage, ...remainingPages] = pending;
  await runPage(firstPage);
  current = await indexDocument(documentId);
  onUpdate(current);

  if (remainingPages.length === 0) {
    return current;
  }

  void mapPool(remainingPages, OCR_PAGE_CONCURRENCY, runPage)
    .then(async () => {
      const refreshed = await indexDocument(documentId, { refresh: true });
      onUpdate(refreshed);
    })
    .catch((error: unknown) => {
      console.error("Background OCR failed", error);
    });

  return current;
}

export function ChatApp() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listDocuments()
      .then((items) => {
        setDocuments(items);
        setSelectedIds(items.filter((item) => item.status === "ready").map((item) => item.id));
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load documents.");
      });
  }, []);

  const upsertDocument = useCallback((next: DocumentSummary) => {
    setDocuments((current) => [
      next,
      ...current.filter((item) => item.id !== next.id),
    ]);
  }, []);

  const handleUpload = useCallback(
    async (files: FileList) => {
      setIsUploading(true);
      setError(null);
      const jobs: Array<{ file: File; document: DocumentRecord }> = [];

      try {
        for (const file of Array.from(files)) {
          const created = await uploadDocument(file);
          upsertDocument(toSummary(created));
          setSelectedIds((current) =>
            current.includes(created.id) ? current : [...current, created.id],
          );
          jobs.push({ file, document: created });
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Upload or OCR failed.",
        );
        setIsUploading(false);

        return;
      }

      setIsUploading(false);

      for (const job of jobs) {
        if (job.document.cached || job.document.status === "ready") {
          continue;
        }

        try {
          await processPendingPages(job.file, job.document.id, (document) => {
            upsertDocument(toSummary(document));
          });
        } catch (processError) {
          setError(
            processError instanceof Error
              ? processError.message
              : "Upload or OCR failed.",
          );
        }
      }
    },
    [upsertDocument],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const history = messages;
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        citations: [],
      };

      setMessages([...history, userMessage, assistantMessage]);
      setSuggestions([]);
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          text,
          selectedIds,
          history,
          {
            onChunk: (chunk) => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id
                    ? { ...message, content: message.content + chunk }
                    : message,
                ),
              );
            },
            onCitations: (citations, rewritten) => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id
                    ? {
                        ...message,
                        citations,
                        content: rewritten ?? message.content,
                      }
                    : message,
                ),
              );
            },
            onError: (message) => {
              setError(message);
            },
          },
          controller.signal,
        );

        const last = await new Promise<string>((resolve) => {
          setMessages((current) => {
            const found = current.find((item) => item.id === assistantMessage.id);
            resolve(found?.content ?? "");

            return current;
          });
        });

        if (last) {
          const nextSuggestions = await fetchSuggestions(
            last,
            [...history, userMessage].map((item) => item.content),
          );
          setSuggestions(nextSuggestions);
        }
      } catch (chatError) {
        if ((chatError as Error).name !== "AbortError") {
          setError(chatError instanceof Error ? chatError.message : "Chat failed.");
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, selectedIds],
  );

  return (
    <main className="app-page">
      <div className="app-shell">
        <SourcesSidebar
          documents={documents}
          selectedIds={selectedIds}
          isUploading={isUploading}
          onToggle={(id) => {
            setSelectedIds((current) =>
              current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current, id],
            );
          }}
          onToggleAll={() => {
            setSelectedIds((current) =>
              current.length === documents.length
                ? []
                : documents.map((item) => item.id),
            );
          }}
          onUpload={handleUpload}
        />
        <div className="chat-wrap">
          {error ? <div className="banner">{error}</div> : null}
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            canSend={selectedIds.some(
              (id) => documents.find((item) => item.id === id)?.status === "ready",
            )}
            hasSelectedSources={selectedIds.length > 0}
            suggestions={suggestions}
            onSend={handleSend}
            onStop={() => abortRef.current?.abort()}
            onOpenCitation={setOpenCitation}
          />
        </div>
      </div>
      {openCitation ? (
        <ViewerModal
          citation={openCitation}
          onClose={() => setOpenCitation(null)}
        />
      ) : null}
    </main>
  );
}
