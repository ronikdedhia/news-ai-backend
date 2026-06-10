import { logger } from '../../../utils/logger';
import { metricsService } from '../../../services/metrics.service';
import { alertService } from '../../../services/alert.service';
import { PipelineState } from '../state';

export async function finishRunNode(state: PipelineState): Promise<Partial<PipelineState>> {
  if (state.dbRunId) {
    const allFailed = state.metrics.saved === 0 && state.errors.length > 0;
    if (allFailed) {
      await metricsService.recordRunFailed(state.dbRunId, state.startTs).catch(() => {});
    } else {
      await metricsService.recordRunComplete(state.dbRunId, state.metrics, state.startTs).catch(() => {});
    }
  }

  if (state.metrics.saved > 0 && state.savedArticles.length > 0) {
    await alertService.checkNewArticles(state.savedArticles).catch(() => {});
  }

  logger.info(
    `🏁 [finish_run] processed=${state.metrics.processed} saved=${state.metrics.saved} errors=${state.metrics.errors} telegram=${state.metrics.telegramSent}`
  );
  return {};
}
