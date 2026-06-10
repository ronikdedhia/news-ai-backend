import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const analyzeChain = ChatPromptTemplate.fromMessages([
  ['system', `You are a news analyst. Return ONLY valid JSON, no explanation, no markdown.
Analyze the news text and return:
{{"sentiment":"positive"|"neutral"|"negative","entities":[{{"name":"..","type":"person"|"company"|"place"}}]}}
Rules:
- sentiment: overall tone of the news
- entities: max 5, only clearly mentioned real-world names
- type "person" for people, "company" for organizations/brands, "place" for locations
- if no entities found, return empty array`],
  ['human', '{text}'],
])
  .pipe(createLLM('analyze'))
  .pipe(new JsonOutputParser())
  .withRetry(RETRY_CONFIG);

export async function analyzeArticle(title: string, content: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  entities: Array<{ name: string; type: string }>;
}> {
  try {
    const result = await analyzeChain.invoke({ text: `${title}. ${content}`.slice(0, 800) }) as any;
    return {
      sentiment: ['positive', 'neutral', 'negative'].includes(result.sentiment)
        ? result.sentiment
        : 'neutral',
      entities: Array.isArray(result.entities)
        ? result.entities.filter((e: any) => e?.name && ['person', 'company', 'place'].includes(e?.type)).slice(0, 5)
        : [],
    };
  } catch {
    return { sentiment: 'neutral', entities: [] };
  }
}
