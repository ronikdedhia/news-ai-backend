import { groqService } from '../services/groq.service';
import { Article, SummarizeResult } from '../types';
import { logger } from '../utils/logger';

class SummarizationAgent {
  async execute(articles: Article[]): Promise<SummarizeResult> {
    try {
      logger.info(`🤖 Summarization Agent: Starting execution for ${articles.length} articles...`);

      const summaries: Array<{ articleId: string; summary: string }> = [];
      const errors: Array<{ articleId: string; error: string }> = [];

      for (const article of articles) {
        try {
          // Use content if available, otherwise use description or title
          const textToSummarize = article.content || article.title;

          if (!textToSummarize || textToSummarize.length < 50) {
            logger.warn(`Skipping article ${article.id}: Insufficient content`);
            errors.push({
              articleId: article.id,
              error: 'Insufficient content to summarize',
            });
            continue;
          }

          logger.debug(`Summarizing article: ${article.title}`);

          const summary = await groqService.summarizeText(textToSummarize);

          summaries.push({
            articleId: article.id,
            summary,
          });

          logger.info(`✅ Summarized: ${article.title.substring(0, 50)}...`);
        } catch (error: any) {
          logger.error(`Failed to summarize article ${article.id}`, {
            error: error.message,
          });

          errors.push({
            articleId: article.id,
            error: error.message,
          });
        }
      }

      logger.info(`✅ Summarization Agent: Completed ${summaries.length}/${articles.length} summaries`);

      return {
        success: true,
        articlesProcessed: summaries.length,
        summaries,
        errors,
      };
    } catch (error: any) {
      logger.error('❌ Summarization Agent: Execution failed', {
        error: error.message,
      });

      return {
        success: false,
        articlesProcessed: 0,
        summaries: [],
        errors: [{ articleId: 'all', error: error.message }],
      };
    }
  }
}

export const summarizationAgent = new SummarizationAgent();