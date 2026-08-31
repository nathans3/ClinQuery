import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local or your host environment.",
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export function resetOpenAIClient(): void {
  client = null;
}
