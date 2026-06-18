"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  History,
  Loader2,
  Search,
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
  ContractIssue,
  ContractAnalysisRecord,
  ExportHistoryRecord,
  PaymentPlanItem,
  WarrantyField
} from "@/lib/types";

type Status = "idle" | "uploading" | "analyzing" | "success" | "error";
type SourceItem = ContractIssue | PaymentPlanItem | WarrantyField;
type PageKey = "analysis" | "exports" | "settings";
type LlmSettings = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
};

const navItems = [
  { key: "analysis" as const, label: "合同分析", icon: FileText },
  { key: "exports" as const, label: "导出中心", icon: Download },
  { key: "settings" as const, label: "设置", icon: Settings }
];

const severityMap = {
  error: "错误",
  warning: "警告",
  info: "提示"
};

const SETTINGS_STORAGE_KEY = "contract-analyzer-demo-settings-v2";
const LEGACY_SETTINGS_STORAGE_KEY = "contract-analyzer-demo-settings";
const MAX_BATCH_FILES = 20;

export default function Home() {
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

  const canStartAnalysis = selectedFiles.length > 0 && status !== "uploading" && status !== "analyzing";

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
  }, []);

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

                <StatusLine status={status} fileName={fileName} error={error} message={message} />
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
                  <Download size={18} />
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

            {currentResult ? (
              <AnalysisResultView
                result={currentResult}
                issueCounts={issueCounts}
                currentContract={currentContract}
                onOpenSource={setSourceItem}
              />
            ) : (
              <section className="empty-state">
                <FileText size={40} />
                <h2>等待上传合同</h2>
                <p>上传 DOCX 后，这里会展示批量任务、单合同详情和 Excel 导出入口。</p>
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
            onClearLocalData={async () => {
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
            }}
          />
        ) : null}
      </section>

      {sourceItem ? <SourceDrawer item={sourceItem} onClose={() => setSourceItem(null)} /> : null}
    </main>
  );
}

function BatchWorkspace({
  contracts,
  currentContractId,
  onSelectContract,
  onRetryContract,
  onExportContract
}: {
  contracts: ContractAnalysisRecord[];
  currentContractId: string;
  onSelectContract: (contract: ContractAnalysisRecord) => void;
  onRetryContract: (contract: ContractAnalysisRecord) => void;
  onExportContract: (contract: ContractAnalysisRecord) => void;
}) {
  return (
    <section className="panel batch-panel">
      <div className="panel-title compact">
        <h2>批量任务列表</h2>
        <span className="muted">同名合同通过上传序号和合同ID区分</span>
      </div>
      <div className="table-wrap">
        <table className="batch-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>合同名称</th>
              <th>原始文件名</th>
              <th>状态</th>
              <th>问题</th>
              <th>付款</th>
              <th>质保</th>
              <th>置信度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const warrantyCount =
                (contract.result?.warranty.core_fields.length ?? 0) + (contract.result?.warranty.extra_fields.length ?? 0);
              return (
                <tr key={contract.id} className={contract.id === currentContractId ? "selected-row" : undefined}>
                  <td>{String(contract.uploadIndex).padStart(3, "0")}</td>
                  <td>
                    <strong>{contract.displayName}</strong>
                    <span>{contract.id}</span>
                  </td>
                  <td>{contract.fileName}</td>
                  <td><StatusBadge status={contract.status} /></td>
                  <td>{contract.result?.issues.length ?? "-"}</td>
                  <td>{contract.result?.payment_plan.length ?? "-"}</td>
                  <td>{contract.result ? warrantyCount : "-"}</td>
                  <td>{contract.result ? `${Math.round(contract.result.confidence.overall * 100)}%` : "-"}</td>
                  <td>
                    {contract.status === "failed" ? (
                      <button className="link-button danger-link" type="button" onClick={() => onRetryContract(contract)}>
                        重试
                      </button>
                    ) : (
                      <div className="row-actions">
                        <button className="link-button" type="button" onClick={() => onSelectContract(contract)} disabled={!contract.result}>
                          查看详情
                        </button>
                        <button className="link-button" type="button" onClick={() => onExportContract(contract)} disabled={!contract.result}>
                          导出合同
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: ContractAnalysisRecord["status"] }) {
  const labels: Record<ContractAnalysisRecord["status"], string> = {
    pending: "等待",
    uploading: "提取中",
    analyzing: "分析中",
    success: "完成",
    failed: "失败",
    cancelled: "取消"
  };
  const tone = status === "success" ? "success" : status === "failed" ? "error" : status === "pending" ? "neutral" : "info";
  return <span className={`status-badge ${tone}`}>{labels[status]}</span>;
}

function AnalysisResultView({
  result,
  issueCounts,
  currentContract,
  onOpenSource
}: {
  result: AnalysisResult;
  issueCounts: { error: number; warning: number; info: number };
  currentContract: ContractAnalysisRecord | null;
  onOpenSource: (item: SourceItem) => void;
}) {
  return (
    <section className="results">
      <div className="result-heading">
        <div>
          <h2>{currentContract ? `${currentContract.exportName} 分析结果` : "分析结果"}</h2>
          <p>
            {currentContract
              ? `批次：${currentContract.batchId}，原始文件名：${currentContract.fileName}`
              : "优先查看问题提示，再核对结构化明细。置信度不代表法律结论。"}
          </p>
        </div>
        <div className="confidence">
          <span>付款 {Math.round(result.confidence.payment_plan * 100)}%</span>
          <span>质保 {Math.round(result.confidence.warranty * 100)}%</span>
          <span>问题 {Math.round(result.confidence.issues * 100)}%</span>
        </div>
      </div>

      <section className="panel issue-panel">
        <div className="panel-title compact">
          <h2>合同问题提示</h2>
          <div className="issue-counts">
            <span className="tag error">错误 {issueCounts.error}</span>
            <span className="tag warning">警告 {issueCounts.warning}</span>
            <span className="tag info">提示 {issueCounts.info}</span>
          </div>
        </div>
        {result.issues.length === 0 ? (
          <p className="empty">未发现合同问题。</p>
        ) : (
          <div className="issue-list">
            {result.issues.map((issue) => (
              <article key={issue.id} className={`issue-card ${issue.severity}`}>
                <span className={`tag ${issue.severity}`}>{severityMap[issue.severity]}</span>
                <strong>{issue.type}</strong>
                <p>{issue.description}</p>
                <button type="button" onClick={() => onOpenSource(issue)}>
                  <Search size={15} />
                  查看原文位置：{issue.location || "未标明"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>付款计划明细</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>阶段</th>
                <th>比例</th>
                <th>付款描述</th>
                <th>支付时限</th>
                <th>备注</th>
                <th>位置</th>
              </tr>
            </thead>
            <tbody>
              {result.payment_plan.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.stage}</strong>
                    <span>{item.name}</span>
                  </td>
                  <td>{item.percentage}</td>
                  <td>{item.conditions.map((condition) => <div key={condition}>{condition}</div>)}</td>
                  <td>{item.deadline}</td>
                  <td>{item.note}</td>
                  <td>
                    <button className="link-button" type="button" onClick={() => onOpenSource(item)}>
                      {item.location || "查看"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>质保明细</h2>
          <span className="muted">核心字段 + LLM 扩展字段</span>
        </div>
        <WarrantyTable title="核心字段" items={result.warranty.core_fields} onOpenSource={onOpenSource} />
        <WarrantyTable title="扩展字段" items={result.warranty.extra_fields} onOpenSource={onOpenSource} />
      </section>
    </section>
  );
}

function SettingsPage({
  settings,
  onSave,
  onClearLocalData
}: {
  settings: LlmSettings;
  onSave: (settings: LlmSettings) => void;
  onClearLocalData: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [openSection, setOpenSection] = useState<"model" | "about">("model");
  const [savedFlash, setSavedFlash] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: "idle" | "testing" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [clearFlash, setClearFlash] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function testModelService() {
    setTestStatus({ type: "testing", message: "正在测试模型服务连通性..." });
    try {
      const response = await fetch("/api/model-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: draft.openaiApiKey.trim() || undefined,
          openaiBaseUrl: draft.openaiBaseUrl.trim() || undefined,
          openaiModel: draft.openaiModel.trim() || undefined
        })
      });
      const data = (await response.json()) as { message?: string; model?: string; baseURL?: string };
      if (!response.ok) {
        throw new Error(data.message || "模型服务联通测试失败。");
      }
      setTestStatus({
        type: "success",
        message: `联通成功：${data.model || "当前模型"}，${data.baseURL || "当前地址"}`
      });
    } catch (error) {
      setTestStatus({
        type: "error",
        message: error instanceof Error ? error.message : "模型服务联通测试失败。"
      });
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p>设置 / 模型配置</p>
          <h1>平台设置</h1>
        </div>
        <div className="badges">
          <span>本地保存</span>
          <span>模型配置</span>
        </div>
      </header>

      <section className="settings-list">
        <article className={openSection === "model" ? "settings-item open" : "settings-item"}>
          <button className="settings-summary" type="button" onClick={() => setOpenSection("model")}>
            <span>
              <strong>模型服务配置</strong>
              <small>配置 OpenAI 或兼容 OpenAI 协议的服务地址、Key 和模型名</small>
            </span>
            <span>{openSection === "model" ? "收起" : "展开"}</span>
          </button>
          {openSection === "model" ? (
            <div className="settings-content settings-panel">
              <label>
                Base URL
                <input
                  value={draft.openaiBaseUrl}
                  onChange={(event) => setDraft({ ...draft, openaiBaseUrl: event.target.value })}
                  placeholder="留空或官方地址走全局变量；自定义地址需填写 API Key"
                />
              </label>
              <label>
                API Key
                <input
                  value={draft.openaiApiKey}
                  onChange={(event) => setDraft({ ...draft, openaiApiKey: event.target.value })}
                  type="password"
                  placeholder="官方地址可留空走全局变量；自定义地址需填写"
                />
              </label>
              <label>
                模型名称
                <input
                  value={draft.openaiModel}
                  onChange={(event) => setDraft({ ...draft, openaiModel: event.target.value })}
                  placeholder="留空则使用 Vercel 环境变量 OPENAI_MODEL"
                />
              </label>
              <div className="settings-actions">
                <button
                  className={savedFlash ? "primary settings-save saved" : "primary settings-save"}
                  type="button"
                  onClick={() => {
                    onSave(draft);
                    setSavedFlash(true);
                    window.setTimeout(() => setSavedFlash(false), 1600);
                  }}
                >
                  {savedFlash ? "已保存" : "保存设置"}
                </button>
                <button
                  className="secondary settings-test"
                  type="button"
                  disabled={testStatus.type === "testing"}
                  onClick={() => void testModelService()}
                >
                  {testStatus.type === "testing" ? "测试中..." : "联通测试"}
                </button>
              </div>
              {testStatus.type !== "idle" ? (
                <p className={`test-result ${testStatus.type}`}>{testStatus.message}</p>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className={openSection === "about" ? "settings-item open" : "settings-item"}>
          <button className="settings-summary" type="button" onClick={() => setOpenSection("about")}>
            <span>
              <strong>关于平台</strong>
              <small>查看当前 Demo 的能力范围、版本和数据说明</small>
            </span>
            <span>{openSection === "about" ? "收起" : "展开"}</span>
          </button>
          {openSection === "about" ? (
            <div className="settings-content about-panel">
              <p>
                合同智能分析平台用于将 DOCX 合同中的付款计划、质保明细和合同问题结构化展示，并支持 Excel 导出。
              </p>
              <dl>
                <div>
                  <dt>当前版本</dt>
                  <dd>Demo V0.1</dd>
                </div>
                <div>
                  <dt>文件范围</dt>
                  <dd>仅 DOCX</dd>
                </div>
                <div>
                  <dt>页面形态</dt>
                  <dd>Next.js</dd>
                </div>
                <div>
                  <dt>数据说明</dt>
                  <dd>历史记录保存在当前浏览器 IndexedDB 中。</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </article>

        <article className="settings-item">
          <button className="settings-summary" type="button">
            <span>
              <strong>本地数据管理</strong>
              <small>清除当前浏览器中保存的模型配置、合同分析记录和临时状态</small>
            </span>
          </button>
          <div className="settings-content settings-panel">
            <p className="settings-note">
              该操作只影响当前浏览器，不会删除已经下载到电脑上的 Excel 文件，也不会影响 Vercel 环境变量。
            </p>
            <button
              className={clearFlash ? "danger-button cleared" : "danger-button"}
              type="button"
              onClick={async () => {
                await onClearLocalData();
                setDraft({ openaiApiKey: "", openaiBaseUrl: "", openaiModel: "" });
                setTestStatus({ type: "idle", message: "" });
                setClearFlash(true);
                window.setTimeout(() => setClearFlash(false), 1600);
              }}
            >
              {clearFlash ? "已清除" : "清除本地数据"}
            </button>
          </div>
        </article>
      </section>
    </>
  );
}

function ExportCenterPage({
  batches,
  contracts,
  exportRecords,
  activeBatchId,
  onOpenBatch,
  onBatchExport
}: {
  batches: BatchAnalysisRecord[];
  contracts: ContractAnalysisRecord[];
  exportRecords: ExportHistoryRecord[];
  activeBatchId: string;
  onOpenBatch: (batchId: string) => Promise<void>;
  onBatchExport: () => void;
}) {
  const activeSuccessCount = contracts.filter((contract) => contract.status === "success" && contract.result).length;
  return (
    <>
      <header className="topbar">
        <div>
          <p>导出中心 / 批量结果</p>
          <h1>导出中心</h1>
        </div>
        <div className="badges">
          <span>单合同导出</span>
          <span>批量汇总 Excel</span>
        </div>
      </header>

      <section className="export-grid">
        <article className="panel">
          <div className="panel-title compact">
            <h2>最近批量任务</h2>
            <span className="muted">仅保存在当前浏览器</span>
          </div>
          {batches.length === 0 ? (
            <p className="empty">暂无批量任务。</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>批次ID</th>
                    <th>合同数</th>
                    <th>成功 / 失败</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.batchId}>
                      <td>{batch.batchId}</td>
                      <td>{batch.totalCount}</td>
                      <td>{batch.successCount} / {batch.failedCount}</td>
                      <td>{batchStatusLabel(batch.status)}</td>
                      <td>
                        <button className="link-button" type="button" onClick={() => void onOpenBatch(batch.batchId)}>
                          打开批次
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel export-actions-panel">
          <div className="panel-title compact">
            <h2>当前批次导出</h2>
            <span className="muted">{activeBatchId || "未选择批次"}</span>
          </div>
          <p className="export-note">
            批量汇总 Excel 会把本批次合同集中到同一个文件，并在每一行写入批次ID、上传序号、合同ID、合同名称和原始文件名。
          </p>
          <SummaryRow label="可汇总合同" value={`${activeSuccessCount} 份`} />
          <SummaryRow label="当前任务数" value={`${contracts.length} 份`} />
          <button className="primary" type="button" disabled={activeSuccessCount === 0} onClick={onBatchExport}>
            <Download size={18} />
            导出全部合同汇总表
          </button>
        </article>
      </section>

      <section className="panel history-panel">
        <div className="panel-title compact">
          <h2>导出记录</h2>
          <span className="muted">记录最近导出的文件名</span>
        </div>
        {exportRecords.length === 0 ? (
          <p className="empty">暂无导出记录。</p>
        ) : (
          <div className="record-list">
            {exportRecords.map((record) => (
              <button key={record.id} type="button">
                <strong>{record.fileName}</strong>
                <span>{record.mode === "batch" ? "批量汇总" : "单合同"} · {new Date(record.createdAt).toLocaleString("zh-CN")}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function BatchHistoryPanel({
  batches,
  onOpenBatch
}: {
  batches: BatchAnalysisRecord[];
  onOpenBatch: (batchId: string) => void;
}) {
  return (
    <section className="panel history-panel">
      <div className="panel-title compact">
        <h2>
          <History size={18} />
          最近批量任务
        </h2>
        <span className="muted">仅保存在当前浏览器</span>
      </div>
      {batches.length === 0 ? (
        <p className="empty">暂无批量任务。</p>
      ) : (
        <div className="record-list">
          {batches.map((batch) => (
            <button key={batch.batchId} type="button" onClick={() => onOpenBatch(batch.batchId)}>
              <strong>{batch.batchId}</strong>
              <span>
                {batch.totalCount} 份合同 · {batch.successCount} 成功 / {batch.failedCount} 失败 · {new Date(batch.createdAt).toLocaleString("zh-CN")}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    idle: "待上传",
    uploading: "提取文本中",
    analyzing: "AI 解析中",
    success: "解析完成",
    error: "需要处理"
  };
  return labels[status];
}

function batchStatusLabel(status: BatchAnalysisRecord["status"]) {
  const labels: Record<BatchAnalysisRecord["status"], string> = {
    pending: "等待分析",
    analyzing: "正在分析",
    partial_success: "部分成功",
    success: "全部完成",
    failed: "全部失败",
    cancelled: "已取消"
  };
  return labels[status];
}

function StatusLine({
  status,
  fileName,
  error,
  message
}: {
  status: Status;
  fileName: string;
  error: string;
  message: string;
}) {
  if (status === "idle") return <p className="status-line">{message || "请选择 DOCX 合同文件加入待分析列表。"}</p>;
  if (status === "uploading" || status === "analyzing") {
    return (
      <p className="status-line active">
        <Loader2 size={16} className="spin" />
        {status === "uploading" ? "正在提取 DOCX 文本" : "正在分析合同，预计 10-30 秒"}：{fileName}
      </p>
    );
  }
  if (status === "error") return <p className="status-line danger">{error}</p>;
  return <p className="status-line success">{message || "解析完成。"} 文件：{fileName}</p>;
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <div className={accent ? `summary-row ${accent}` : "summary-row"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WarrantyTable({
  title,
  items,
  onOpenSource
}: {
  title: string;
  items: WarrantyField[];
  onOpenSource: (item: WarrantyField) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="warranty-block">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>内容</th>
              <th>备注</th>
              <th>位置</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.field}</td>
                <td>{item.content}</td>
                <td>{item.note}</td>
                <td>
                  <button className="link-button" type="button" onClick={() => onOpenSource(item)}>
                    {item.location || "查看"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceDrawer({ item, onClose }: { item: SourceItem; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p>合同原文定位</p>
            <h2>{"type" in item ? item.type : "field" in item ? item.field : item.stage}</h2>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
        <div className="source-meta">
          <span>涉及位置</span>
          <strong>{item.location || "未标明"}</strong>
        </div>
        <pre>{item.sourceText || "暂无原文片段。"}</pre>
      </aside>
    </div>
  );
}
