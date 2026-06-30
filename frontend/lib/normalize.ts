import type { AnalysisResult, ContractIssue, PaymentPlanItem, WarrantyField } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  const text = asString(value);
  return text ? [text] : [];
}

function normalizeIssue(value: unknown, index: number): ContractIssue {
  const item = asRecord(value);
  const sourceText = asString(item.sourceText ?? item.source_text);
  const severity = item.severity === "error" || item.severity === "warning" || item.severity === "info"
    ? item.severity
    : "info";

  return {
    id: asString(item.id) || `issue-${index + 1}`,
    type: asString(item.type) || "提示",
    severity,
    description: asString(item.description) || sourceText || "未提及",
    location: asString(item.location) || "未提及",
    sourceText: sourceText || "未提及",
    suggestion: asString(item.suggestion ?? item.recommendation ?? item.advice)
  };
}

function normalizePayment(value: unknown, index: number): PaymentPlanItem {
  const item = asRecord(value);
  const sourceText = asString(item.sourceText ?? item.source_text);
  const conditions = asStringArray(
    item.conditions
      ?? item.payment_description
      ?? item.paymentDescription
      ?? item.payment_desc
      ?? item.description
      ?? item.trigger
      ?? item.condition
  );

  return {
    id: asString(item.id) || `payment-${index + 1}`,
    stage: asString(item.stage) || `第 ${index + 1} 阶段`,
    name: asString(item.name) || "未提及",
    percentage: asString(item.percentage) || asString(item.ratio) || asString(item.amount) || "未提及",
    conditions: conditions.length > 0 ? conditions : [sourceText || "未提及"],
    deadline: asString(item.deadline) || asString(item.payment_deadline) || asString(item.time_limit) || "未提及",
    note: asString(item.note) || "未提及",
    location: asString(item.location) || "未提及",
    sourceText: sourceText || "未提及"
  };
}

function normalizeWarrantyField(value: unknown, index: number, prefix: string): WarrantyField {
  const item = asRecord(value);
  const sourceText = asString(item.sourceText ?? item.source_text);
  return {
    id: asString(item.id) || `${prefix}-${index + 1}`,
    field: asString(item.field) || asString(item.name) || "补充字段",
    content: asString(item.content) || asString(item.value) || sourceText || "未提及",
    note: asString(item.note) || "未提及",
    location: asString(item.location) || "未提及",
    sourceText: sourceText || "未提及"
  };
}

export function normalizeAnalysisResult(value: unknown): AnalysisResult {
  const root = asRecord(value);
  const warranty = asRecord(root.warranty);
  const confidence = asRecord(root.confidence);

  return {
    issues: Array.isArray(root.issues) ? root.issues.map(normalizeIssue) : [],
    payment_plan: Array.isArray(root.payment_plan) ? root.payment_plan.map(normalizePayment) : [],
    warranty: {
      core_fields: Array.isArray(warranty.core_fields)
        ? warranty.core_fields.map((item, index) => normalizeWarrantyField(item, index, "warranty-core"))
        : [],
      extra_fields: Array.isArray(warranty.extra_fields)
        ? warranty.extra_fields.map((item, index) => normalizeWarrantyField(item, index, "warranty-extra"))
        : []
    },
    confidence: {
      overall: asNumber(confidence.overall, 0.6),
      payment_plan: asNumber(confidence.payment_plan, 0.6),
      warranty: asNumber(confidence.warranty, 0.6),
      issues: asNumber(confidence.issues, 0.6)
    }
  };
}
