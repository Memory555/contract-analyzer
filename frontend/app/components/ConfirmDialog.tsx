import { useEffect } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="confirm-dialog-actions">
          <button className="secondary" type="button" onClick={onCancel}>取消</button>
          <button className="danger-button" type="button" onClick={() => void onConfirm()}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
