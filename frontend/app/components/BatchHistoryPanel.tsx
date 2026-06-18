import { History } from "lucide-react";
import type { BatchAnalysisRecord } from "@/lib/types";

export function BatchHistoryPanel({
  batches,
  onOpenBatch
}: {
  batches: BatchAnalysisRecord[];
  onOpenBatch: (batchId: string) => void;
}) {
  return (
    <section className="panel history-panel">
      <div className="panel-title compact">
        <h2>
          <History size={18} />
          最近批量任务
        </h2>
        <span className="muted">仅保存在当前浏览器</span>
      </div>
      {batches.length === 0 ? (
        <p className="empty">暂无批量任务。</p>
      ) : (
        <div className="record-list">
          {batches.map((batch) => (
            <button key={batch.batchId} type="button" onClick={() => onOpenBatch(batch.batchId)}>
              <strong>{batch.batchId}</strong>
              <span>
                {batch.totalCount} 份合同 · {batch.successCount} 成功 / {batch.failedCount} 失败 · {new Date(batch.createdAt).toLocaleString("zh-CN")}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
