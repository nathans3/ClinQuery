import { getOpenAI } from "@/lib/openai";
import {
  LUNA_REASONING_EFFORT,
  OCR_MODEL,
  usesGpt5Api,
} from "@/lib/models";

const VISION_PROMPT = `You are a strict OCR engine. Read the document page image and return clean Markdown only.

Rules:
- Preserve headings, lists, and reading order.
- Convert tables to Markdown pipe tables.
- Replace decorative images with [image].
- Do not add commentary, labels, or page numbers.
- If the page is blank, return an empty string.`;

export async function ocrImageWithVision(imageDataUrl: string): Promise<string> {
  const openai = getOpenAI();
  const usesGpt5 = usesGpt5Api(OCR_MODEL);
  const response = await openai.chat.completions.create({
    model: OCR_MODEL,
    ...(usesGpt5
      ? {
          reasoning_effort: LUNA_REASONING_EFFORT,
          max_completion_tokens: 1800,
        }
      : { max_tokens: 1800 }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          {
            type: "image_url",
            image_url: { url: imageDataUrl, detail: "low" },
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

export function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  const base64 = Buffer.from(bytes).toString("base64");

  return `data:${mimeType};base64,${base64}`;
}
