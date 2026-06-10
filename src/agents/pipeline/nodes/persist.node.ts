import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { articleService } from '../../../services/article.service';
import { normalizeCategory } from '../../../constants/categories';
import { PipelineState, SavedArticle, PipelineError } from '../state';

export async function persistNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const savedArticles: SavedArticle[] = [];
  const errors: PipelineError[] = [];
  let savedCount = 0;

  for (const article of state.enrichedArticles) {
    try {
      const result = await articleService.saveArticles([{
        id: randomUUID(),
        title: article.titleSummary,
        url: article.raw.url,
        content: article.contentSummary,
        publishedAt: article.raw.publishedAt instanceof Date
          ? article.raw.publishedAt.toISOString()
          : String(article.raw.publishedAt),
        imageUrl: article.raw.imageUrl,
        category: normalizeCategory(article.raw.category),
        hashtags: article.hashtags.join(' '),
        bookmarkCount: 0,
      }]);

      if (result.savedArticles.length > 0) {
        const saved = result.savedArticles[0];
        savedCount++;
        savedArticles.push(saved);

        // Update analysis fields — fire sequentially, errors are non-fatal
        await articleService.updateArticleAnalysis(saved.id, article.sentiment, article.entities).catch(() => {});
        await articleService.updateWhyItMatters(saved.id, article.whyItMatters).catch(() => {});
        await articleService.updateArticleQuestions(saved.id, article.questions).catch(() => {});
        await articleService.updateArticleBias(saved.id, article.biasLabel, article.biasScore).catch(() => {});
        await articleService.updateELI5Summary(saved.id, article.eli5).catch(() => {});
        if (article.embedding.length > 0) {
          await articleService.updateArticleEmbedding(saved.id, article.embedding).catch(() => {});
        }
      }
    } catch (error: any) {
      errors.push({ articleUrl: article.raw.url, stage: 'persist', message: error.message });
      logger.error(`❌ [persist] failed for ${article.raw.url}: ${error.message}`);
    }
  }

  logger.info(`💾 [persist] ${savedCount}/${state.enrichedArticles.length} saved`);
  return {
    savedArticles,
    errors,
    metrics: {
      processed: state.rawArticles.length,
      saved: savedCount,
      errors: state.errors.length + errors.length,
      telegramSent: 0,
    },
  };
}
