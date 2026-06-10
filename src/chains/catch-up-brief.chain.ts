import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const catchUpChain = ChatPromptTemplate.fromMessages([
  ['system', 'You are a news briefing assistant. Given a list of news headlines, write exactly 2 sentences that capture the most important stories. Be direct and informative. No filler phrases like "Here is" or "In summary". Start immediately with the news.'],
  ['human', '{headlines}'],
])
  .pipe(createLLM('catchUpBrief'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function generateCatchUpBrief(headlines: string[]): Promise<string> {
  if (headlines.length === 0) return '';
  try {
    const list = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
    return (await catchUpChain.invoke({ headlines: list })).trim();
  } catch {
    return '';
  }
}
