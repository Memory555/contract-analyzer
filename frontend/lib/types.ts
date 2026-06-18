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

export type AnalyzeRequest = {
  fileName: string;
  contractText: string;
};

export type AnalyzeResponse = AnalysisResult & {
  demo?: boolean;
  message?: string;
};
