import { logger } from '../utils/logger';

let embedder: any = null;
let loading = false;
const waiters: Array<() => void> = [];

async function getEmbedder() {
  if (embedder) return embedder;

  if (loading) {
    await new Promise<void>(resolve => waiters.push(resolve));
    return embedder;
  }

  loading = true;
  try {
    const { pipeline, env } = (await import('@huggingface/transformers')) as any;
    env.cacheDir = './.cache/transformers';
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
    logger.info('✅ Embedding model loaded (all-MiniLM-L6-v2, 384-dim)');
  } catch (err: any) {
    loading = false;
    waiters.forEach(r => r());
    waiters.length = 0;
    throw err;
  }

  loading = false;
  waiters.forEach(r => r());
  waiters.length = 0;
  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const result = await pipe(text.slice(0, 512), { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

export function warmupEmbedder() {
  getEmbedder().catch((err: Error) =>
    logger.warn('Embedding model warmup failed:', err.message)
  );
}
