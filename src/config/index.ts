import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  newsdata: {
    apiKey: process.env.NEWSDATA_API_KEY,
    baseUrl: process.env.NEWSDATA_BASE_URL,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },
  huggingface: {
    apiKey: process.env.HUGGING_FACE_API_KEY || '',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  features: {
    maxArticlesToFetch: parseInt(process.env.MAX_ARTICLES_TO_FETCH || '10', 10),
    summaryMaxLength: parseInt(process.env.SUMMARY_MAX_LENGTH || '150', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'NEWSDATA_API_KEY',
  'GROQ_API_KEY',
  'DATABASE_URL',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Warn if optional but recommended env vars are missing
if (!process.env.HUGGING_FACE_API_KEY) {
  console.warn('⚠️  HUGGING_FACE_API_KEY not set - hashtag generation will fail. Add it to .env to enable hashtag feature.');
}