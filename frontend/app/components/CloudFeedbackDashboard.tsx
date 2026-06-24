"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { authedFetch } from "@/lib/user-id";
import type {
  CloudFeedbackDocument,
  CloudFeedbackListItem,
  CloudFeedbackListResponse,
  CloudFeedbackStats,
  FeedbackProblemCategory,
  FeedbackType
} from "@/lib/types";

const problemLabels: Record<FeedbackProblemCategory, string> = {
  missing_clause: "漏了重要条款",
  wrong_judgment: "判断不准确",
  wrong_risk_level: "风险等级不对",
  unclear: "内容看不懂",
  other: "其他"
};

const categoryColors: Record<FeedbackProblemCategory, string> = {
  missing_clause: "#d83b2d",
  wrong_judgment: "#d9831f",
  wrong_risk_level: "#3571a3",
  unclear: "#7c3aed",
  other: "#64748b"
};

type FilterType = "all" | FeedbackType;

export function CloudFeedbackDashboard() {
  const [data, setData] = useState<CloudFeedbackListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CloudFeedbackDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filterType !== "all") params.set("feedbackType", filterType);
      if (filterCategory !== "all") params.set("problemCategory", filterCategory);

      const res = await authedFetch(`/api/feedback?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "读取云端反馈失败。");
      }
      setData(json as CloudFeedbackListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取云端反馈失败。");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterCategory]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // 展开/收起详情
  useEffect(() => {
    if (!expandedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    authedFetch(`/api/feedback/${expandedId}`)
      .then((r) => r.json())
      .then((json: CloudFeedbackDocument) => {
        if (!cancelled) setDetail(json);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId]);

  function handleFilterType(next: FilterType) {
    setFilterType(next);
    setFilterCategory("all");
    setPage(1);
  }

  function handleFilterCategory(next: string) {
    setFilterCategory(next);
    setPage(1);
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  const stats: CloudFeedbackStats | null = data?.stats ?? null;
  const helpfulRate = stats && stats.total > 0 ? Math.round((stats.helpful / stats.total) * 100) : 0;

  return (
    <div className="cloud-feedback-dashboard">
      {/* 统计卡片 */}
      {stats ? (
        <div className="cloud-stats-grid">
          <div className="cloud-stat-card total">
            <Cloud size={20} />
            <div>
              <span>我的云端反馈</span>
              <strong>{stats.total}</strong>
            </div>
          </div>
          <div className="cloud-stat-card helpful">
            <ThumbsUp size={20} />
            <div>
              <span>有帮助</span>
              <strong>{stats.helpful}</strong>
              <small>{helpfulRate}% 占比</small>
            </div>
          </div>
          <div className="cloud-stat-card problem">
            <ThumbsDown size={20} />
            <div>
              <span>有问题</span>
              <strong>{stats.problem}</strong>
              <small>{100 - helpfulRate}% 占比</small>
            </div>
          </div>
        </div>
      ) : null}

      {/* 问题分类分布 */}
      {stats && stats.problem > 0 ? (
        <div className="cloud-category-bars">
          <h3>问题分类分布</h3>
          <div className="cloud-category-list">
            {(Object.keys(problemLabels) as FeedbackProblemCategory[]).map((cat) => {
              const count = stats.byCategory[cat] || 0;
              const pct = stats.problem > 0 ? Math.round((count / stats.problem) * 100) : 0;
              return (
                <div key={cat} className="cloud-category-bar">
                  <span className="cloud-category-label">{problemLabels[cat]}</span>
                  <div className="cloud-category-track">
                    <div
                      className="cloud-category-fill"
                      style={{ width: `${pct}%`, backgroundColor: categoryColors[cat] }}
                    />
                  </div>
                  <span className="cloud-category-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 筛选栏 */}
      <div className="cloud-filter-bar">
        <div className="cloud-filter-group">
          <button
            type="button"
            className={filterType === "all" ? "cloud-filter-chip active" : "cloud-filter-chip"}
            onClick={() => handleFilterType("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={filterType === "helpful" ? "cloud-filter-chip active helpful" : "cloud-filter-chip"}
            onClick={() => handleFilterType("helpful")}
          >
            有帮助
          </button>
          <button
            type="button"
            className={filterType === "problem" ? "cloud-filter-chip active problem" : "cloud-filter-chip"}
            onClick={() => handleFilterType("problem")}
          >
            有问题
          </button>
        </div>

        {filterType === "problem" || filterCategory !== "all" ? (
          <select
            className="cloud-filter-select"
            value={filterCategory}
            onChange={(e) => handleFilterCategory(e.target.value)}
          >
            <option value="all">全部问题类型</option>
            {(Object.keys(problemLabels) as FeedbackProblemCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {problemLabels[cat]}
              </option>
            ))}
          </select>
        ) : null}

        <button type="button" className="secondary cloud-refresh-btn"
          onClick={() => void fetchData()}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error ? (
        <div className="cloud-feedback-error">
          <AlertCircle size={20} />
          <div>
            <strong>无法读取云端反馈</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="secondary" onClick={() => void fetchData()}>
            重试
          </button>
        </div>
      ) : null}

      {/* 反馈列表 */}
      {!error && data ? (
        data.items.length === 0 ? (
          <div className="cloud-feedback-empty">
            <HelpCircle size={38} />
            <h2>暂无云端反馈</h2>
            <p>你提交的反馈会显示在这里。前往「提交反馈」选择历史分析即可开始。</p>
          </div>
        ) : (
          <div className="cloud-feedback-list">
            {data.items.map((item) => (
              <CloudFeedbackRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => toggleExpand(item.id)}
                detail={expandedId === item.id ? detail : null}
                detailLoading={expandedId === item.id && detailLoading}
              />
            ))}
          </div>
        )
      ) : null}

      {/* 分页 */}
      {!error && data && data.totalPages > 1 ? (
        <div className="cloud-pagination">
          <button
            type="button"
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span className="cloud-page-info">
            第 {page} / {data.totalPages} 页（共 {data.total} 条）
          </span>
          <button
            type="button"
            className="secondary"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---- 单行反馈卡片 ---- */

function CloudFeedbackRow({
  item,
  isExpanded,
  onToggle,
  detail,
  detailLoading
}: {
  item: CloudFeedbackListItem;
  isExpanded: boolean;
  onToggle: () => void;
  detail: CloudFeedbackDocument | null;
  detailLoading: boolean;
}) {
  return (
    <div className={isExpanded ? "cloud-feedback-row expanded" : "cloud-feedback-row"}>
      <button type="button" className="cloud-feedback-row-header" onClick={onToggle}>
        <span className="cloud-feedback-expand-icon">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className={`cloud-feedback-type-badge ${item.feedbackType}`}>
          {item.feedbackType === "helpful" ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
          {item.feedbackType === "helpful" ? "有帮助" : "有问题"}
        </span>
        <span className="cloud-feedback-filename">{item.fileName}</span>
        {item.problemCategory ? (
          <span className="cloud-feedback-category-tag">{problemLabels[item.problemCategory]}</span>
        ) : null}
        <span className="cloud-feedback-meta">
          {item.modelName} · {new Date(item.createdAt).toLocaleString("zh-CN")}
        </span>
      </button>

      {isExpanded ? (
        <div className="cloud-feedback-detail">
          {detailLoading ? (
            <div className="cloud-feedback-detail-loading">
              <Loader2 size={18} className="spin" /> 加载详情中…
            </div>
          ) : detail ? (
            <>
              <div className="cloud-feedback-detail-grid">
                <div>
                  <span>分析时间</span>
                  <strong>{new Date(detail.analysisTime).toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span>模型</span>
                  <strong>{detail.modelName}</strong>
                </div>
                <div>
                  <span>Prompt 版本</span>
                  <strong>{detail.promptVersion}</strong>
                </div>
                <div>
                  <span>风险项数量</span>
                  <strong>{detail.riskItemCount}</strong>
                </div>
              </div>

              {detail.comment ? (
                <div className="cloud-feedback-comment">
                  <strong>用户补充说明</strong>
                  <p>{detail.comment}</p>
                </div>
              ) : null}

              <div className="cloud-feedback-summary-box">
                <strong>分析结果摘要</strong>
                <p>{detail.resultSummary}</p>
              </div>

              {detail.contractText ? (
                <details className="cloud-feedback-contract">
                  <summary>
                    <FileText size={16} /> 查看合同原文（{detail.contractText.length} 字）
                  </summary>
                  <pre>{detail.contractText}</pre>
                </details>
              ) : null}
            </>
          ) : (
            <div className="cloud-feedback-detail-loading">加载详情失败。</div>
          )}
        </div>
      ) : null}

      {/* 折叠状态下显示评论预览 */}
      {!isExpanded && item.comment ? (
        <p className="cloud-feedback-comment-preview">{item.comment}</p>
      ) : null}
    </div>
  );
}
