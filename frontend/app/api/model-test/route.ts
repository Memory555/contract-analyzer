import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional()
});

function normalizeBaseUrl(url?: string) {
  return url?.trim().replace(/\/+$/, "").toLowerCase();
}

function isOfficialOpenAIBaseUrl(url?: string) {
  const normalized = normalizeBaseUrl(url);
  return !normalized || normalized === "https://api.openai.com/v1";
}

function resolveModelConfig(data: z.infer<typeof requestSchema>) {
  const pageApiKey = data.openaiApiKey?.trim();
  const pageBaseURL = data.openaiBaseUrl?.trim();
  const pageModel = data.openaiModel?.trim();
  const hasCustomPageBaseURL = Boolean(pageBaseURL) && !isOfficialOpenAIBaseUrl(pageBaseURL);

  if (hasCustomPageBaseURL && !pageApiKey) {
    return {
      ok: false as const,
      status: 428,
      code: "CUSTOM_MODEL_SERVICE_KEY_REQUIRED",
      message: "使用自定义 Base URL 时，请同时填写该服务对应的 API Key。"
    };
  }

  const apiKey = pageApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      status: 428,
      code: "MODEL_SERVICE_NOT_CONFIGURED",
      message: "尚未配置模型服务，请填写 API Key，或在部署平台环境变量中配置 OPENAI_API_KEY。"
    };
  }

  return {
    ok: true as const,
    apiKey,
    baseURL: pageApiKey || isOfficialOpenAIBaseUrl(pageBaseURL)
      ? pageBaseURL || process.env.OPENAI_BASE_URL || undefined
      : process.env.OPENAI_BASE_URL || undefined,
    model: pageApiKey || isOfficialOpenAIBaseUrl(pageBaseURL)
      ? pageModel || process.env.OPENAI_MODEL || "gpt-4.1-mini"
      : process.env.OPENAI_MODEL || "gpt-4.1-mini"
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "模型服务配置格式不正确。" }, { status: 400 });
  }

  const config = resolveModelConfig(parsed.data);
  if (!config.ok) {
    return NextResponse.json(
      { code: config.code, message: config.message },
      { status: config.status }
    );
  }

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });

    const response = await client.responses.create({
      model: config.model,
      input: "请只回复 OK，用于测试模型服务连通性。",
      temperature: 0.2,
      top_p: 1,
      max_output_tokens: 128
    });
    const sample = response.output_text;

    return NextResponse.json({
      ok: true,
      model: config.model,
      baseURL: config.baseURL || "SDK 默认地址",
      sample: sample || "OK"
    });
  } catch (error) {
    console.error("model test failed", error);
    const detail = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      {
        code: "MODEL_SERVICE_TEST_FAILED",
        message: `模型服务联通测试失败：${detail}`
      },
      { status: 502 }
    );
  }
}
