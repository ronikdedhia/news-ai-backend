import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const questionsChain = ChatPromptTemplate.fromMessages([
  ['system', `You are a news analyst. Given a news article, return ONLY valid JSON — no explanation, no markdown.
Generate exactly 2 insightful Socratic questions a thoughtful reader would ask, each with a concise 1-sentence answer.
Format: [{{"q":"...","a":"..."}},{{"q":"...","a":"..."}}]
Rules:
- Questions must be specific to THIS article (Why did X happen? Who benefits? What comes next?)
- Answers max 20 words, factual, based only on the article
- Do NOT use generic questions like "What is the main topic?"`],
  ['human', '{text}'],
])
  .pipe(createLLM('questions'))
  .pipe(new JsonOutputParser())
  .withRetry(RETRY_CONFIG);

export async function generateQuestions(title: string, content: string): Promise<Array<{ q: string; a: string }>> {
  try {
    const result = await questionsChain.invoke({ text: `${title}. ${content}`.slice(0, 700) }) as any;
    const arr = Array.isArray(result) ? result : [];
    return arr.filter((x: any) => typeof x?.q === 'string' && typeof x?.a === 'string').slice(0, 2);
  } catch {
    return [];
  }
}
