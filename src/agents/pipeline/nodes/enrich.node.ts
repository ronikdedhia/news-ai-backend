import { logger } from '../../../utils/logger';
import { embedText } from '../../../services/embedding.service';
import { summarizeText } from '../../../chains/summarize.chain';
import { summarizeTitle } from '../../../chains/title.chain';
import { generateHashtags } from '../../../chains/hashtag.chain';
import { analyzeArticle } from '../../../chains/analyze.chain';
import { detectBias } from '../../../chains/bias.chain';
import { generateWhyItMatters } from '../../../chains/why-it-matters.chain';
import { generateELI5 } from '../../../chains/eli5.chain';
import { generateQuestions } from '../../../chains/questions.chain';
import { EnrichedArticle, PipelineState, PipelineError } from '../state';

// Called once per article via LangGraph Send API fan-out — no for...of loop needed
export async function enrichArticleNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const article = state.currentArticle;
  if (!article) return {};

  try {
    logger.info(`⚙️ [enrich] ${article.title.slice(0, 60)}`);

    const [titleSummary, contentSummary, hashtags] = await Promise.all([
      summarizeTitle(article.title).catch(() => article.title.slice(0, 50)),
      summarizeText(article.content || article.title).catch(() => article.title),
      generateHashtags(article.title).catch(() => ['#news']),
    ]);

    const [analysisResult, biasResult, whyResult, eli5Result, questionsResult, embeddingResult] =
      await Promise.allSettled([
        analyzeArticle(titleSummary, contentSummary),
        detectBias(titleSummary, contentSummary),
        generateWhyItMatters(titleSummary, contentSummary),
        generateELI5(titleSummary, contentSummary),
        generateQuestions(titleSummary, contentSummary),
        embedText(`${titleSummary} ${contentSummary}`),
      ]);

    const enriched: EnrichedArticle = {
      raw: article,
      titleSummary,
      contentSummary,
      hashtags,
      sentiment: analysisResult.status === 'fulfilled' ? analysisResult.value.sentiment : 'neutral',
      entities: analysisResult.status === 'fulfilled' ? analysisResult.value.entities : [],
      biasLabel: biasResult.status === 'fulfilled' ? biasResult.value.label : 'center',
      biasScore: biasResult.status === 'fulfilled' ? biasResult.value.score : 50,
      whyItMatters: whyResult.status === 'fulfilled' ? whyResult.value : '',
      eli5: eli5Result.status === 'fulfilled' ? eli5Result.value : '',
      questions: questionsResult.status === 'fulfilled' ? questionsResult.value : [],
      embedding: embeddingResult.status === 'fulfilled' ? embeddingResult.value : [],
    };

    // append reducer merges this into the shared enrichedArticles array
    return { enrichedArticles: [enriched] };
  } catch (error: any) {
    const err: PipelineError = { articleUrl: article.url, stage: 'enrich', message: error.message };
    logger.warn(`⚠️ [enrich] failed for ${article.url}: ${error.message}`);
    return { errors: [err] };
  }
}
