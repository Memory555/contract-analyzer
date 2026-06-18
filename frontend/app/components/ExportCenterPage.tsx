import { Download } from "lucide-react";
import type { BatchAnalysisRecord, ContractAnalysisRecord, ExportHistoryRecord } from "@/lib/types";
import { SummaryRow } from "./SummaryRow";

export function batchStatusLabel(status: BatchAnalysisRecord["status"]) {
  const labels: Record<BatchAnalysisRecord["status"], string> = {
    pending: "等待分析",
    analyzing: "正在分析",
    partial_success: "部分成功",
    success: "全部完成",
    failed: "全部失败",
    cancelled: "已取消"
  };
  return labels[status];
}

export function ExportCenterPage({
  batches,
  contracts,
  exportRecords,
  activeBatchId,
  onOpenBatch,
  onBatchExport
}: {
  batches: BatchAnalysisRecord[];
  contracts: ContractAnalysisRecord[];
  exportRecords: ExportHistoryRecord[];
  activeBatchId: string;
  onOpenBatch: (batchId: string) => Promise<void>;
  onBatchExport: () => void;
}) {
  const activeSuccessCount = contracts.filter((contract) => contract.status === "success" && contract.result).length;
  return (
    <>
      <header className="topbar">
        <div>
          <p>导出中心 / 批量结果</p>
          <h1>导出中心</h1>
        </div>
        <div className="badges">
          <span>单合同导出</span>
          <span>批量汇总 Excel</span>
        </div>
      </header>

      <section className="export-grid">
        <article className="panel">
          <div className="panel-title compact">
            <h2>最近批量任务</h2>
            <span className="muted">仅保存在当前浏览器</span>
          </div>
          {batches.length === 0 ? (
            <p className="empty">暂无批量任务。</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>批次ID</th>
                    <th>合同数</th>
                    <th>成功 / 失败</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.batchId}>
                      <td>{batch.batchId}</td>
                      <td>{batch.totalCount}</td>
                      <td>{batch.successCount} / {batch.failedCount}</td>
                      <td>{batchStatusLabel(batch.status)}</td>
                      <td>
                        <button className="link-button" type="button" onClick={() => void onOpenBatch(batch.batchId)}>
                          打开批次
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel export-actions-panel">
          <div className="panel-title compact">
            <h2>当前批次导出</h2>
            <span className="muted">{activeBatchId || "未选择批次"}</span>
          </div>
          <p className="export-note">
            批量汇总 Excel 会把本批次合同集中到同一个文件，并在每一行写入批次ID、上传序号、合同ID、合同名称和原始文件名。
          </p>
          <SummaryRow label="可汇总合同" value={`${activeSuccessCount} 份`} />
          <SummaryRow label="当前任务数" value={`${contracts.length} 份`} />
          <button className="primary" type="button" disabled={activeSuccessCount === 0} onClick={onBatchExport}>
            <Download size={18} />
            导出全部合同汇总表
          </button>
        </article>
      </section>

      <section className="panel history-panel">
        <div className="panel-title compact">
          <h2>导出记录</h2>
          <span className="muted">记录最近导出的文件名</span>
        </div>
        {exportRecords.length === 0 ? (
          <p className="empty">暂无导出记录。</p>
        ) : (
          <div className="record-list">
            {exportRecords.map((record) => (
              <button key={record.id} type="button">
                <strong>{record.fileName}</strong>
                <span>{record.mode === "batch" ? "批量汇总" : "单合同"} · {new Date(record.createdAt).toLocaleString("zh-CN")}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
