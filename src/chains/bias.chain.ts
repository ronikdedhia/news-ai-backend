import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const biasChain = ChatPromptTemplate.fromMessages([
  ['system', `You are a media bias analyst. Return ONLY valid JSON, no explanation.
Analyze the news text for political framing bias. Return:
{{"label":"left"|"center"|"right","score":0-100}}
Rules:
- label: overall political lean of the framing (not the topic itself)
- score: your confidence in this assessment (0=uncertain, 100=very confident)
- Use "center" when framing is neutral or balanced
- Base only on language, framing, and emphasis — not the topic`],
  ['human', '{text}'],
])
  .pipe(createLLM('bias'))
  .pipe(new JsonOutputParser())
  .withRetry(RETRY_CONFIG);

export async function detectBias(title: string, content: string): Promise<{ label: string; score: number }> {
  try {
    const result = await biasChain.invoke({ text: `${title}. ${content}`.slice(0, 700) }) as any;
    return {
      label: ['left', 'center', 'right'].includes(result.label) ? result.label : 'center',
      score: typeof result.score === 'number' ? Math.min(100, Math.max(0, result.score)) : 50,
    };
  } catch {
    return { label: 'center', score: 50 };
  }
}
