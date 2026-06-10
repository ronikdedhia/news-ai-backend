import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const eli5Chain = ChatPromptTemplate.fromMessages([
  ['system', 'Explain this news to a 10-year-old in 2-3 simple sentences. Use everyday words, no jargon. Start directly with the explanation — no intro phrases like "Sure!" or "This article is about".'],
  ['human', '{text}'],
])
  .pipe(createLLM('eli5'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function generateELI5(title: string, content: string): Promise<string> {
  try {
    const result = await eli5Chain.invoke({ text: `${title}. ${content}`.slice(0, 700) });
    return result.trim();
  } catch {
    return '';
  }
}
