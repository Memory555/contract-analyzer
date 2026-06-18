import { useEffect } from "react";
import { X } from "lucide-react";
import type { ContractIssue, PaymentPlanItem, WarrantyField } from "@/lib/types";

type SourceItem = ContractIssue | PaymentPlanItem | WarrantyField;

function highlightSourceText(item: SourceItem): React.ReactNode {
  const text = item.sourceText || "暂无原文片段。";
  const keywords: string[] = [];
  if ("type" in item && item.type) keywords.push(item.type);
  if ("field" in item && item.field) keywords.push(item.field);
  if ("stage" in item && item.stage) keywords.push(item.stage);
  if (item.location) keywords.push(item.location);
  if (keywords.length === 0) return text;

  const pattern = keywords.filter(Boolean).map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i}>{part}</mark> : part
  );
}

export function SourceDrawer({ item, onClose }: { item: SourceItem; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p>合同原文定位</p>
            <h2>{"type" in item ? item.type : "field" in item ? item.field : item.stage}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭抽屉"><X size={18} /></button>
        </div>
        <div className="source-meta">
          <span>涉及位置</span>
          <strong>{item.location || "未标明"}</strong>
        </div>
        <pre>{highlightSourceText(item)}</pre>
      </aside>
    </div>
  );
}

export type { SourceItem };
