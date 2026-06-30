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
  if (status === "idle") return <p className="status-line">{message || "请选择 PDF、DOC、DOCX、JPG 或 PNG 合同文件加入待分析列表。"}</p>;
  if (status === "uploading" || status === "analyzing") {
    return (
      <p className="status-line active">
        <Loader2 size={16} className="spin" />
        {status === "uploading" ? "正在解析合同文本，扫描件可能需要更长时间" : "正在分析合同"}：{fileName}
      </p>
    );
  }
  if (status === "error") return <p className="status-line danger">{error}</p>;
  return <p className="status-line success">{message || "解析完成。"} 文件：{fileName}</p>;
}

export function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    idle: "待上传",
    uploading: "文档解析中",
    analyzing: "AI 解析中",
    success: "解析完成",
    error: "需要处理"
  };
  return labels[status];
}
