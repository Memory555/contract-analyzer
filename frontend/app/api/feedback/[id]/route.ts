import { NextResponse } from "next/server";
import { checkPostgresConfig, ensureTable, getPool } from "@/lib/postgres";

export const runtime = "nodejs";

/** 从请求头或查询参数中提取用户 ID */
function extractUserId(request: Request): string {
  const headerId = request.headers.get("x-user-id");
  if (headerId && headerId.trim()) return headerId.trim();

  const url = new URL(request.url);
  const queryId = url.searchParams.get("userId");
  if (queryId && queryId.trim()) return queryId.trim();

  return "anonymous";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: feedbackId } = await params;

  if (!feedbackId) {
    return NextResponse.json(
      { message: "缺少反馈 ID。" },
      { status: 400 }
    );
  }

  const userId = extractUserId(request);

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

  try {
    await ensureTable();
    const pool = getPool();

    // 按 id + userId 双重过滤，确保用户只能查看自己的反馈详情
    const result = await pool.query(
      `SELECT
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
        contract_text AS "contractText",
        source,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM analysis_feedback
       WHERE id = $1 AND user_id = $2`,
      [feedbackId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: "未找到该反馈记录，或无权查看。" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("fetch feedback detail failed", error);
    return NextResponse.json(
      {
        code: "FEEDBACK_DETAIL_FAILED",
        message: error instanceof Error ? error.message : "读取反馈详情失败。"
      },
      { status: 502 }
    );
  }
}
