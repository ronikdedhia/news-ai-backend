import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const HF_MODEL_URL =
  'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';

export async function embedText(text: string): Promise<number[]> {
  const response = await axios.post<number[][]>(
    HF_MODEL_URL,
    { inputs: text.slice(0, 512) },
    {
      headers: {
        Authorization: `Bearer ${config.huggingface.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return response.data[0];
}

export function warmupEmbedder(retries = 3, delayMs = 5000): void {
  const attempt = (remaining: number) => {
    embedText('warmup')
      .then(() => logger.info('✅ Embedding service warmed up'))
      .catch((err: Error) => {
        if (remaining > 0) {
          logger.warn(`Embedding warmup failed, retrying in ${delayMs / 1000}s (${remaining} left): ${err.message}`);
          setTimeout(() => attempt(remaining - 1), delayMs);
        } else {
          logger.warn(`Embedding warmup failed after all retries: ${err.message}`);
        }
      });
  };
  attempt(retries);
}
