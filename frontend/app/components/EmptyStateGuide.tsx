import { Download, FileCheck2, UploadCloud } from "lucide-react";

export function EmptyStateGuide({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="empty-state-guide">
      <div className="guide-step">
        <UploadCloud size={28} />
        <strong>上传合同</strong>
        <p>选择或拖拽 DOCX 文件加入待分析列表</p>
      </div>
      <div className="guide-step">
        <FileCheck2 size={28} />
        <strong>智能分析</strong>
        <p>AI 自动提取付款计划、质保明细与问题提示</p>
      </div>
      <div className="guide-step">
        <Download size={28} />
        <strong>导出结果</strong>
        <p>一键导出结构化 Excel 汇总表</p>
      </div>
    </div>
  );
}
