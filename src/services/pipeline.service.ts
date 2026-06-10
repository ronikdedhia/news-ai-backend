import { runNewsPipeline } from '../agents/pipeline/graph';
import { PipelineMetrics } from '../agents/pipeline/state';

export type { PipelineMetrics as PipelineResult };

class PipelineService {
  async executeNewsDataPipeline(opts?: { fresh?: boolean }): Promise<PipelineMetrics> {
    return runNewsPipeline('newsdata', opts);
  }

  async executeAlphaVantagePipeline(): Promise<PipelineMetrics> {
    return runNewsPipeline('alphavantage');
  }
}

export const pipelineService = new PipelineService();
