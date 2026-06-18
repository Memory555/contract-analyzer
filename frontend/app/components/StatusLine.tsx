import { Loader2 } from "lucide-react";

type Status = "idle" | "uploading" | "analyzing" | "success" | "error";

export function StatusLine({
  status,
  fileName,
  error,
  message
}: {
  status: Status;
  fileName: string;
  error: string;
  message: string;
}) {
  if (status === "idle") return <p className="status-line">{message || "请选择 DOCX 合同文件加入待分析列表。"}</p>;
  if (status === "uploading" || status === "analyzing") {
    return (
      <p className="status-line active">
        <Loader2 size={16} className="spin" />
        {status === "uploading" ? "正在提取 DOCX 文本" : "正在分析合同，预计 10-30 秒"}：{fileName}
      </p>
    );
  }
  if (status === "error") return <p className="status-line danger">{error}</p>;
  return <p className="status-line success">{message || "解析完成。"} 文件：{fileName}</p>;
}

export function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    idle: "待上传",
    uploading: "提取文本中",
    analyzing: "AI 解析中",
    success: "解析完成",
    error: "需要处理"
  };
  return labels[status];
}
