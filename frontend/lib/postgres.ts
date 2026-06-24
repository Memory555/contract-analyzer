import { Pool, type PoolClient, type PoolConfig } from "pg";

export type FeedbackRow = {
  id: string;
  contract_id: string;
  batch_id: string;
  file_name: string;
  feedback_type: "helpful" | "problem";
  problem_category: string | null;
  comment: string | null;
  analysis_time: string;
  model_name: string;
  prompt_version: string;
  result_summary: string;
  risk_item_count: number;
  contract_text: string;
  source: string;
  created_at: string;
  updated_at: string;
};

let pool: Pool | null = null;

function shouldUseSsl(databaseUrl?: string): PoolConfig["ssl"] {
  const sslFlag = process.env.PG_SSL?.toLowerCase();
  if (sslFlag === "false" || sslFlag === "0" || sslFlag === "disable") {
    return false;
  }

  if (sslFlag === "true" || sslFlag === "1" || sslFlag === "require") {
    return process.env.PG_SSL_REJECT_UNAUTHORIZED === "false" ? { rejectUnauthorized: false } : true;
  }

  if (!databaseUrl) return false;

  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

    if (sslMode === "disable") return false;
    if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
      return process.env.PG_SSL_REJECT_UNAUTHORIZED === "false" ? { rejectUnauthorized: false } : true;
    }

    if (url.hostname.endsWith(".neon.tech")) {
      return process.env.PG_SSL_REJECT_UNAUTHORIZED === "false" ? { rejectUnauthorized: false } : true;
    }
  } catch {
    return false;
  }

  return false;
}

export function getPool(): Pool {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  const host = process.env.PG_HOST;
  const port = parseInt(process.env.PG_PORT || "5432", 10);
  const user = process.env.PG_USER;
  const password = process.env.PG_PASSWORD;
  const database = process.env.PG_DATABASE || "postgres";

  if (!databaseUrl && (!host || !user || !password)) {
    throw new Error(
      `PostgreSQL 未配置，缺少环境变量：${[
        !host && "PG_HOST",
        !user && "PG_USER",
        !password && "PG_PASSWORD",
      ].filter(Boolean).join(", ")}`
    );
  }

  const baseConfig: PoolConfig = {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: shouldUseSsl(databaseUrl),
  };

  pool = new Pool(databaseUrl
    ? {
        ...baseConfig,
        connectionString: databaseUrl,
      }
    : {
        ...baseConfig,
        host,
        port,
        user,
        password,
        database,
        // Keep client encoding explicit for non-DATABASE_URL deployments.
        options: "-c client_encoding=UTF8",
      });

  return pool;
}

export function checkPostgresConfig(): string[] {
  const missing: string[] = [];
  if (process.env.DATABASE_URL) return missing;

  if (!process.env.PG_HOST) missing.push("PG_HOST");
  if (!process.env.PG_USER) missing.push("PG_USER");
  if (!process.env.PG_PASSWORD) missing.push("PG_PASSWORD");
  return missing;
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS analysis_feedback (
  id              VARCHAR(64)   PRIMARY KEY,
  user_id         VARCHAR(64)   NOT NULL DEFAULT 'anonymous',
  contract_id     VARCHAR(64)   NOT NULL,
  batch_id        VARCHAR(64)   NOT NULL,
  file_name       TEXT          NOT NULL,
  feedback_type   VARCHAR(16)   NOT NULL DEFAULT 'helpful',
  problem_category VARCHAR(32),
  comment         TEXT,
  analysis_time   TIMESTAMPTZ   NOT NULL,
  model_name      VARCHAR(64)   NOT NULL,
  prompt_version  VARCHAR(32)   NOT NULL,
  result_summary  TEXT          NOT NULL,
  risk_item_count INTEGER       NOT NULL DEFAULT 0,
  contract_text   TEXT          NOT NULL,
  source          VARCHAR(64)   NOT NULL DEFAULT 'contract-analyzer-v3',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at   ON analysis_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type          ON analysis_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_contract_id   ON analysis_feedback (contract_id);
CREATE INDEX IF NOT EXISTS idx_feedback_problem_cat   ON analysis_feedback (problem_category) WHERE problem_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_user_id       ON analysis_feedback (user_id);
`;

/**
 * 确保表存在且包含 user_id 列（兼容旧表结构）。
 */
export async function ensureTable(): Promise<void> {
  const p = getPool();
  await p.query(CREATE_TABLE_SQL);

  // 兼容旧表：如果 user_id 列不存在则添加
  try {
    await p.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'analysis_feedback' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE analysis_feedback ADD COLUMN user_id VARCHAR(64) NOT NULL DEFAULT 'anonymous';
          CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON analysis_feedback (user_id);
        END IF;
      END $$
    `);
  } catch {
    // 某些 PG 版本不支持 DO 块，忽略错误——列已存在的情况
  }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
