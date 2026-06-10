import { logger } from '../../../utils/logger';
import { metricsService } from '../../../services/metrics.service';
import { PipelineState } from '../state';

export async function startRunNode(state: PipelineState): Promise<Partial<PipelineState>> {
  const dbRunId = await metricsService.recordRunStart(state.source).catch(() => '');
  const startTs = Date.now();
  logger.info(`🚀 [start_run] source=${state.source} dbRunId=${dbRunId}`);
  return { dbRunId, startTs };
}
