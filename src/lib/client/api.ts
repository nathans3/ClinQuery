import type {
  ChatMessage,
  Citation,
  DocumentRecord,
  DocumentSummary,
} from "@/lib/types";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };

    return body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch("/api/documents");

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const body = (await response.json()) as { documents: DocumentSummary[] };

  return body.documents;
}

export async function getDocument(id: string): Promise<DocumentRecord> {
  const response = await fetch(`/api/documents/${id}`);

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as DocumentRecord;
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/documents", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as DocumentRecord;
}

export async function ocrPage(
  id: string,
  payload: { page: number; text?: string; imageBase64?: string },
): Promise<DocumentRecord> {
  const response = await fetch(`/api/documents/${id}/ocr-page`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as DocumentRecord;
}

export async function indexDocument(
  id: string,
  options?: { refresh?: boolean },
): Promise<DocumentRecord> {
  const query = options?.refresh ? "?refresh=1" : "";
  const response = await fetch(`/api/documents/${id}/index${query}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as DocumentRecord;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onCitations: (citations: Citation[], rewritten?: string) => void;
  onError: (message: string) => void;
}

export async function streamChat(
  query: string,
  documentIds: string[],
  history: ChatMessage[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ query, documentIds, history }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(await readError(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const eventMatch = part.match(/^event: (.+)$/m);
      const dataMatch = part.match(/^data: (.+)$/m);

      if (!eventMatch || !dataMatch) {
        continue;
      }

      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]) as {
        text?: string;
        citations?: Citation[];
        message?: string;
      };

      if (event === "chunk" && data.text) {
        handlers.onChunk(data.text);
      }

      if (event === "citations" && data.citations) {
        handlers.onCitations(data.citations, data.text);
      }

      if (event === "error" && data.message) {
        handlers.onError(data.message);
      }
    }
  }
}

export async function fetchSuggestions(
  lastResponse: string,
  previousQuestions: string[],
): Promise<string[]> {
  const response = await fetch("/api/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lastResponse, previousQuestions }),
  });

  if (!response.ok) {
    return [];
  }

  const body = (await response.json()) as { suggestions?: string[] };

  return body.suggestions ?? [];
}
