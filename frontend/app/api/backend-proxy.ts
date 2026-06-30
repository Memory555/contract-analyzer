function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ||
    process.env.BACKEND_API_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
}

export function buildBackendUrl(path: string) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    throw new Error("前端服务未配置 NEXT_PUBLIC_BACKEND_API_BASE_URL 或 BACKEND_API_BASE_URL。");
  }
  return `${baseUrl}${path}`;
}

export async function toProxyResponse(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function proxyErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "前端代理后端服务失败。";
  return Response.json(
    {
      code: "BACKEND_PROXY_FAILED",
      message
    },
    { status: 502 }
  );
}
