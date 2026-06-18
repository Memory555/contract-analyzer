import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  fileName: z.string().min(1),
  contractText: z.string().min(20).max(120000),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional()
});

const systemPrompt = `你是严谨的合同信息抽取助手。请从合同文本中提取付款计划、质保明细和合同问题。
要求：
1. 只根据合同文本输出，不要编造。
2. 问题严重程度只能是 error、warning、info。
3. 付款描述必须保留为数组，包含付款前置条件、付款节点、发票要求等描述。
4. 质保字段分为 core_fields 和 extra_fields。
5. 每条结果尽量给出 location 和 sourceText，便于人工复核。
6. confidence 取 0 到 1 的小数。`;

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

  const apiKey = parsed.data.openaiApiKey || process.env.OPENAI_API_KEY;
  const model = parsed.data.openaiModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const baseURL = parsed.data.openaiBaseUrl || process.env.OPENAI_BASE_URL || undefined;

  if (!apiKey) {
    return NextResponse.json(
      {
        code: "MODEL_SERVICE_NOT_CONFIGURED",
        message: "尚未配置模型服务，请先到“设置”中配置 OpenAI API Key、Base URL 和模型名称。"
      },
      { status: 428 }
    );
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL
    });

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `文件名：${parsed.data.fileName}\n\n合同文本：\n${parsed.data.contractText}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...jsonSchema
        }
      }
    });

    const outputText = response.output_text;
    const result = JSON.parse(outputText);
    return NextResponse.json(result);
  } catch (error) {
    console.error("analyze failed", error);
    return NextResponse.json(
      { message: "解析服务暂不可用，请稍后重试。" },
      { status: 502 }
    );
  }
}
