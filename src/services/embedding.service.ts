import axios from 'axios';
import { logger } from '../utils/logger';

const HF_MODEL_URL =
  'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';

export async function embedText(text: string): Promise<number[]> {
  const response = await axios.post<number[][]>(
    HF_MODEL_URL,
    { inputs: text.slice(0, 512) },
    {
      headers: {
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return response.data[0];
}

export function warmupEmbedder() {
  embedText('warmup').catch((err: Error) =>
    logger.warn('Embedding warmup failed:', err.message)
  );
}
