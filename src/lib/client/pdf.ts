import { isDigitalPage } from "@/lib/ocr/inspect";
import { installPdfJsPolyfills } from "@/lib/client/streams-polyfill";

const PDF_LOAD_OPTIONS = {
  disableStream: true,
  disableRange: true,
  disableAutoFetch: true,
  isEvalSupported: false,
  useWorkerFetch: false,
  stopAtErrors: false,
} as const;

async function loadPdfJs() {
  installPdfJsPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  return pdfjs;
}

async function toUint8Array(file: File | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }

  return file instanceof Uint8Array ? file : new Uint8Array(file);
}

export async function loadPdfFromUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not load the PDF file.");
  }

  return loadPdf(new Uint8Array(await response.arrayBuffer()));
}

export async function loadPdf(file: File | ArrayBuffer | Uint8Array) {
  const pdfjs = await loadPdfJs();
  const bytes = await toUint8Array(file);
  const data = new Uint8Array(bytes.byteLength);
  data.set(bytes);

  return pdfjs.getDocument({
    data,
    ...PDF_LOAD_OPTIONS,
  }).promise;
}

function multiplyTransform(left: number[], right: number[]): number[] {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

export async function appendPdfTextLayer(
  page: {
    getTextContent: () => Promise<{
      items: Array<{ str?: string; transform: number[] } | { type?: string }>;
    }>;
  },
  viewport: { transform: number[] },
  container: HTMLElement,
): Promise<HTMLElement> {
  const textContent = await page.getTextContent();
  const layer = document.createElement("div");
  layer.className = "pdf-text-layer";

  for (const item of textContent.items) {
    if (!("str" in item) || !item.str || !("transform" in item)) {
      continue;
    }

    const transform = multiplyTransform(viewport.transform, item.transform);
    const height = Math.hypot(transform[2], transform[3]);
    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.left = `${transform[4]}px`;
    span.style.top = `${transform[5] - height}px`;
    span.style.fontSize = `${Math.max(1, height)}px`;
    layer.append(span);
  }

  container.append(layer);

  return layer;
}

type LoadedPdf = Awaited<ReturnType<typeof loadPdf>>;

export async function renderPdfPageFromDoc(
  pdf: LoadedPdf,
  pageNumber: number,
  scale = 1.15,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create a canvas to render this page.");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function renderPdfPage(
  file: File | ArrayBuffer,
  pageNumber: number,
  scale = 1.15,
): Promise<string> {
  const pdf = await loadPdf(file);

  return renderPdfPageFromDoc(pdf, pageNumber, scale);
}

export async function extractPdfPageTextFromDoc(
  pdf: LoadedPdf,
  pageNumber: number,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();

  return content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractPdfPageText(
  file: File | ArrayBuffer,
  pageNumber: number,
): Promise<string> {
  const pdf = await loadPdf(file);

  return extractPdfPageTextFromDoc(pdf, pageNumber);
}

export async function shouldSendVisionPage(
  file: File,
  pageNumber: number,
): Promise<{ text: string; needsVision: boolean }> {
  const text = await extractPdfPageText(file, pageNumber);

  return {
    text,
    needsVision: !isDigitalPage(text),
  };
}
