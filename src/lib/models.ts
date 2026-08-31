/**
 * GPT-5.6 Luna is OpenAI's cost-efficient high-volume model.
 * Override with OPENAI_CHAT_MODEL if needed.
 */
export const CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.6-luna";

/**
 * Vision OCR uses a small fast model by default. Chat stays on Luna.
 * Override with OPENAI_OCR_MODEL if you need higher OCR quality.
 */
export const OCR_MODEL =
  process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4o-mini";

export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export const LUNA_REASONING_EFFORT = "none" as const;
export const OCR_PAGE_CONCURRENCY = 4;

export function usesGpt5Api(model: string): boolean {
  return model.startsWith("gpt-5") || model.includes("luna");
}
