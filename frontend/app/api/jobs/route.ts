import { buildBackendUrl, proxyErrorResponse, toProxyResponse } from "@/app/api/backend-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const response = await fetch(buildBackendUrl("/api/jobs"), {
      method: "POST",
      body: await request.formData()
    });
    return toProxyResponse(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
