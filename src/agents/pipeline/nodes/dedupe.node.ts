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
  logger.info(`🔍 [dedupe] ${newArticles.length}/${state.rawArticles.length} are new`);
  return { newArticles };
}
