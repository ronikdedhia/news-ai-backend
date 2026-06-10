import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const hashtagChain = ChatPromptTemplate.fromMessages([
  ['system', 'You are a hashtag generator. Generate exactly 4 relevant hashtags for the given text. Return ONLY the hashtags separated by spaces, no other text. Format: #tag1 #tag2 #tag3 #tag4'],
  ['human', '{text}'],
])
  .pipe(createLLM('hashtag'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function generateHashtags(text: string): Promise<string[]> {
  if (!text?.trim()) return ['#news'];
  const result = await hashtagChain.invoke({ text });
  const tags = result.split(/\s+/).filter(t => t.startsWith('#')).slice(0, 4);
  return tags.length > 0 ? tags : ['#news'];
}
