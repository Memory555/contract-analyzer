export type IssueSeverity = "error" | "warning" | "info";

export type ContractIssue = {
  id: string;
  type: string;
  severity: IssueSeverity;
  description: string;
  location: string;
  sourceText: string;
};

export type PaymentPlanItem = {
  id: string;
  stage: string;
  name: string;
  percentage: string;
  conditions: string[];
  deadline: string;
  note: string;
  location: string;
  sourceText: string;
};

export type WarrantyField = {
  id: string;
  field: string;
  content: string;
  note: string;
  location: string;
  sourceText: string;
};

export type Confidence = {
  overall: number;
  payment_plan: number;
  warranty: number;
  issues: number;
};

export type AnalysisResult = {
  issues: ContractIssue[];
  payment_plan: PaymentPlanItem[];
  warranty: {
    core_fields: WarrantyField[];
    extra_fields: WarrantyField[];
  };
  confidence: Confidence;
};

export type AnalysisRecord = {
  id: string;
  fileName: string;
  createdAt: string;
  result: AnalysisResult;
};

export type ContractAnalysisStatus = "pending" | "uploading" | "analyzing" | "success" | "failed" | "cancelled";

export type BatchAnalysisStatus = "pending" | "analyzing" | "partial_success" | "success" | "failed" | "cancelled";

export type ContractAnalysisRecord = {
  id: string;
  batchId: string;
  uploadIndex: number;
  fileName: string;
  displayName: string;
  exportName: string;
  fileSize: number;
  status: ContractAnalysisStatus;
  createdAt: string;
  updatedAt: string;
  contractText?: string;
  result?: AnalysisResult;
  errorMessage?: string;
};

export type BatchAnalysisRecord = {
  batchId: string;
  createdAt: string;
  updatedAt: string;
  status: BatchAnalysisStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  contractIds: string[];
};

export type ExportMode = "single" | "batch";

export type ExportHistoryRecord = {
  id: string;
  batchId: string;
  contractId?: string;
  fileName: string;
  mode: ExportMode;
  createdAt: string;
};

export type AnalyzeRequest = {
  fileName: string;
  contractText: string;
};

export type AnalyzeResponse = AnalysisResult & {
  demo?: boolean;
  message?: string;
};

export type FeedbackType = "helpful" | "problem";

export type FeedbackProblemCategory = "missing_clause" | "wrong_judgment" | "wrong_risk_level" | "unclear" | "other";

export type FeedbackStatus = "pending" | "submitted" | "failed";

export type AnalysisFeedbackRecord = {
  id: string;
  contractId: string;
  batchId: string;
  fileName: string;
  feedbackType: FeedbackType;
  problemCategory?: FeedbackProblemCategory;
  comment?: string;
  analysisTime: string;
  modelName: string;
  promptVersion: string;
  resultSummary: string;
  riskItemCount: number;
  contractText: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
};

/* ---- 云端反馈 API 相关类型 ---- */

/** 云端反馈文档（与 CloudBase 集合中文档结构一致） */
export type CloudFeedbackDocument = {
  id: string;
  contractId: string;
  batchId: string;
  fileName: string;
  feedbackType: FeedbackType;
  problemCategory?: FeedbackProblemCategory;
  comment?: string;
  analysisTime: string;
  modelName: string;
  promptVersion: string;
  resultSummary: string;
  riskItemCount: number;
  contractText: string;
  createdAt: string;
  updatedAt: string;
  source: string;
};

/** 列表项（不含 contractText，减轻传输量） */
export type CloudFeedbackListItem = Omit<CloudFeedbackDocument, "contractText">;

/** 反馈统计数据 */
export type CloudFeedbackStats = {
  total: number;
  helpful: number;
  problem: number;
  byCategory: Record<FeedbackProblemCategory, number>;
};

/** GET /api/feedback 响应体 */
export type CloudFeedbackListResponse = {
  items: CloudFeedbackListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: CloudFeedbackStats;
};
