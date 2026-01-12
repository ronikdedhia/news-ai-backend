# Database Schema Fix

## Problem
Insert queries failing because CockroachDB table uses DATE type but Drizzle ORM sends TIMESTAMP data.

## Solution
Update your CockroachDB table:

```sql
DROP TABLE IF EXISTS public.articles CASCADE;

CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NULL,
  url TEXT NOT NULL,
  image_url TEXT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT now(),
  bookmark_count INT8 NOT NULL DEFAULT 0,
  CONSTRAINT articles_pkey PRIMARY KEY (id ASC),
  UNIQUE INDEX articles_url_key (url ASC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;
```

## Changes Made in Code

1. **src/db/schema.ts**: Changed `date()` to `timestamp()`
2. **src/services/pipeline.service.ts**: Removed date formatting
3. **src/services/article.service.ts**: Enhanced error logging

## Next Steps

1. Run the SQL migration above in CockroachDB
2. Restart server: `npm run dev`
3. Test: `curl -X POST http://localhost:3000/api/trigger-pipeline`

Expected: All 10 articles save successfully ✅
