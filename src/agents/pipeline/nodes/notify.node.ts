import { logger } from '../../../utils/logger';
import { telegramService } from '../../../services/telegram.service';
import { PipelineState } from '../state';

export async function notifyNode(state: PipelineState): Promise<Partial<PipelineState>> {
  if (state.savedArticles.length === 0) {
    logger.info('📭 [notify] no new articles to send');
    return {};
  }

  const enrichedByUrl = new Map(state.enrichedArticles.map(e => [e.raw.url, e]));
  let telegramSent = 0;

  for (const article of state.savedArticles) {
    try {
      const hashtags = article.hashtags ? article.hashtags.split(/\s+/) : [];
      const sent = await telegramService.sendMessage({
        title: article.title,
        content: article.content || 'No content available',
        hashtags,
        url: article.url,
        imageUrl: article.imageUrl ?? undefined,
      });
      if (sent) telegramSent++;
    } catch (error: any) {
      logger.warn(`⚠️ [notify] Telegram failed for ${article.url}: ${error.message}`);
    }
  }

  logger.info(`📨 [notify] ${telegramSent}/${state.savedArticles.length} Telegram sent`);
  return {
    metrics: { ...state.metrics, telegramSent },
  };
}
