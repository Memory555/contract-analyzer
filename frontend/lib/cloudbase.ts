import tcb from "@cloudbase/node-sdk";

const DEFAULT_COLLECTION = "analysis_feedback";

export const FEEDBACK_COLLECTION = process.env.CLOUDBASE_FEEDBACK_COLLECTION || DEFAULT_COLLECTION;

export type CloudBaseConfigError = {
  code: "CLOUDBASE_NOT_CONFIGURED";
  message: string;
  missing: string[];
};

/**
 * 检查 CloudBase 环境变量是否配置完整。
 * 返回缺失的变量名数组，空数组表示配置完整。
 */
export function checkCloudBaseConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.CLOUDBASE_ENV_ID && !process.env.TCB_ENV_ID) {
    missing.push("CLOUDBASE_ENV_ID");
  }
  if (!process.env.TENCENTCLOUD_SECRETID && !process.env.TENCENT_SECRET_ID) {
    missing.push("TENCENTCLOUD_SECRETID");
  }
  if (!process.env.TENCENTCLOUD_SECRETKEY && !process.env.TENCENT_SECRET_KEY) {
    missing.push("TENCENTCLOUD_SECRETKEY");
  }
  return missing;
}

let cachedApp: ReturnType<typeof tcb.init> | null = null;

/**
 * 获取 CloudBase App 实例（单例缓存）。
 * 如果环境变量未配置，抛出包含缺失变量信息的错误。
 */
export function getCloudBaseApp() {
  const missing = checkCloudBaseConfig();
  if (missing.length > 0) {
    throw new Error(
      `CloudBase 未配置，缺少环境变量：${missing.join(", ")}。请在 .env.local 中补充后重启服务。`
    );
  }

  if (!cachedApp) {
    cachedApp = tcb.init({
      env: process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV_ID!,
      secretId: process.env.TENCENTCLOUD_SECRETID || process.env.TENCENT_SECRET_ID!,
      secretKey: process.env.TENCENTCLOUD_SECRETKEY || process.env.TENCENT_SECRET_KEY!
    });
  }
  return cachedApp;
}

/**
 * 获取反馈集合的数据库引用。
 */
export function getFeedbackCollection() {
  return getCloudBaseApp().database().collection(FEEDBACK_COLLECTION);
}
