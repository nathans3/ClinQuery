"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument } from "@/lib/client/api";
import { escapeRegExp, highlightText } from "@/lib/client/highlight";
import { appendPdfTextLayer, loadPdfFromUrl } from "@/lib/client/pdf";
import { installPdfJsPolyfills } from "@/lib/client/streams-polyfill";
import type { DocumentRecord } from "@/lib/types";

interface DocumentViewerProps {
  docId: string;
  page: number;
  search: string;
}

function fileUrl(docId: string, page: number): string {
  return `/api/documents/${docId}/file#page=${page}`;
}

function showNativePdf(container: HTMLElement, docId: string, page: number) {
  const frame = document.createElement("iframe");
  frame.className = "pdf-native-frame";
  frame.title = "Document";
  frame.src = fileUrl(docId, page);
  container.append(frame);
}

export function DocumentViewer({
  docId,
  page,
  search,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    if (!docId) {
      return;
    }

    getDocument(docId)
      .then(setDocumentRecord)
      .catch((cause: unknown) => {
        setLoadError(
          cause instanceof Error ? cause.message : "Could not load document.",
        );
      });
  }, [docId]);

  useEffect(() => {
    if (!documentRecord || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";
    let cancelled = false;

    const jumpToCitation = (target: HTMLElement | null) => {
      const highlighted = target?.querySelector("mark");
      (highlighted ?? target)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };

    const renderPdfPage = async (
      pdf: Awaited<ReturnType<typeof loadPdfFromUrl>>,
      pageNumber: number,
      availableWidth: number,
    ) => {
      const pdfPage = await pdf.getPage(pageNumber);
      const unscaled = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(2, availableWidth / unscaled.width);
      const viewport = pdfPage.getViewport({ scale });
      const pageWrap = document.createElement("div");
      pageWrap.className = "pdf-page";
      pageWrap.dataset.page = String(pageNumber);
      pageWrap.id = `page-${pageNumber}`;
      pageWrap.style.width = `${viewport.width}px`;
      pageWrap.style.height = `${viewport.height}px`;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pageWrap.append(canvas);

      if (context) {
        await pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;
      }

      try {
        const textLayer = await appendPdfTextLayer(pdfPage, viewport, pageWrap);

        if (pageNumber === page && search) {
          highlightText(textLayer, search);
        }
      } catch {
        // The page image still renders if the text layer is unavailable.
      }

      return pageWrap;
    };

    const render = async () => {
      if (documentRecord.mimeType === "application/pdf") {
        installPdfJsPolyfills();
        const targetPage = Math.max(1, page);

        try {
          const pdf = await loadPdfFromUrl(
            `/api/documents/${documentRecord.id}/file`,
          );
          const availableWidth = Math.max(280, container.clientWidth || 720);
          const safePage = Math.min(targetPage, pdf.numPages);
          const first = await renderPdfPage(pdf, safePage, availableWidth);

          if (cancelled) {
            return;
          }

          container.append(first);
          jumpToCitation(first);

          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            if (cancelled || pageNumber === safePage) {
              continue;
            }

            try {
              const next = await renderPdfPage(pdf, pageNumber, availableWidth);

              if (cancelled) {
                return;
              }

              const pages = [
                ...container.querySelectorAll<HTMLElement>(".pdf-page"),
              ];
              const insertBefore = pages.find(
                (item) => Number(item.dataset.page) > pageNumber,
              );

              if (insertBefore) {
                container.insertBefore(next, insertBefore);
              } else {
                container.append(next);
              }
            } catch {
              // Keep going so the cited page stays visible.
            }
          }

          jumpToCitation(container.querySelector(`#page-${safePage}`));
        } catch {
          if (!cancelled) {
            showNativePdf(container, documentRecord.id, targetPage);
          }
        }

        return;
      }

      if (documentRecord.mimeType.startsWith("image/")) {
        const image = document.createElement("img");
        image.src = `/api/documents/${documentRecord.id}/file`;
        image.alt = documentRecord.name;
        image.className = "viewer-image";
        container.append(image);

        return;
      }

      const article = document.createElement("article");
      article.className = "viewer-text";
      const source = documentRecord.pages
        .map(
          (item) =>
            `<h2 id="page-${item.page}">Page ${item.page}</h2>${item.markdown}`,
        )
        .join("\n\n");
      article.innerHTML = search
        ? source.replace(
            new RegExp(escapeRegExp(search), "ig"),
            (match) => `<mark class="pdf-highlight">${match}</mark>`,
          )
        : source;
      container.append(article);
      jumpToCitation(
        article.querySelector("mark") ??
          article.querySelector(`#page-${page}`),
      );
    };

    render().catch((renderError: unknown) => {
      if (!cancelled) {
        setLoadError(
          renderError instanceof Error
            ? renderError.message
            : "Could not render document.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentRecord, page, search]);

  return (
    <>
      {loadError ? <p className="banner">{loadError}</p> : null}
      <div ref={containerRef} className="viewer-body" />
    </>
  );
}
