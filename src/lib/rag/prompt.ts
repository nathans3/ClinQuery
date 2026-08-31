import type { ChatMessage, RetrievedChunk } from "@/lib/types";

export function buildContextBlock(retrieved: RetrievedChunk[]): string {
  if (retrieved.length === 0) {
    return "No matching document passages were found.";
  }

  return retrieved
    .map((item) => {
      return `[${item.index}] ${item.chunk.title} (page ${item.chunk.page})\n${item.chunk.text}`;
    })
    .join("\n\n");
}

export function buildSystemPrompt(context: string): string {
  return `You are a document Q&A assistant. Answer only from the numbered context passages.

Rules:
- You may only cite a numeric value that appears in the context (percents, counts, money, doses).
- Put a NEW citation number immediately after that figure: 52.2% [1] then 64.3% [2]. Never reuse [1] for a different number.
- [N] must be the context passage that contains that exact figure. If 52.2% is in [3], cite [3], not a passage that only has 64.3%.
- Never cite words or a whole sentence. If there is no number, do not add [N].
- If the context does not contain the answer, say you cannot find it in the selected documents.
- If a table is in the context, preserve the relevant rows in Markdown.
- Prefer short, direct answers. Use Markdown when it helps.

Context:
${context}`;
}

export function toOpenAIMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userQuery: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const recent = history.slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [
    { role: "system", content: systemPrompt },
    ...recent,
    { role: "user", content: userQuery },
  ];
}
