import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { normalizeAnalysisResult } from "@/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  fileName: z.string().min(1),
  contractText: z.string().min(20).max(300000),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional()
});

const systemPrompt = `你是严谨的合同信息抽取助手。请完整阅读用户提供的全部合同文本，而不是只分析开头、第一页或摘要。请从全合同范围提取付款计划、质保明细和合同问题。
要求：
1. 只根据合同文本输出，不要编造。
2. 问题严重程度只能是 error、warning、info。
3. 付款描述必须保留为数组，包含付款前置条件、付款节点、发票要求等描述。
4. 质保字段分为 core_fields 和 extra_fields。
5. 每条结果尽量给出 location 和 sourceText，便于人工复核。
6. confidence 取 0 到 1 的小数。
7. 必须优先扫描并抽取包含以下关键词的段落：付款、支付、进度款、验收款、质保金、发票、结算、质量保证、质保、售后、维护、响应、违约金、升级、补丁、交付、验收。
8. 如果同一事项在不同条款中出现不一致，例如质保期、付款比例、支付时限，应在 issues 中提示。
9. payment_plan 需要覆盖合同中所有付款阶段，不要只返回第一阶段。
10. warranty.core_fields 需要尽量覆盖质保期、服务范围、响应时效、现场支持、违约金、更新升级、维护文档、质保期满安排。
11. 输出要紧凑，sourceText 只保留对应条款的关键原文片段，单条不超过 120 个中文字符。
12. 不要重复抄写整段合同，不要输出合同全文。
13. 字符串字段如果合同未提及，写“未提及”，不要输出空字符串。`;

function normalizeBaseUrl(url?: string) {
  return url?.trim().replace(/\/+$/, "").toLowerCase();
}

function isOfficialOpenAIBaseUrl(url?: string) {
  const normalized = normalizeBaseUrl(url);
  return !normalized || normalized === "https://api.openai.com/v1";
}

function parseModelJson(outputText: string) {
  const text = outputText.trim();
  if (!text) {
    throw new Error("模型没有返回可解析内容，请检查模型是否支持 Responses API 的结构化输出，或稍后重试。");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知 JSON 解析错误";
    if (message.includes("Unexpected end")) {
      throw new Error("模型返回的 JSON 不完整，通常是输出被截断。请重试，或减少合同文本长度后再解析。");
    }
    throw new Error(`模型返回内容不是合法 JSON：${message}`);
  }
}

const jsonSchema = {
  name: "contract_analysis_result",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["issues", "payment_plan", "warranty", "confidence"],
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "severity", "description", "location", "sourceText"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            severity: { type: "string", enum: ["error", "warning", "info"] },
            description: { type: "string" },
            location: { type: "string" },
            sourceText: { type: "string" }
          }
        }
      },
      payment_plan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "stage", "name", "percentage", "conditions", "deadline", "note", "location", "sourceText"],
          properties: {
            id: { type: "string" },
            stage: { type: "string" },
            name: { type: "string" },
            percentage: { type: "string" },
            conditions: { type: "array", items: { type: "string" } },
            deadline: { type: "string" },
            note: { type: "string" },
            location: { type: "string" },
            sourceText: { type: "string" }
          }
        }
      },
      warranty: {
        type: "object",
        additionalProperties: false,
        required: ["core_fields", "extra_fields"],
        properties: {
          core_fields: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "field", "content", "note", "location", "sourceText"],
              properties: {
                id: { type: "string" },
                field: { type: "string" },
                content: { type: "string" },
                note: { type: "string" },
                location: { type: "string" },
                sourceText: { type: "string" }
              }
            }
          },
          extra_fields: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "field", "content", "note", "location", "sourceText"],
              properties: {
                id: { type: "string" },
                field: { type: "string" },
                content: { type: "string" },
                note: { type: "string" },
                location: { type: "string" },
                sourceText: { type: "string" }
              }
            }
          }
        }
      },
      confidence: {
        type: "object",
        additionalProperties: false,
        required: ["overall", "payment_plan", "warranty", "issues"],
        properties: {
          overall: { type: "number" },
          payment_plan: { type: "number" },
          warranty: { type: "number" },
          issues: { type: "number" }
        }
      }
    }
  },
  strict: true
} as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "请求参数不完整，请上传有效 DOCX 并提取文本后重试。" },
      { status: 400 }
    );
  }

  const pageApiKey = parsed.data.openaiApiKey?.trim();
  const pageBaseURL = parsed.data.openaiBaseUrl?.trim();
  const pageModel = parsed.data.openaiModel?.trim();
  const hasPageBaseURL = Boolean(pageBaseURL);
  const hasCustomPageBaseURL = hasPageBaseURL && !isOfficialOpenAIBaseUrl(pageBaseURL);

  if (hasCustomPageBaseURL && !pageApiKey) {
    return NextResponse.json(
      {
        code: "CUSTOM_MODEL_SERVICE_KEY_REQUIRED",
        message: "使用自定义 Base URL 时，请在“设置”中同时填写该服务对应的 API Key。"
      },
      { status: 428 }
    );
  }

  const apiKey = pageApiKey || process.env.OPENAI_API_KEY;
  const model = pageApiKey || isOfficialOpenAIBaseUrl(pageBaseURL)
    ? pageModel || process.env.OPENAI_MODEL || "gpt-4.1-mini"
    : process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const baseURL = pageApiKey || isOfficialOpenAIBaseUrl(pageBaseURL)
    ? pageBaseURL || process.env.OPENAI_BASE_URL || undefined
    : process.env.OPENAI_BASE_URL || undefined;

  if (!apiKey) {
    return NextResponse.json(
      {
        code: "MODEL_SERVICE_NOT_CONFIGURED",
        message: "尚未配置模型服务，请先到“设置”中配置 OpenAI API Key，或在 Vercel 环境变量中配置 OPENAI_API_KEY。"
      },
      { status: 428 }
    );
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL
    });

    const userContent = `文件名：${parsed.data.fileName}\n合同文本总字符数：${parsed.data.contractText.length}\n请从下方完整合同文本中进行全局分析，不要只分析开头部分。\n\n合同文本：\n${parsed.data.contractText}`;
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userContent
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...jsonSchema
        }
      },
      temperature: 0.2,
      top_p: 1,
      max_output_tokens: 8192
    });

    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason || "未知原因";
      throw new Error(`模型输出未完成：${reason}。请重试，或减少合同文本长度后再解析。`);
    }

    const result = parseModelJson(response.output_text);
    return NextResponse.json(normalizeAnalysisResult(result));
  } catch (error) {
    console.error("analyze failed", error);
    const detail = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { message: `解析服务暂不可用：${detail}` },
      { status: 502 }
    );
  }
}
