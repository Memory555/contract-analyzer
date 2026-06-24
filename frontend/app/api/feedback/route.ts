import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPostgresConfig, ensureTable, getPool } from "@/lib/postgres";
import type { CloudFeedbackListItem, CloudFeedbackStats, FeedbackProblemCategory } from "@/lib/types";

export const runtime = "nodejs";

const problemCategories = ["missing_clause", "wrong_judgment", "wrong_risk_level", "unclear", "other"] as const;
const allCategoryKeys: FeedbackProblemCategory[] = [
  "missing_clause",
  "wrong_judgment",
  "wrong_risk_level",
  "unclear",
  "other"
];

const requestSchema = z.object({
  contractId: z.string().min(1),
  batchId: z.string().min(1),
  fileName: z.string().min(1),
  feedbackType: z.enum(["helpful", "problem"]),
  problemCategory: z.enum(problemCategories).optional(),
  comment: z.string().max(500).optional(),
  analysisTime: z.string().min(1),
  modelName: z.string().min(1),
  promptVersion: z.string().min(1),
  resultSummary: z.string().min(1).max(2000),
  riskItemCount: z.number().int().min(0),
  contractText: z.string().min(20).max(200000)
});

/** 从请求头或查询参数中提取用户 ID */
function extractUserId(request: Request): string {
  const headerId = request.headers.get("x-user-id");
  if (headerId && headerId.trim()) return headerId.trim();

  const url = new URL(request.url);
  const queryId = url.searchParams.get("userId");
  if (queryId && queryId.trim()) return queryId.trim();

  return "anonymous";
}

/* ============================ GET — 云端反馈列表（仅当前用户） ============================ */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const feedbackType = url.searchParams.get("feedbackType");
  const problemCategory = url.searchParams.get("problemCategory");
  const userId = extractUserId(request);

  const missing = checkPostgresConfig();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        code: "POSTGRES_NOT_CONFIGURED",
        message: `PostgreSQL 未配置，缺少环境变量：${missing.join(", ")}。`,
        missing
      },
      { status: 503 }
    );
  }

  try {
    await ensureTable();
    const pool = getPool();

    // 构建 WHERE 条件（始终包含 user_id 过滤）
    const conditions: string[] = [`user_id = $1`];
    const params: unknown[] = [userId];
    let paramIdx = 2;

    if (feedbackType === "helpful" || feedbackType === "problem") {
      conditions.push(`feedback_type = $${paramIdx++}`);
      params.push(feedbackType);
    }
    if (problemCategory && allCategoryKeys.includes(problemCategory as FeedbackProblemCategory)) {
      conditions.push(`problem_category = $${paramIdx++}`);
      params.push(problemCategory);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 并行查询：分页列表（不含 contractText） + 筛选总数 + 当前用户统计
    const listQuery = `
      SELECT
        id,
        contract_id AS "contractId",
        batch_id AS "batchId",
        file_name AS "fileName",
        feedback_type AS "feedbackType",
        problem_category AS "problemCategory",
        comment,
        analysis_time AS "analysisTime",
        model_name AS "modelName",
        prompt_version AS "promptVersion",
        result_summary AS "resultSummary",
        risk_item_count AS "riskItemCount",
        source,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM analysis_feedback
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    const listParams = [...params, limit, (page - 1) * limit];

    const countQuery = `SELECT COUNT(*)::int AS total FROM analysis_feedback ${whereClause}`;

    // 统计也按 user_id 过滤
    const statsQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE feedback_type = 'helpful')::int AS helpful,
        COUNT(*) FILTER (WHERE feedback_type = 'problem')::int AS problem,
        COUNT(*) FILTER (WHERE problem_category = 'missing_clause')::int AS cat_missing_clause,
        COUNT(*) FILTER (WHERE problem_category = 'wrong_judgment')::int AS cat_wrong_judgment,
        COUNT(*) FILTER (WHERE problem_category = 'wrong_risk_level')::int AS cat_wrong_risk_level,
        COUNT(*) FILTER (WHERE problem_category = 'unclear')::int AS cat_unclear,
        COUNT(*) FILTER (WHERE problem_category = 'other')::int AS cat_other
      FROM analysis_feedback
      WHERE user_id = $1
    `;

    const [listResult, countResult, statsResult] = await Promise.all([
      pool.query(listQuery, listParams),
      pool.query(countQuery, params),
      pool.query(statsQuery, [userId])
    ]);

    const items = listResult.rows as CloudFeedbackListItem[];
    const total = countResult.rows[0]?.total || 0;

    const s = statsResult.rows[0] || {};
    const byCategory: Record<FeedbackProblemCategory, number> = {
      missing_clause: s.cat_missing_clause || 0,
      wrong_judgment: s.cat_wrong_judgment || 0,
      wrong_risk_level: s.cat_wrong_risk_level || 0,
      unclear: s.cat_unclear || 0,
      other: s.cat_other || 0,
    };

    const stats: CloudFeedbackStats = {
      total: s.total || 0,
      helpful: s.helpful || 0,
      problem: s.problem || 0,
      byCategory
    };

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats
    });
  } catch (error) {
    console.error("fetch feedback from PostgreSQL failed", error);
    return NextResponse.json(
      {
        code: "FEEDBACK_FETCH_FAILED",
        message: error instanceof Error ? error.message : "读取反馈失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}

/* ============================ POST — 提交反馈 ============================ */

export async function POST(request: Request) {
  const userId = extractUserId(request);
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "反馈参数不完整，请选择有效的历史分析记录后重试。" },
      { status: 400 }
    );
  }

  if (parsed.data.feedbackType === "helpful" && parsed.data.problemCategory) {
    return NextResponse.json(
      { message: "有帮助反馈不需要问题类型。" },
      { status: 400 }
    );
  }

  const missing = checkPostgresConfig();
  if (missing.length > 0) {
    return NextResponse.json(
      {
        code: "POSTGRES_NOT_CONFIGURED",
        message: `PostgreSQL 未配置，缺少环境变量：${missing.join(", ")}。`
      },
      { status: 503 }
    );
  }

  const feedbackId = crypto.randomUUID();
  const now = new Date().toISOString();
  const d = parsed.data;

  try {
    await ensureTable();
    const pool = getPool();

    await pool.query(
      `INSERT INTO analysis_feedback
        (id, user_id, contract_id, batch_id, file_name, feedback_type, problem_category,
         comment, analysis_time, model_name, prompt_version, result_summary,
         risk_item_count, contract_text, source, created_at, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        feedbackId,
        userId,
        d.contractId,
        d.batchId,
        d.fileName,
        d.feedbackType,
        d.problemCategory || null,
        d.comment || null,
        d.analysisTime,
        d.modelName,
        d.promptVersion,
        d.resultSummary,
        d.riskItemCount,
        d.contractText,
        "contract-analyzer-v3",
        now,
        now,
      ]
    );

    return NextResponse.json({
      feedbackId,
      stored: true,
      message: "反馈已保存到 PostgreSQL 数据库。"
    });
  } catch (error) {
    console.error("persist feedback to PostgreSQL failed", error);
    return NextResponse.json(
      {
        code: "FEEDBACK_SAVE_FAILED",
        message: error instanceof Error ? error.message : "反馈写入数据库失败，请稍后重试。"
      },
      { status: 502 }
    );
  }
}
