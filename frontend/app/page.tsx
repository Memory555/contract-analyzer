"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
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
import { exportAnalysisExcel } from "@/lib/excel";
import { cleanupExpiredRecords, listRecentRecords, saveAnalysisRecord } from "@/lib/local-db";
import type {
  AnalysisRecord,
  AnalysisResult,
  AnalyzeResponse,
  ContractIssue,
  PaymentPlanItem,
  WarrantyField
} from "@/lib/types";

type Status = "idle" | "uploading" | "analyzing" | "success" | "error";
type SourceItem = ContractIssue | PaymentPlanItem | WarrantyField;
type PageKey = "dashboard" | "analysis" | "review" | "exports" | "settings";
type LlmSettings = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
};

const navItems = [
  { key: "dashboard" as const, label: "工作台", icon: BarChart3 },
  { key: "analysis" as const, label: "合同分析", icon: FileText },
  { key: "review" as const, label: "问题审查", icon: AlertTriangle },
  { key: "exports" as const, label: "导出中心", icon: Download },
  { key: "settings" as const, label: "设置", icon: Settings }
];

const severityMap = {
  error: "错误",
  warning: "警告",
  info: "提示"
};

const placeholderCopy: Record<Exclude<PageKey, "analysis" | "settings">, { title: string; body: string }> = {
  dashboard: {
    title: "工作台",
    body: "这里后续会展示最近分析任务、问题统计、待复核事项和导出概览。"
  },
  review: {
    title: "问题审查",
    body: "这里后续会聚合合同中的条款矛盾、数值缺失、逻辑冲突和提示类问题。"
  },
  exports: {
    title: "导出中心",
    body: "这里后续会管理 Excel 导出记录、导出模板和批量下载任务。"
  }
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePage, setActivePage] = useState<PageKey>("analysis");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [includeIssues, setIncludeIssues] = useState(true);
  const [sourceItem, setSourceItem] = useState<SourceItem | null>(null);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [llmSettings, setLlmSettings] = useState<LlmSettings>({
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-4.1-mini"
  });

  const issueCounts = useMemo(() => {
    const issues = result?.issues ?? [];
    return {
      error: issues.filter((item) => item.severity === "error").length,
      warning: issues.filter((item) => item.severity === "warning").length,
      info: issues.filter((item) => item.severity === "info").length
    };
  }, [result]);

  useEffect(() => {
    void cleanupExpiredRecords(15).then(refreshRecords);
    const saved = window.localStorage.getItem("contract-analyzer-demo-settings");
    if (saved) {
      setLlmSettings((current) => ({ ...current, ...JSON.parse(saved) }));
    }
  }, []);

  async function refreshRecords() {
    const recent = await listRecentRecords();
    setRecords(recent);
  }

  async function analyzeFile(file: File) {
    setError("");
    setMessage("");
    setResult(null);

    const validationError = validateDocxFile(file);
    if (validationError) {
      setStatus("error");
      setError(validationError);
      return;
    }

    try {
      setFileName(file.name);
      setStatus("uploading");
      const contractText = await extractDocxText(file);

      setStatus("analyzing");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contractText,
          openaiApiKey: llmSettings.openaiApiKey.trim() || undefined,
          openaiBaseUrl: llmSettings.openaiBaseUrl.trim() || undefined,
          openaiModel: llmSettings.openaiModel.trim() || undefined
        })
      });

      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) {
        throw new Error(data.message || "解析失败，请重试。");
      }

      const analysis: AnalysisResult = {
        issues: data.issues,
        payment_plan: data.payment_plan,
        warranty: data.warranty,
        confidence: data.confidence
      };

      setResult(analysis);
      setMessage(data.message || (data.demo ? "当前为演示数据。" : "解析完成。"));
      setStatus("success");

      await saveAnalysisRecord({
        id: crypto.randomUUID(),
        fileName: file.name,
        createdAt: new Date().toISOString(),
        result: analysis
      });
      await refreshRecords();
    } catch (nextError) {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "解析失败，请重试。");
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void analyzeFile(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void analyzeFile(file);
    event.target.value = "";
  }

  async function handleExport() {
    if (!result || !fileName) return;
    await exportAnalysisExcel(fileName, result, includeIssues);
  }

  function loadRecord(record: AnalysisRecord) {
    setResult(record.result);
    setFileName(record.fileName);
    setStatus("success");
    setMessage("已载入浏览器本地历史记录。");
    setError("");
    setActivePage("analysis");
  }

  function saveSettings(nextSettings: LlmSettings) {
    setLlmSettings(nextSettings);
    window.localStorage.setItem("contract-analyzer-demo-settings", JSON.stringify(nextSettings));
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
                <p>合同分析 / 单合同解析</p>
                <h1>上传 DOCX 合同并生成结构化分析结果</h1>
              </div>
              <div className="badges">
                <span>Demo V0.1</span>
                <span>DOCX only</span>
                <span>Vercel ready</span>
              </div>
            </header>

            <section className="grid">
              <div className="panel upload-panel">
                <div className="panel-title">
                  <div>
                    <h2>上传合同</h2>
                    <p>支持 DOCX，单文件不超过 20MB。</p>
                  </div>
                  <button className="secondary" type="button" onClick={() => fileInputRef.current?.click()}>
                    选择文件
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
                  <strong>点击或拖拽上传 DOCX 合同</strong>
                  <span>上传后自动提取付款计划、质保明细与合同问题</span>
                  <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileChange} hidden />
                </div>

                <StatusLine status={status} fileName={fileName} error={error} message={message} />
              </div>

              <div className="panel summary-panel">
                <h2>任务摘要</h2>
                <SummaryRow label="解析状态" value={statusLabel(status)} />
                <SummaryRow label="合同文件" value={fileName || "待上传"} />
                <SummaryRow
                  label="问题数量"
                  value={result ? `${result.issues.length} 个` : "待解析"}
                  accent={result ? "warning" : undefined}
                />
                <SummaryRow
                  label="整体置信度"
                  value={result ? `${Math.round(result.confidence.overall * 100)}%` : "待解析"}
                />
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeIssues}
                    onChange={(event) => setIncludeIssues(event.target.checked)}
                  />
                  包含合同问题 Sheet
                </label>
                <button className="primary" type="button" disabled={!result} onClick={() => void handleExport()}>
                  <Download size={18} />
                  下载 Excel
                </button>
              </div>
            </section>

            {result ? (
              <AnalysisResultView
                result={result}
                issueCounts={issueCounts}
                onOpenSource={setSourceItem}
              />
            ) : (
              <section className="empty-state">
                <FileText size={40} />
                <h2>等待上传合同</h2>
                <p>上传 DOCX 后，这里会展示合同问题、付款计划、质保明细和 Excel 下载入口。</p>
              </section>
            )}

            <HistoryPanel records={records} onLoadRecord={loadRecord} />
          </>
        ) : activePage === "settings" ? (
          <SettingsPage settings={llmSettings} onSave={saveSettings} />
        ) : (
          <PlaceholderPage page={activePage} />
        )}
      </section>

      {sourceItem ? <SourceDrawer item={sourceItem} onClose={() => setSourceItem(null)} /> : null}
    </main>
  );
}

function AnalysisResultView({
  result,
  issueCounts,
  onOpenSource
}: {
  result: AnalysisResult;
  issueCounts: { error: number; warning: number; info: number };
  onOpenSource: (item: SourceItem) => void;
}) {
  return (
    <section className="results">
      <div className="result-heading">
        <div>
          <h2>分析结果</h2>
          <p>优先查看问题提示，再核对结构化明细。置信度不代表法律结论。</p>
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
  onSave
}: {
  settings: LlmSettings;
  onSave: (settings: LlmSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [openSection, setOpenSection] = useState<"model" | "about">("model");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  return (
    <>
      <header className="topbar">
        <div>
          <p>设置 / 模型配置</p>
          <h1>平台设置</h1>
        </div>
        <div className="badges">
          <span>本地保存</span>
          <span>Demo 配置</span>
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
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                API Key
                <input
                  value={draft.openaiApiKey}
                  onChange={(event) => setDraft({ ...draft, openaiApiKey: event.target.value })}
                  type="password"
                  placeholder="不填写则使用服务端环境变量；若服务端也未配置，将无法解析"
                />
              </label>
              <label>
                模型名称
                <input
                  value={draft.openaiModel}
                  onChange={(event) => setDraft({ ...draft, openaiModel: event.target.value })}
                  placeholder="gpt-4.1-mini"
                />
              </label>
              <p className="settings-note">
                Demo 支持在浏览器临时配置 Key。正式生产环境建议使用 Vercel 服务端环境变量，减少密钥暴露风险。
              </p>
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
                  <dt>部署形态</dt>
                  <dd>Next.js / Vercel</dd>
                </div>
                <div>
                  <dt>数据说明</dt>
                  <dd>历史记录保存在当前浏览器 IndexedDB 中。</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </article>
      </section>
    </>
  );
}

function PlaceholderPage({ page }: { page: Exclude<PageKey, "analysis" | "settings"> }) {
  const copy = placeholderCopy[page];
  return (
    <>
      <header className="topbar">
        <div>
          <p>{copy.title} / 待开发</p>
          <h1>{copy.title}</h1>
        </div>
        <div className="badges">
          <span>预留模块</span>
        </div>
      </header>
      <section className="panel placeholder-panel">
        <FileCheck2 size={42} />
        <h2>该模块待进一步开发</h2>
        <p>{copy.body}</p>
      </section>
    </>
  );
}

function HistoryPanel({
  records,
  onLoadRecord
}: {
  records: AnalysisRecord[];
  onLoadRecord: (record: AnalysisRecord) => void;
}) {
  return (
    <section className="panel history-panel">
      <div className="panel-title compact">
        <h2>
          <History size={18} />
          最近分析记录
        </h2>
        <span className="muted">仅保存在当前浏览器</span>
      </div>
      {records.length === 0 ? (
        <p className="empty">暂无本地记录。</p>
      ) : (
        <div className="record-list">
          {records.map((record) => (
            <button key={record.id} type="button" onClick={() => onLoadRecord(record)}>
              <strong>{record.fileName}</strong>
              <span>{new Date(record.createdAt).toLocaleString("zh-CN")}</span>
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
  if (status === "idle") return <p className="status-line">请选择 DOCX 合同文件开始分析。</p>;
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
