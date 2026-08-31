import { jsonError } from "@/lib/http";
import { CHAT_MODEL, LUNA_REASONING_EFFORT } from "@/lib/models";
import { getOpenAI } from "@/lib/openai";
import { bindCitations } from "@/lib/rag/citations";
import { embedQuery } from "@/lib/rag/embeddings";
import { buildContextBlock, buildSystemPrompt, toOpenAIMessages } from "@/lib/rag/prompt";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { readChunksForDocs } from "@/lib/storage";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  query?: string;
  documentIds?: string[];
  history?: ChatMessage[];
}

function encodeEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatBody;
  const query = body.query?.trim() ?? "";
  const documentIds = body.documentIds ?? [];

  if (!query) {
    return jsonError("A question is required.");
  }

  if (documentIds.length === 0) {
    return jsonError("Select at least one document in the sources list.");
  }

  const chunks = await readChunksForDocs(documentIds);

  if (chunks.length === 0) {
    return jsonError("None of the selected documents are indexed yet.");
  }

  const queryEmbedding = await embedQuery(query);
  const retrieved = retrieveChunks(queryEmbedding, chunks, documentIds);
  const systemPrompt = buildSystemPrompt(buildContextBlock(retrieved));
  const messages = toOpenAIMessages(systemPrompt, body.history ?? [], query);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: CHAT_MODEL,
          reasoning_effort: LUNA_REASONING_EFFORT,
          max_completion_tokens: 2048,
          stream: true,
          messages,
        });

        let answer = "";

        for await (const part of completion) {
          const text = part.choices[0]?.delta?.content ?? "";

          if (!text) {
            continue;
          }

          answer += text;
          send("chunk", { text });
        }

        send("citations", {
          ...bindCitations(answer, retrieved, chunks),
        });
        send("done", {});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Chat failed.";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
