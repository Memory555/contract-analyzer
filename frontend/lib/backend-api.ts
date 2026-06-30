import type { AnalysisResult } from "./types";

export type BackendJobStatus =
  | "created"
  | "uploaded"
  | "extracting"
  | "ocr_processing"
  | "analyzing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type BackendJob = {
  jobId: string;
  contractId: string;
  batchId: string;
  uploadIndex: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: BackendJobStatus;
  progress: number;
  stageMessage: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackendJobResult = {
  jobId: string;
  contractId: string;
  batchId: string;
  extraction: {
    sourceType: string;
    plainText: string;
    segments: Array<Record<string, unknown>>;
    pageCount?: number | null;
    charCount: number;
    warnings: string[];
    parserVersion: string;
  };
  analysis: AnalysisResult & {
    message?: string;
    demo?: boolean;
  };
};

export type UserModelSettings = {
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
};

const SUPPORTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function backendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL || "").replace(/\/+$/, "");
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${url}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === "string"
      ? data.message
      : typeof data.detail?.message === "string"
        ? data.detail.message
        : "后端服务请求失败。";
    throw new Error(message);
  }
  return data as T;
}

export function validateContractFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return "v6 支持 PDF、DOC、DOCX、JPG/JPEG、PNG 合同文件。";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "文件大小超过 20MB，请选择更小的合同文件。";
  }
  return null;
}

export async function createAnalysisJob(
  file: File,
  batchId: string,
  uploadIndex: number,
  modelSettings?: UserModelSettings
): Promise<BackendJob> {
  const formData = new FormData();
  formData.append("batchId", batchId);
  formData.append("uploadIndex", String(uploadIndex));
  if (modelSettings?.openaiApiKey?.trim()) {
    formData.append("openaiApiKey", modelSettings.openaiApiKey.trim());
  }
  if (modelSettings?.openaiBaseUrl?.trim()) {
    formData.append("openaiBaseUrl", modelSettings.openaiBaseUrl.trim());
  }
  if (modelSettings?.openaiModel?.trim()) {
    formData.append("openaiModel", modelSettings.openaiModel.trim());
  }
  formData.append("file", file);
  return requestJson<BackendJob>("/api/jobs", {
    method: "POST",
    body: formData
  });
}

export async function getAnalysisJob(jobId: string): Promise<BackendJob> {
  return requestJson<BackendJob>(`/api/jobs/${jobId}`);
}

export async function getAnalysisJobResult(jobId: string): Promise<BackendJobResult> {
  return requestJson<BackendJobResult>(`/api/jobs/${jobId}/result`);
}

export async function waitForAnalysisJob(
  jobId: string,
  onUpdate: (job: BackendJob) => void,
  timeoutMs = 10 * 60 * 1000
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await getAnalysisJob(jobId);
    onUpdate(job);
    if (job.status === "succeeded") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(job.errorMessage || "合同解析任务失败。");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  throw new Error("合同解析任务超时，请稍后在历史记录中查看或重试。");
}
