import { useEffect } from "react";
import { X } from "lucide-react";

export function Toast({
  message,
  tone,
  onClose
}: {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${tone}`} role="alert">
      <span>{tone === "success" ? "✓" : "✗"}</span>
      <p>{message}</p>
      <button type="button" onClick={onClose} aria-label="关闭通知"><X size={16} /></button>
    </div>
  );
}
