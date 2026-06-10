import { Annotation } from '@langchain/langgraph';
import { Article } from '../../types';

export interface EnrichedArticle {
  raw: Article;
  titleSummary: string;
  contentSummary: string;
  hashtags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  entities: Array<{ name: string; type: string }>;
  whyItMatters: string;
  questions: Array<{ q: string; a: string }>;
  biasLabel: string;
  biasScore: number;
  eli5: string;
  embedding: number[];
}

export interface SavedArticle {
  id: string;
  title: string;
  content: string | null;
  hashtags: string | null;
  url: string;
  imageUrl: string | null;
}

export interface PipelineError {
  articleUrl: string;
  stage: string;
  message: string;
}

export interface PipelineMetrics {
  processed: number;
  saved: number;
  errors: number;
  telegramSent: number;
}

export const PipelineStateAnnotation = Annotation.Root({
  source: Annotation<'newsdata' | 'alphavantage'>({
    reducer: (_, b) => b,
    default: () => 'newsdata' as const,
  }),
  // DB run ID set by start_run node, used by finish_run node
  dbRunId: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  // Wall-clock start time for duration tracking
  startTs: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
  rawArticles: Annotation<Article[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  newArticles: Annotation<Article[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  // Single article injected per Send() fan-out invocation
  currentArticle: Annotation<Article | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  // Append reducer — each parallel enrich_article instance pushes one element
  enrichedArticles: Annotation<EnrichedArticle[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  savedArticles: Annotation<SavedArticle[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  // Append reducer — errors accumulate across all nodes
  errors: Annotation<PipelineError[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  metrics: Annotation<PipelineMetrics>({
    reducer: (_, b) => b,
    default: () => ({ processed: 0, saved: 0, errors: 0, telegramSent: 0 }),
  }),
});

export type PipelineState = typeof PipelineStateAnnotation.State;
