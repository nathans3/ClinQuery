import type { ChunkRecord, Citation, RetrievedChunk } from "@/lib/types";

const CITATION_RE = /\[(\d+)\]/g;
const FIGURE_RE = /\$?\d[\d,]*(?:\.\d+)?%?/g;

export function parseCitationNumbers(text: string): number[] {
  const numbers = new Set<number>();

  for (const match of text.matchAll(CITATION_RE)) {
    numbers.add(Number(match[1]));
  }

  return [...numbers].sort((a, b) => a - b);
}

export function figureImmediatelyBefore(
  answerText: string,
  matchIndex: number,
): string {
  const before = answerText.slice(Math.max(0, matchIndex - 48), matchIndex);
  const figures = [...before.matchAll(FIGURE_RE)];
  const last = figures[figures.length - 1]?.[0] ?? "";

  return last.trim();
}

export function claimBeforeCitation(answerText: string, matchIndex: number): string {
  const windowStart = Math.max(0, matchIndex - 180);
  let slice = answerText.slice(windowStart, matchIndex).replace(/\[\d+\]/g, " ");
  const lastBreak = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf(": "),
  );

  if (lastBreak >= 0) {
    slice = slice.slice(lastBreak + 1);
  }

  const andParts = slice.split(/\s+and\s+/i);

  if (andParts.length > 1 && andParts[andParts.length - 1].trim().length > 0) {
    slice = andParts[andParts.length - 1];
  }

  return slice.replace(/\s+/g, " ").trim();
}

function normalizeFigure(value: string): string {
  return value.replace(/[$,%\s]/g, "");
}

export function figureInChunk(chunkText: string, figure: string): string | null {
  if (!figure) {
    return null;
  }

  if (chunkText.includes(figure)) {
    return figure;
  }

  const compactFigure = normalizeFigure(figure);

  if (compactFigure.length < 1) {
    return null;
  }

  const chunkFigures = chunkText.match(FIGURE_RE) ?? [];

  for (const candidate of chunkFigures) {
    if (normalizeFigure(candidate) === compactFigure) {
      return candidate;
    }
  }

  return null;
}

export function pickSearchTerm(chunkText: string, answerText: string): string {
  const figures = answerText.match(FIGURE_RE) ?? [];
  const figure = figures[figures.length - 1] ?? "";

  return figureInChunk(chunkText, figure) ?? "";
}

function toRetrieved(chunk: ChunkRecord, index: number): RetrievedChunk {
  return {
    index,
    score: 0,
    chunk: {
      id: chunk.id,
      docId: chunk.docId,
      title: chunk.title,
      page: chunk.page,
      text: chunk.text,
    },
  };
}

export function findChunkForFigure(
  figure: string,
  preferredIndex: number,
  retrieved: RetrievedChunk[],
  allChunks: ChunkRecord[] = [],
): RetrievedChunk | null {
  const preferred = retrieved.find((item) => item.index === preferredIndex);

  if (preferred && figureInChunk(preferred.chunk.text, figure)) {
    return preferred;
  }

  const fromRetrieved = retrieved.find((item) =>
    figureInChunk(item.chunk.text, figure),
  );

  if (fromRetrieved) {
    return fromRetrieved;
  }

  const match = allChunks.find((chunk) => figureInChunk(chunk.text, figure));

  if (!match) {
    return null;
  }

  return toRetrieved(match, preferredIndex || retrieved.length + 1);
}

export function excerptAround(text: string, searchTerm: string, radius = 90): string {
  const located = figureInChunk(text, searchTerm) ?? searchTerm;
  const lower = text.toLowerCase();
  const index = lower.indexOf(located.toLowerCase());

  if (index === -1) {
    return text.replace(/\s+/g, " ").trim().slice(0, radius * 2);
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + located.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";

  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

export function bindCitations(
  answerText: string,
  retrieved: RetrievedChunk[],
  allChunks: ChunkRecord[] = [],
): { text: string; citations: Citation[] } {
  const citations: Citation[] = [];
  let output = "";
  let cursor = 0;
  let nextNumber = 1;

  for (const match of answerText.matchAll(CITATION_RE)) {
    const start = match.index ?? 0;
    output += answerText.slice(cursor, start);

    const modelIndex = Number(match[1]);
    const figure = figureImmediatelyBefore(answerText, start);
    const hit = figure
      ? findChunkForFigure(figure, modelIndex, retrieved, allChunks)
      : null;

    if (!figure || !hit) {
      cursor = start + match[0].length;
      continue;
    }

    const searchTerm = figureInChunk(hit.chunk.text, figure) ?? figure;

    citations.push({
      id: `citation-${nextNumber}`,
      number: nextNumber,
      documentId: hit.chunk.docId,
      documentName: hit.chunk.title,
      excerpt: excerptAround(hit.chunk.text, searchTerm),
      pageNumber: hit.chunk.page,
      searchTerm,
    });
    output += `[${nextNumber}]`;
    nextNumber += 1;
    cursor = start + match[0].length;
  }

  output += answerText.slice(cursor);

  return { text: output, citations };
}

export function buildCitations(
  answerText: string,
  retrieved: RetrievedChunk[],
  allChunks: ChunkRecord[] = [],
): Citation[] {
  return bindCitations(answerText, retrieved, allChunks).citations;
}
