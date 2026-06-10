import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const whyChain = ChatPromptTemplate.fromMessages([
  ['system', 'You are a news analyst. In ONE sentence of at most 20 words, explain the real-world significance of this news. Start with the impact, not the event. No quotes, no preamble, no period at the end.'],
  ['human', '{text}'],
])
  .pipe(createLLM('whyItMatters'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function generateWhyItMatters(title: string, content: string): Promise<string> {
  try {
    const result = await whyChain.invoke({ text: `${title}. ${content}`.slice(0, 600) });
    return result.trim().replace(/\.$/, '');
  } catch {
    return '';
  }
}
