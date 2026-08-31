import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/types";

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export interface TextChunk {
  page: number;
  text: string;
}

function splitBySeparator(text: string, separator: string): string[] {
  if (!separator) {
    return text.split("");
  }

  return text.split(separator);
}

function joinPieces(pieces: string[], separator: string): string {
  return pieces.join(separator);
}

function splitRecursive(
  text: string,
  chunkSize: number,
  separators: string[],
): string[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= chunkSize) {
    return [trimmed];
  }

  const [separator, ...rest] = separators;
  const pieces = splitBySeparator(trimmed, separator);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const piece of pieces) {
    const candidate = joinPieces([...current, piece], separator);

    if (candidate.length <= chunkSize) {
      current.push(piece);
      continue;
    }

    if (current.length > 0) {
      chunks.push(joinPieces(current, separator).trim());
      current = [];
    }

    if (piece.length > chunkSize && rest.length > 0) {
      chunks.push(...splitRecursive(piece, chunkSize, rest));
      continue;
    }

    current.push(piece);
  }

  if (current.length > 0) {
    chunks.push(joinPieces(current, separator).trim());
  }

  return chunks.filter(Boolean);
}

function overlapChunks(
  chunks: string[],
  overlap: number,
  separator: string,
): string[] {
  if (chunks.length <= 1 || overlap <= 0) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }

    const previous = chunks[index - 1];
    const prefix = previous.slice(Math.max(0, previous.length - overlap)).trim();

    if (!prefix) {
      return chunk;
    }

    return `${prefix}${separator}${chunk}`.trim();
  });
}

function splitPreservingTables(text: string): string[] {
  const tableBlock = /(^\|.+\|$\n^\| ?[-:| ]+\|$\n(?:^\|.+\|$\n?)*)/gm;
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tableBlock)) {
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    parts.push(match[0]);
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.filter((part) => part.trim().length > 0);
}

export function chunkPageText(
  text: string,
  page: number,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): TextChunk[] {
  const blocks = splitPreservingTables(text);
  const chunks: TextChunk[] = [];

  for (const block of blocks) {
    if (block.includes("| ---") || block.trim().startsWith("|")) {
      chunks.push({ page, text: block.trim() });
      continue;
    }

    const parts = overlapChunks(
      splitRecursive(block, chunkSize, SEPARATORS),
      overlap,
      " ",
    );
    chunks.push(...parts.map((part) => ({ page, text: part })));
  }

  return chunks;
}

export function chunkDocumentPages(
  pages: Array<{ page: number; markdown: string }>,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): TextChunk[] {
  return pages.flatMap((page) =>
    chunkPageText(page.markdown, page.page, chunkSize, overlap),
  );
}
