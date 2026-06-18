"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Loader2,
  Settings,
  UploadCloud
} from "lucide-react";
import { extractDocxText, validateDocxFile } from "@/lib/docx";
import { exportAnalysisExcel, exportBatchAnalysisExcel } from "@/lib/excel";
import {
  bulkSaveContractAnalysisRecords,
  cleanupExpiredRecords,
  clearLocalDatabase,
  listContractsByBatch,
  listRecentBatches,
  listRecentExports,
  saveBatchAnalysisRecord,
  saveContractAnalysisRecord,
  saveExportHistoryRecord
} from "@/lib/local-db";
import { normalizeAnalysisResult } from "@/lib/normalize";
import type {
  AnalysisResult,
  AnalyzeResponse,
  BatchAnalysisRecord,
  ContractAnalysisRecord,
  ContractIssue,
  ExportHistoryRecord,
  PaymentPlanItem,
  WarrantyField
} from "@/lib/types";

import { StatusBadge } from "@/app/components/StatusBadge";
import { SummaryRow } from "@/app/components/SummaryRow";
import { ProgressBar } from "@/app/components/ProgressBar";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import { SourceDrawer, type SourceItem } from "@/app/components/SourceDrawer";
import { SkeletonResultView } from "@/app/components/SkeletonResultView";
import { Toast } from "@/app/components/Toast";
import { StatusLine, statusLabel } from "@/app/components/StatusLine";
import { AnalysisResultView } from "@/app/components/AnalysisResultView";
import { BatchWorkspace } from "@/app/components/BatchWorkspace";
import { BatchHistoryPanel } from "@/app/components/BatchHistoryPanel";
import { ExportCenterPage } from "@/app/components/ExportCenterPage";
import { SettingsPage, type LlmSettings } from "@/app/components/SettingsPage";
import { EmptyStateGuide } from "@/app/components/EmptyStateGuide";
import { AppProvider, useAppState, useAppDispatch, type AppAction } from "@/app/components/AppContext";

type Status = "idle" | "uploading" | "analyzing" | "success" | "error";
type PageKey = "analysis" | "exports" | "settings";

const navItems = [
  { key: "analysis" as const, label: "合同分析", icon: FileText },
  { key: "exports" as const, label: "导出中心", icon: Loader2 },
  { key: "settings" as const, label: "设置", icon: Settings }
];

const SETTINGS_STORAGE_KEY = "contract-analyzer-demo-settings-v2";
const LEGACY_SETTINGS_STORAGE_KEY = "contract-analyzer-demo-settings";
const MAX_BATCH_FILES = 20;
const MAX_CONCURRENT = 1;

export default function HomeWrapper() {
  return <AppProvider><Home /></AppProvider>;
}

function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePage, setActivePage] = useState<PageKey>("analysis");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [includeIssues, setIncludeIssues] = useState(true);
  const [sourceItem, setSourceItem] = useState<SourceItem | null>(null);
  const [batches, setBatches] = useState<BatchAnalysisRecord[]>([]);
  const [contracts, setContracts] = useState<ContractAnalysisRecord[]>([]);
  const [exportRecords, setExportRecords] = useState<ExportHistoryRecord[]>([]);
  const [activeBatchId, setActiveBatchId] = useState("");
  const [currentContractId, setCurrentContractId] = useState("");
  const [llmSettings, setLlmSettings] = useState<LlmSettings>({
    openaiApiKey: "",
    openaiBaseUrl: "",
    openaiModel: ""
  });

  const currentContract = useMemo(
    () => contracts.find((contract) => contract.id === currentContractId) ?? null,
    [contracts, currentContractId]
  );

  const currentResult = currentContract?.result ?? result;

  const successfulContracts = useMemo(
    () => contracts.filter((contract) => contract.status === "success" && contract.result),
    [contracts]
  );

  const batchSummary = useMemo(() => {
    const successCount = contracts.filter((contract) => contract.status === "success").length;
    const failedCount = contracts.filter((contract) => contract.status === "failed").length;
    const analyzingCount = contracts.filter((contract) => contract.status === "uploading" || contract.status === "analyzing").length;
    const issueTotal = contracts.reduce((sum, contract) => sum + (contract.result?.issues.length ?? 0), 0);
    return {
      totalCount: contracts.length,
      successCount,
      failedCount,
      analyzingCount,
      issueTotal
    };
  }, [contracts]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const canStartAnalysis = selectedFiles.length > 0 && status !== "uploading" && status !== "analyzing";

  const batchProgress = useMemo(() => {
    if (contracts.length === 0) return null;
    const completed = contracts.filter((c) => c.status === "success" || c.status === "failed").length;
    return { completed, total: contracts.length };
  }, [contracts]);

  const issueCounts = useMemo(() => {
    const issues = currentResult?.issues ?? [];
    return {
      error: issues.filter((item) => item.severity === "error").length,
      warning: issues.filter((item) => item.severity === "warning").length,
      info: issues.filter((item) => item.severity === "info").length
    };
  }, [currentResult]);

  useEffect(() => {
    void cleanupExpiredRecords(15).then(refreshRecords);
    window.localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      setLlmSettings((current) => ({ ...current, ...JSON.parse(saved) }));
    }
    const theme = window.localStorage.getItem("contract-analyzer-theme");
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function showToast(message: string, tone: "success" | "error") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function refreshRecords() {
    setBatches(await listRecentBatches());
    setExportRecords(await listRecentExports());
  }

  async function openBatch(batchId: string) {
    const batchContracts = await listContractsByBatch(batchId);
    setContracts(batchContracts);
    setActiveBatchId(batchId);
    const firstSuccess = batchContracts.find((contract) => contract.status === "success" && contract.result);
    setCurrentContractId(firstSuccess?.id ?? batchContracts[0]?.id ?? "");
    setResult(firstSuccess?.result ?? null);
    setFileName(firstSuccess?.fileName ?? "");
    setStatus(firstSuccess ? "success" : batchContracts.length > 0 ? "error" : "idle");
    setMessage(firstSuccess ? "已载入批量分析记录。" : "");
    setError(firstSuccess ? "" : batchContracts.length > 0 ? "该批次暂无可查看的成功合同。" : "");
    setActivePage("analysis");
  }

  function updateContract(nextContract: ContractAnalysisRecord) {
    setContracts((items) => items.map((item) => (item.id === nextContract.id ? nextContract : item)));
  }

  function addSelectedFiles(files: File[]) {
    if (files.length === 0) return;
    setError("");
    setSelectedFiles((current) => {
      const nextFiles = [...current, ...files].slice(0, MAX_BATCH_FILES);
      if (current.length + files.length > MAX_BATCH_FILES) {
        setMessage(`已加入前 ${MAX_BATCH_FILES} 份合同，超出部分未加入。`);
      } else {
        setMessage(`已加入 ${nextFiles.length} 份待分析合同，可继续添加或点击开始分析。`);
      }
      setStatus("idle");
      setFileName(nextFiles.length === 1 ? nextFiles[0].name : `${nextFiles.length} 份待分析合同`);
      return nextFiles;
    });
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => {
      const nextFiles = current.filter((_, fileIndex) => fileIndex !== index);
      setFileName(nextFiles.length === 0 ? "" : nextFiles.length === 1 ? nextFiles[0].name : `${nextFiles.length} 份待分析合同`);
      setMessage(nextFiles.length === 0 ? "待分析列表已清空。" : `待分析列表剩余 ${nextFiles.length} 份合同。`);
      return nextFiles;
    });
  }

  function createBatch(files: File[]) {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const batchId = `b_${stamp}`;
    const createdAt = now.toISOString();
    const nextContracts: ContractAnalysisRecord[] = files.map((file, index) => {
      const uploadIndex = index + 1;
      const displayName = file.name.replace(/\.(docx|doc|pdf)$/i, "") || `合同${uploadIndex}`;
      const paddedIndex = String(uploadIndex).padStart(3, "0");
      const validationError = validateDocxFile(file);
      return {
        id: `c_${stamp}_${paddedIndex}_${crypto.randomUUID().slice(0, 8)}`,
        batchId,
        uploadIndex,
        fileName: file.name,
        displayName,
        exportName: `${paddedIndex}_${displayName}`,
        fileSize: file.size,
        status: validationError ? "failed" as const : "pending" as const,
        createdAt,
        updatedAt: createdAt,
        errorMessage: validationError ?? undefined
      };
    });
    const batch: BatchAnalysisRecord = {
      batchId,
      createdAt,
      updatedAt: createdAt,
      status: "pending",
      totalCount: nextContracts.length,
      successCount: 0,
      failedCount: nextContracts.filter((contract) => contract.status === "failed").length,
      contractIds: nextContracts.map((contract) => contract.id)
    };
    return { batch, nextContracts };
  }

  async function analyzeContract(file: File, contract: ContractAnalysisRecord) {
    const uploadingContract = { ...contract, status: "uploading" as const, updatedAt: new Date().toISOString() };
    updateContract(uploadingContract);
    await saveContractAnalysisRecord(uploadingContract);

    try {
      const contractText = await extractDocxText(file);
      const analyzingContract = { ...uploadingContract, status: "analyzing" as const, updatedAt: new Date().toISOString() };
      updateContract(analyzingContract);
      await saveContractAnalysisRecord(analyzingContract);

      const pageApiKey = llmSettings.openaiApiKey.trim();
      const pageBaseUrl = llmSettings.openaiBaseUrl.trim();
      const pageModel = llmSettings.openaiModel.trim();
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contractText,
          openaiApiKey: pageApiKey || undefined,
          openaiBaseUrl: pageBaseUrl || undefined,
          openaiModel: pageModel || undefined
        })
      });

      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) {
        throw new Error(data.message || "解析失败，请重试。");
      }

      const analysis = normalizeAnalysisResult(data);
      const successContract = {
        ...analyzingContract,
        status: "success" as const,
        result: analysis,
        errorMessage: undefined,
        updatedAt: new Date().toISOString()
      };
      updateContract(successContract);
      setResult(analysis);
      setFileName(file.name);
      setStatus("success");
      setMessage(data.message || (data.demo ? "当前为演示数据。" : "解析完成。"));
      await saveContractAnalysisRecord(successContract);
      return successContract;
    } catch (nextError) {
      const failedContract = {
        ...contract,
        status: "failed" as const,
        updatedAt: new Date().toISOString(),
        errorMessage: nextError instanceof Error ? nextError.message : "解析失败，请重试。"
      };
      updateContract(failedContract);
      await saveContractAnalysisRecord(failedContract);
      return failedContract;
    }
  }

  async function analyzeFiles(fileList: File[]) {
    setError("");
    setMessage("");
    setResult(null);

    const files = fileList.slice(0, MAX_BATCH_FILES);
    if (files.length === 0) {
      setStatus("error");
      setError("请选择 DOCX 合同文件。");
      return;
    }

    const { batch, nextContracts } = createBatch(files);
    setActiveBatchId(batch.batchId);
    setContracts(nextContracts);
    setCurrentContractId(nextContracts[0]?.id ?? "");
    setFileName(files.length === 1 ? files[0].name : `${files.length} 份合同`);
    setStatus("analyzing");
    setMessage("已创建批量分析任务。");
    await saveBatchAnalysisRecord(batch);
    await bulkSaveContractAnalysisRecords(nextContracts);

    const latestContracts = [...nextContracts];
    for (const contract of nextContracts) {
      if (contract.status === "failed") continue;
      const file = files[contract.uploadIndex - 1];
      const analyzed = await analyzeContract(file, contract);
      latestContracts[contract.uploadIndex - 1] = analyzed;
      if (!currentContractId && analyzed.status === "success") {
        setCurrentContractId(analyzed.id);
      }
    }

    const successCount = latestContracts.filter((contract) => contract.status === "success").length;
    const failedCount = latestContracts.filter((contract) => contract.status === "failed").length;
    const finalBatch: BatchAnalysisRecord = {
      ...batch,
      updatedAt: new Date().toISOString(),
      status: successCount === latestContracts.length
        ? "success"
        : successCount > 0
          ? "partial_success"
          : "failed",
      successCount,
      failedCount
    };
    setContracts(latestContracts);
    const firstSuccess = latestContracts.find((contract) => contract.status === "success" && contract.result);
    if (firstSuccess) {
      setCurrentContractId(firstSuccess.id);
      setResult(firstSuccess.result ?? null);
      setFileName(firstSuccess.fileName);
    }
    setStatus(successCount > 0 ? "success" : "error");
    setError(successCount > 0 ? "" : "本批次合同均未解析成功，请检查文件或模型配置。");
    setMessage(`批量分析完成：${successCount} 份成功，${failedCount} 份失败。`);
    showToast(`批量分析完成：${successCount} 份成功，${failedCount} 份失败`, successCount > 0 ? "success" : "error");
    await saveBatchAnalysisRecord(finalBatch);
    await refreshRecords();
    setSelectedFiles([]);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addSelectedFiles(Array.from(event.dataTransfer.files));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) addSelectedFiles(files);
    event.target.value = "";
  }

  function handleStartAnalysis() {
    void analyzeFiles(selectedFiles);
  }

  async function handleContractExport(contract: ContractAnalysisRecord) {
    if (!contract.result) return;
    await exportAnalysisExcel(contract.fileName, contract.result, includeIssues, contract.exportName);
    await saveExportHistoryRecord({
      id: crypto.randomUUID(),
      batchId: contract.batchId,
      contractId: contract.id,
      fileName: `合同分析结果_${contract.exportName}.xlsx`,
      mode: "single",
      createdAt: new Date().toISOString()
    });
    await refreshRecords();
  }

  async function handleBatchExport() {
    if (!activeBatchId || successfulContracts.length === 0) return;
    await exportBatchAnalysisExcel(activeBatchId, contracts, includeIssues);
    await saveExportHistoryRecord({
      id: crypto.randomUUID(),
      batchId: activeBatchId,
      fileName: `合同批量分析结果_${activeBatchId}.xlsx`,
      mode: "batch",
      createdAt: new Date().toISOString()
    });
    await refreshRecords();
  }

  async function retryContract(contract: ContractAnalysisRecord) {
    setError("");
    setMessage(`请重新选择 ${contract.fileName} 后再次分析。`);
  }

  function saveSettings(nextSettings: LlmSettings) {
    setLlmSettings(nextSettings);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    setMessage("设置已保存到当前浏览器。");
  }

  return (
    <main className={sidebarCollapsed ? "shell collapsed" : "shell"}>
      <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="brand">
          <img className="logo" src="/feidu-logo.png" alt="飞渡 Logo" />
          <div className="brand-text">
            <strong>飞渡</strong>
            <span>合同智能平台</span>
          </div>
        </div>

        <button
          className="collapse-button"
          type="button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          title={sidebarCollapsed ? "展开导航" : "收起导航"}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <span>{sidebarCollapsed ? "展开" : "收起"}</span>
        </button>

        <nav className="nav">
          <span className="nav-caption">主导航</span>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activePage === item.key ? "nav-item active" : "nav-item"}
              type="button"
              title={item.label}
              aria-current={activePage === item.key ? "page" : undefined}
              onClick={() => setActivePage(item.key)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="review-note">
          <FileCheck2 size={18} />
          <div>
            <strong>AI 结果仅供参考</strong>
            <span>关键条款建议人工复核</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        {activePage === "analysis" ? (
          <>
            <header className="topbar">
              <div>
                <p>合同分析</p>
                <h1>上传一批 DOCX 合同并生成结构化分析结果</h1>
              </div>
              <div className="badges">
                <span>v2 批量分析</span>
                <span>支持汇总导出</span>
              </div>
            </header>

            <section className="grid">
              <div className="panel upload-panel">
                <div className="panel-title">
                  <div>
                    <h2>上传合同</h2>
                    <p>支持 DOCX，多选或拖拽上传，单文件不超过 20MB。</p>
                  </div>
                  <button className="secondary" type="button" onClick={() => fileInputRef.current?.click()}>
                    选择合同
                  </button>
                </div>

                <div
                  className={status === "error" ? "dropzone error" : "dropzone"}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <UploadCloud size={42} />
                  <strong>点击或拖拽添加 DOCX 合同</strong>
                  <span>可分多次添加，点击开始分析后统一生成批次</span>
                  <input ref={fileInputRef} type="file" accept=".docx" multiple onChange={handleFileChange} hidden />
                </div>

                {selectedFiles.length > 0 ? (
                  <div className="pending-files">
                    <div className="pending-files-title">
                      <strong>待分析合同</strong>
                      <span>{selectedFiles.length} / {MAX_BATCH_FILES} 份</span>
                    </div>
                    <div className="pending-file-list">
                      {selectedFiles.map((file, index) => (
                        <div className="pending-file" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                          <span>{String(index + 1).padStart(3, "0")} · {file.name}</span>
                          <button type="button" onClick={() => removeSelectedFile(index)}>移除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button className="primary start-analysis-button" type="button" disabled={!canStartAnalysis} onClick={handleStartAnalysis}>
                  <Loader2 size={18} className={status === "analyzing" || status === "uploading" ? "spin" : undefined} />
                  开始分析
                </button>

                <div aria-live="polite">
                  <StatusLine status={status} fileName={fileName} error={error} message={message} />
                </div>
                {batchProgress && status === "analyzing" ? (
                  <ProgressBar completed={batchProgress.completed} total={batchProgress.total} />
                ) : null}
              </div>

              <div className="panel summary-panel">
                <h2>批量摘要</h2>
                <SummaryRow label="解析状态" value={statusLabel(status)} />
                <SummaryRow label="当前批次" value={activeBatchId || "待创建"} />
                <SummaryRow
                  label="合同数量"
                  value={batchSummary.totalCount ? `${batchSummary.totalCount} 份` : selectedFiles.length ? `${selectedFiles.length} 份待分析` : "待上传"}
                />
                <SummaryRow label="成功 / 失败" value={`${batchSummary.successCount} / ${batchSummary.failedCount}`} />
                <SummaryRow
                  label="问题总数"
                  value={batchSummary.totalCount ? `${batchSummary.issueTotal} 个` : "待解析"}
                  accent={batchSummary.issueTotal ? "warning" : undefined}
                />
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeIssues}
                    onChange={(event) => setIncludeIssues(event.target.checked)}
                  />
                  包含合同问题 Sheet
                </label>
                <button className="secondary full-button" type="button" disabled={successfulContracts.length === 0} onClick={() => void handleBatchExport()}>
                  <UploadCloud size={18} />
                  导出批量汇总
                </button>
              </div>
            </section>

            {contracts.length > 0 ? (
              <BatchWorkspace
                contracts={contracts}
                currentContractId={currentContractId}
                onSelectContract={(contract) => {
                  setCurrentContractId(contract.id);
                  setResult(contract.result ?? null);
                  setFileName(contract.fileName);
                }}
                onRetryContract={(contract) => void retryContract(contract)}
                onExportContract={(contract) => void handleContractExport(contract)}
              />
            ) : null}

            {status === "analyzing" || status === "uploading" ? (
              <SkeletonResultView />
            ) : currentResult ? (
              <AnalysisResultView
                result={currentResult}
                issueCounts={issueCounts}
                currentContract={currentContract}
                onOpenSource={setSourceItem}
              />
            ) : (
              <section className="empty-state">
                <EmptyStateGuide onUpload={() => fileInputRef.current?.click()} />
                <button className="secondary" type="button" onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud size={18} />
                  上传第一份合同
                </button>
              </section>
            )}

            <BatchHistoryPanel batches={batches} onOpenBatch={(batchId) => void openBatch(batchId)} />
          </>
        ) : activePage === "exports" ? (
          <ExportCenterPage
            batches={batches}
            contracts={contracts}
            exportRecords={exportRecords}
            activeBatchId={activeBatchId}
            onOpenBatch={openBatch}
            onBatchExport={() => void handleBatchExport()}
          />
        ) : activePage === "settings" ? (
          <SettingsPage
            settings={llmSettings}
            onSave={saveSettings}
            onClearLocalData={() => setShowClearConfirm(true)}
          />
        ) : null}
      </section>

      {showClearConfirm ? (
        <ConfirmDialog
          title="确认清除本地数据"
          description="该操作将清除当前浏览器中保存的模型配置、合同分析记录和临时状态，且不可恢复。已下载到电脑的 Excel 文件不受影响。"
          confirmLabel="确认清除"
          onConfirm={async () => {
            await clearLocalDatabase();
            window.localStorage.clear();
            window.sessionStorage.clear();
            setBatches([]);
            setContracts([]);
            setExportRecords([]);
            setActiveBatchId("");
            setCurrentContractId("");
            setSelectedFiles([]);
            setResult(null);
            setFileName("");
            setError("");
            setMessage("");
            setStatus("idle");
            setLlmSettings({ openaiApiKey: "", openaiBaseUrl: "", openaiModel: "" });
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      ) : null}

      {sourceItem ? <SourceDrawer item={sourceItem} onClose={() => setSourceItem(null)} /> : null}

      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </main>
  );
}
