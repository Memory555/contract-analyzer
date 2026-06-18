export function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <div className={accent ? `summary-row ${accent}` : "summary-row"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
