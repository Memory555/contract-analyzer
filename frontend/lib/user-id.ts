"use client";

const STORAGE_KEY = "contract-analyzer-user-id";

/**
 * 获取当前浏览器的唯一用户标识。
 * 首次调用时生成 UUID v4 并持久化到 localStorage，
 * 后续调用直接返回已存储的值。
 *
 * 不同浏览器 / 隐私模式各自独立，无需登录即可实现数据隔离。
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "anonymous";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * 获取带 userId 的 fetch 包装函数。
 * 自动在请求头中添加 x-user-id，GET 请求也可通过 query param 传递。
 */
export function authedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const userId = getUserId();
  const headers = new Headers(options.headers);
  headers.set("x-user-id", userId);
  return fetch(url, { ...options, headers });
}
