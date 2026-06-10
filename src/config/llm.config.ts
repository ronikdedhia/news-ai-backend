import { ChatGroq } from '@langchain/groq';
import { config } from './index';

export const LLM_CONFIGS = {
  summarize:    { temperature: 0.1, maxTokens: 100  },
  title:        { temperature: 0.0, maxTokens: 15   },
  hashtag:      { temperature: 0.3, maxTokens: 50   },
  analyze:      { temperature: 0.0, maxTokens: 150  },
  bias:         { temperature: 0.0, maxTokens: 40   },
  whyItMatters: { temperature: 0.2, maxTokens: 40   },
  eli5:         { temperature: 0.3, maxTokens: 120  },
  questions:    { temperature: 0.2, maxTokens: 200  },
  catchUpBrief: { temperature: 0.2, maxTokens: 120  },
} as const;

const retryOn429 = (error: any) => {
  const is429 =
    error?.status === 429 ||
    (typeof error?.message === 'string' &&
      (error.message.includes('429') || error.message.includes('rate_limit_exceeded')));
  if (!is429) throw error;
};

export const RETRY_CONFIG = {
  stopAfterAttempt: 3,
  onFailedAttempt: retryOn429,
};

export const TIMEOUT_MS = 10_000;

export function createLLM(task: keyof typeof LLM_CONFIGS) {
  const { temperature, maxTokens } = LLM_CONFIGS[task];
  return new ChatGroq({
    apiKey: config.groq.apiKey,
    model: config.groq.model,
    temperature,
    maxTokens,
  });
}
