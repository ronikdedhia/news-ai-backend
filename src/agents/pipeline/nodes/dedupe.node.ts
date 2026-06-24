import { logger } from '../../../utils/logger';
import { articleService } from '../../../services/article.service';
import { Article } from '../../../types';
import { PipelineState } from '../state';

export async function dedupeNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const checks = await Promise.all(
    state.rawArticles.map(async (article): Promise<Article | null> => {
      try {
        const existing = await articleService.getArticleByUrl(article.url);
        return !existing || existing.length === 0 ? article : null;
      } catch {
        return article;
      }
    })
  );

  const newArticles = checks.filter((a): a is Article => a !== null);
  const dupeCount = state.rawArticles.length - newArticles.length;
  logger.info(`🔍 [dedupe] ${newArticles.length}/${state.rawArticles.length} are new (${dupeCount} already in DB)`);
  if (newArticles.length === 0) {
    logger.warn(`⚠️ [dedupe] all ${state.rawArticles.length} articles already exist in DB`);
    state.rawArticles.forEach(a => logger.info(`   dup: ${a.url}`));
  }
  return { newArticles };
}
