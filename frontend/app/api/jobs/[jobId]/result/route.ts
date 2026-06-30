import { buildBackendUrl, proxyErrorResponse, toProxyResponse } from "@/app/api/backend-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const response = await fetch(buildBackendUrl(`/api/jobs/${encodeURIComponent(jobId)}/result`), {
      method: "GET",
      cache: "no-store"
    });
    return toProxyResponse(response);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
