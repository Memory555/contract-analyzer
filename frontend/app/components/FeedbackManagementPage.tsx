"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Cloud, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { listRecentFeedbacks, listRecentSuccessfulContracts, saveFeedbackRecord } from "@/lib/local-db";
import { authedFetch } from "@/lib/user-id";
import type { AnalysisFeedbackRecord, ContractAnalysisRecord, FeedbackProblemCategory, FeedbackType } from "@/lib/types";
import { CloudFeedbackDashboard } from "@/app/components/CloudFeedbackDashboard";

type FeedbackStep = "choice" | "reason" | "detail" | "submitted";
type FeedbackTab = "submit" | "cloud";

const PROMPT_VERSION = "v3-feedback-001";

const problemOptions: Array<{ key: FeedbackProblemCategory; label: string; description: string }> = [
  { key: "missing_clause", label: "漏了重要条款", description: "付款、质保、风险或其他关键条款未识别" },
  { key: "wrong_judgment", label: "判断不准确", description: "结论和合同原文理解存在偏差" },
  { key: "wrong_risk_level", label: "风险等级不对", description: "风险严重程度过高或过低" },
  { key: "unclear", label: "内容看不懂", description: "结果描述不清晰或难以复核" },
  { key: "other", label: "其他", description: "无法归入以上类型" }
];

export function FeedbackManagementPage({ modelName }: { modelName: string }) {
  const [contracts, setContracts] = useState<ContractAnalysisRecord[]>([]);
  const [feedbacks, setFeedbacks] = useState<AnalysisFeedbackRecord[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [step, setStep] = useState<FeedbackStep>("choice");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [problemCategory, setProblemCategory] = useState<FeedbackProblemCategory | undefined>();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<FeedbackTab>("submit");

  useEffect(() => {
    void refresh();
  }, []);

  const feedbackByContract = useMemo(() => {
    const map = new Map<string, AnalysisFeedbackRecord>();
    for (const feedback of feedbacks) {
      if (!map.has(feedback.contractId)) map.set(feedback.contractId, feedback);
    }
    return map;
  }, [feedbacks]);

  const selectedContract = useMemo(() => contracts.find((contract) => contract.id === selectedContractId) ?? null, [contracts, selectedContractId]);
  const selectedFeedback = selectedContract ? feedbackByContract.get(selectedContract.id) : undefined;

  async function refresh() {
    const [nextContracts, nextFeedbacks] = await Promise.all([listRecentSuccessfulContracts(80), listRecentFeedbacks(200)]);
    setContracts(nextContracts);
    setFeedbacks(nextFeedbacks);
    setSelectedContractId((current) => current || nextContracts[0]?.id || "");
  }

  function selectContract(contractId: string) {
    setSelectedContractId(contractId);
    setStep("choice");
    setFeedbackType(null);
    setProblemCategory(undefined);
    setComment("");
    setMessage(null);
  }

  async function submitFeedback(nextType: FeedbackType, nextCategory?: FeedbackProblemCategory, nextComment = "") {
    if (!selectedContract || !selectedContract.result) return;
    if (!selectedContract.contractText || selectedContract.contractText.trim().length < 20) {
      setMessage({ tone: "error", text: "这条历史分析缺少合同原文，无法提交反馈。请重新分析该合同后再反馈。" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    const now = new Date().toISOString();
    const payload = {
      contractId: selectedContract.id,
      batchId: selectedContract.batchId,
      fileName: selectedContract.fileName,
      feedbackType: nextType,
      problemCategory: nextType === "problem" ? nextCategory : undefined,
      comment: nextComment.trim() || undefined,
      analysisTime: selectedContract.updatedAt || selectedContract.createdAt,
      modelName: modelName || "未记录模型",
      promptVersion: PROMPT_VERSION,
      resultSummary: buildResultSummary(selectedContract),
      riskItemCount: selectedContract.result.issues.length,
      contractText: selectedContract.contractText
    };

    try {
      const response = await authedFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => ({}))) as { feedbackId?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "反馈提交失败，请稍后重试。");

      const record: AnalysisFeedbackRecord = {
        id: data.feedbackId || crypto.randomUUID(),
        ...payload,
        status: "submitted",
        createdAt: now,
        updatedAt: now
      };
      await saveFeedbackRecord(record);
      await refresh();
      setStep("submitted");
      setMessage({ tone: "success", text: "反馈已保存到云数据库，感谢你帮助改进分析效果。" });
    } catch (error) {
      const failedRecord: AnalysisFeedbackRecord = {
        id: crypto.randomUUID(),
        ...payload,
        status: "failed",
        createdAt: now,
        updatedAt: now,
        errorMessage: error instanceof Error ? error.message : "反馈提交失败"
      };
      await saveFeedbackRecord(failedRecord);
      await refresh();
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "反馈提交失败，请稍后重试。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFeedbackFlow() {
    if (!selectedContract) return null;
    if (step === "submitted") {
      return (
        <div className="feedback-flow success">
          <CheckCircle2 size={22} />
          <div>
            <strong>反馈已提交</strong>
            <p>你可以继续选择其他历史合同分析进行反馈。</p>
          </div>
          <button className="secondary" type="button" onClick={() => selectContract(selectedContract.id)}>继续反馈</button>
        </div>
      );
    }

    return (
      <div className="feedback-flow">
        <div className="feedback-step-caption">
          <span>反馈步骤</span>
          <strong>{step === "choice" ? "这次历史分析对你有帮助吗？" : step === "reason" ? "哪里有问题？" : "补充说明"}</strong>
        </div>

        {step === "choice" ? (
          <div className="feedback-actions">
            <button className="feedback-helpful" type="button" disabled={isSubmitting} onClick={() => void submitFeedback("helpful")}>有帮助</button>
            <button className="feedback-problem" type="button" disabled={isSubmitting} onClick={() => { setFeedbackType("problem"); setStep("reason"); }}>有问题</button>
          </div>
        ) : null}

        {step === "reason" ? (
          <>
            <div className="feedback-reasons">
              {problemOptions.map((option) => (
                <button key={option.key} type="button" className={problemCategory === option.key ? "feedback-reason active" : "feedback-reason"} onClick={() => setProblemCategory(option.key)}>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            <div className="feedback-footer-actions">
              <button className="secondary" type="button" onClick={() => setStep("choice")}>上一步</button>
              <button className="primary inline-primary" type="button" onClick={() => setStep("detail")}>下一步</button>
            </div>
          </>
        ) : null}

        {step === "detail" ? (
          <>
            <label className="feedback-comment">
              <span>愿意的话，补充一句哪里不对</span>
              <textarea value={comment} maxLength={500} placeholder="例如：补充协议第二页还有尾款约定。" onChange={(event) => setComment(event.target.value)} />
            </label>
            <div className="feedback-auto-context">
              <strong>系统会自动保存</strong>
              <span>分析时间、模型名称、prompt 版本、分析结果摘要、风险项数量、合同原文</span>
            </div>
            <div className="feedback-footer-actions">
              <button className="secondary" type="button" onClick={() => setStep("reason")}>上一步</button>
              <button className="primary inline-primary" type="button" disabled={isSubmitting} onClick={() => void submitFeedback(feedbackType || "problem", problemCategory, comment)}>
                <Send size={16} />
                {isSubmitting ? "提交中" : "提交反馈"}
              </button>
            </div>
          </>
        ) : null}

        {message ? <p className={"feedback-message " + message.tone}>{message.text}</p> : null}
      </div>
    );
  }

  return (
    <section className="feedback-page">
      <header className="topbar">
        <div>
          <p>反馈管理</p>
          <h1>{activeTab === "submit" ? "选择历史合同分析并反馈效果" : "查看我提交的云端反馈"}</h1>
        </div>
        {activeTab === "submit" ? (
          <button className="secondary feedback-refresh" type="button" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            刷新历史
          </button>
        ) : null}
      </header>

      <div className="feedback-tabs">
        <button
          type="button"
          className={activeTab === "submit" ? "feedback-tab active" : "feedback-tab"}
          onClick={() => setActiveTab("submit")}
        >
          <ClipboardList size={16} />
          提交反馈
        </button>
        <button
          type="button"
          className={activeTab === "cloud" ? "feedback-tab active" : "feedback-tab"}
          onClick={() => setActiveTab("cloud")}
        >
          <Cloud size={16} />
          云端总览
        </button>
      </div>

      {activeTab === "cloud" ? (
        <CloudFeedbackDashboard />
      ) : (
        <div className="feedback-grid">
          <section className="panel feedback-history-panel">
            <div className="panel-title compact">
              <h2><ClipboardList size={18} />历史合同分析</h2>
              <span className="muted">仅显示已成功分析的合同</span>
            </div>

            {contracts.length === 0 ? (
              <div className="feedback-empty"><MessageSquareText size={38} /><h2>暂无可反馈的历史分析</h2><p>完成一次合同分析后，这里会出现可反馈的合同记录。</p></div>
            ) : (
              <div className="feedback-contract-list">
                {contracts.map((contract) => {
                  const feedback = feedbackByContract.get(contract.id);
                  return (
                    <button key={contract.id} type="button" className={contract.id === selectedContractId ? "feedback-contract active" : "feedback-contract"} onClick={() => selectContract(contract.id)}>
                      <strong>{contract.exportName || contract.displayName}</strong>
                      <span>{new Date(contract.updatedAt || contract.createdAt).toLocaleString("zh-CN")}</span>
                      <small>风险项 {contract.result?.issues.length ?? 0} · {formatFeedbackStatus(feedback)}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel feedback-detail-panel">
            {selectedContract && selectedContract.result ? (
              <>
                <div className="panel-title compact">
                  <div>
                    <h2>{selectedContract.exportName || selectedContract.displayName}</h2>
                    <p className="muted">原始文件：{selectedContract.fileName}</p>
                  </div>
                  {selectedFeedback ? <span className={"feedback-status " + selectedFeedback.status}>{formatFeedbackStatus(selectedFeedback)}</span> : null}
                </div>

                <div className="feedback-summary">
                  <div><span>付款计划</span><strong>{selectedContract.result.payment_plan.length}</strong></div>
                  <div><span>质保字段</span><strong>{selectedContract.result.warranty.core_fields.length + selectedContract.result.warranty.extra_fields.length}</strong></div>
                  <div><span>风险项</span><strong>{selectedContract.result.issues.length}</strong></div>
                </div>

                <p className="feedback-summary-text">{buildResultSummary(selectedContract)}</p>

                {!selectedContract.contractText ? (
                  <div className="feedback-alert"><AlertCircle size={18} />这条历史记录缺少合同原文。v3 更新后新分析的合同会自动保存原文用于反馈。</div>
                ) : null}

                {renderFeedbackFlow()}
              </>
            ) : (
              <div className="feedback-empty"><MessageSquareText size={38} /><h2>请选择一条历史分析</h2><p>选中后可查看摘要，并对该次分析提交反馈。</p></div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function buildResultSummary(contract: ContractAnalysisRecord) {
  const result = contract.result;
  if (!result) return "暂无分析结果摘要。";
  const warrantyCount = result.warranty.core_fields.length + result.warranty.extra_fields.length;
  return "识别付款计划 " + result.payment_plan.length + " 条，质保字段 " + warrantyCount + " 条，风险项 " + result.issues.length + " 条；整体置信度 " + Math.round(result.confidence.overall * 100) + "%。";
}

function formatFeedbackStatus(feedback?: AnalysisFeedbackRecord) {
  if (!feedback) return "未反馈";
  if (feedback.status === "failed") return "提交失败";
  return feedback.feedbackType === "helpful" ? "有帮助" : "有问题";
}
