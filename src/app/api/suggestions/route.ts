import { jsonError } from "@/lib/http";
import { CHAT_MODEL, LUNA_REASONING_EFFORT } from "@/lib/models";
import { getOpenAI } from "@/lib/openai";

interface SuggestionsBody {
  lastResponse?: string;
  previousQuestions?: string[];
}

export async function POST(request: Request) {
  const body = (await request.json()) as SuggestionsBody;
  const lastResponse = body.lastResponse?.trim() ?? "";

  if (!lastResponse) {
    return Response.json({ suggestions: [] });
  }

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      reasoning_effort: LUNA_REASONING_EFFORT,
      max_completion_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Suggest 6 short follow-up questions about the documents. Return JSON only: {\"suggestions\":[\"...\"]}",
        },
        {
          role: "user",
          content: JSON.stringify({
            lastResponse,
            previousQuestions: body.previousQuestions ?? [],
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "")) as {
      suggestions?: string[];
    };

    return Response.json({
      suggestions: (parsed.suggestions ?? []).slice(0, 6),
    });
  } catch (error) {
    console.error("Suggestions failed", error);

    return jsonError("Could not generate suggestions.", 500);
  }
}
