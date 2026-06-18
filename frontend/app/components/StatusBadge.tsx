import type { ContractAnalysisRecord } from "@/lib/types";

export function StatusBadge({ status }: { status: ContractAnalysisRecord["status"] }) {
  const labels: Record<ContractAnalysisRecord["status"], string> = {
    pending: "等待",
    uploading: "提取中",
    analyzing: "分析中",
    success: "完成",
    failed: "失败",
    cancelled: "取消"
  };
  const tone = status === "success" ? "success" : status === "failed" ? "error" : status === "pending" ? "neutral" : "info";
  return <span className={`status-badge ${tone}`}>{labels[status]}</span>;
}
