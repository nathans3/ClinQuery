import { EMBEDDING_MODEL } from "@/lib/models";
import { getOpenAI } from "@/lib/openai";

const BATCH_SIZE = 50;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = getOpenAI();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);

    vectors.push(...ordered.map((item) => item.embedding));
  }

  return vectors;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embedTexts([query]);

  return vector;
}
