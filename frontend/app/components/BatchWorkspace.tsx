import { StatusBadge } from "./StatusBadge";
import type { ContractAnalysisRecord } from "@/lib/types";

export function BatchWorkspace({
  contracts,
  currentContractId,
  onSelectContract,
  onRetryContract,
  onExportContract
}: {
  contracts: ContractAnalysisRecord[];
  currentContractId: string;
  onSelectContract: (contract: ContractAnalysisRecord) => void;
  onRetryContract: (contract: ContractAnalysisRecord) => void;
  onExportContract: (contract: ContractAnalysisRecord) => void;
}) {
  return (
    <section className="panel batch-panel">
      <div className="panel-title compact">
        <h2>批量任务列表</h2>
        <span className="muted">同名合同通过上传序号和合同ID区分</span>
      </div>
      <div className="table-wrap">
        <table className="batch-table" aria-label="批量任务列表">
          <caption className="sr-only">批量任务列表，包含序号、合同名称、状态、置信度和操作</caption>
          <thead>
            <tr>
              <th>序号</th>
              <th>合同名称</th>
              <th>原始文件名</th>
              <th>状态</th>
              <th>问题</th>
              <th>付款</th>
              <th>质保</th>
              <th>置信度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const warrantyCount =
                (contract.result?.warranty.core_fields.length ?? 0) + (contract.result?.warranty.extra_fields.length ?? 0);
              return (
                <tr key={contract.id} className={contract.id === currentContractId ? "selected-row" : undefined}>
                  <td>{String(contract.uploadIndex).padStart(3, "0")}</td>
                  <td>
                    <strong>{contract.displayName}</strong>
                    <span>{contract.id}</span>
                  </td>
                  <td>{contract.fileName}</td>
                  <td><StatusBadge status={contract.status} /></td>
                  <td>{contract.result?.issues.length ?? "-"}</td>
                  <td>{contract.result?.payment_plan.length ?? "-"}</td>
                  <td>{contract.result ? warrantyCount : "-"}</td>
                  <td>{contract.result ? <span className="num">{Math.round(contract.result.confidence.overall * 100)}%</span> : "-"}</td>
                  <td>
                    {contract.status === "failed" ? (
                      <button className="link-button danger-link" type="button" onClick={() => onRetryContract(contract)}>
                        重试
                      </button>
                    ) : (
                      <div className="row-actions">
                        <button className="link-button" type="button" onClick={() => onSelectContract(contract)} disabled={!contract.result}>
                          查看详情
                        </button>
                        <button className="link-button" type="button" onClick={() => onExportContract(contract)} disabled={!contract.result}>
                          导出分析
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
