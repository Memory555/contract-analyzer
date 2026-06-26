#!/usr/bin/env node
/**
 * 合同智能分析 CLI
 * 用于快速分析 1-2 份 DOCX 合同文件，提取付款计划、质保明细和合同问题
 * 适用场景：偶尔分析合同、快速看看付款和质保条款
 */

const fs = require("fs");
const path = require("path");

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    apiKey: process.env.OPENAI_API_KEY || null,
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.MODEL || "gpt-4.1-mini",
    output: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-f":
      case "--file":
        options.file = args[++i];
        break;
      case "-k":
      case "--api-key":
        options.apiKey = args[++i];
        break;
      case "-b":
      case "--base-url":
        options.baseUrl = args[++i];
        break;
      case "-m":
      case "--model":
        options.model = args[++i];
        break;
      case "-o":
      case "--output":
        options.output = args[++i];
        break;
      case "-j":
      case "--json":
        options.json = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        if (!options.file && !arg.startsWith("-")) {
          options.file = arg;
        }
    }
  }
  return options;
}

function showHelp() {
  console.log(`
合同智能分析 CLI - 快速提取付款计划、质保明细和合同问题

用法：
  node analyze.js --file <合同.docx> [options]

参数：
  -f, --file <path>      DOCX 合同文件路径（必填）
  -k, --api-key <key>    OpenAI API Key（优先于环境变量 OPENAI_API_KEY）
  -b, --base-url <url>   API Base URL（默认：https://api.openai.com/v1）
  -m, --model <model>    模型名称（默认：gpt-4.1-mini）
  -o, --output <path>    输出文件路径（默认输出到控制台）
  -j, --json             输出原始 JSON 而非 Markdown 报告
  -h, --help             显示帮助

环境变量：
  OPENAI_API_KEY   API Key
  OPENAI_BASE_URL  Base URL（可选）
  MODEL            模型名称（可选）

示例：
  # 使用环境变量
  export OPENAI_API_KEY="sk-xxx"
  node analyze.js --file 合同.docx

  # 命令行传入 API Key
  node analyze.js --file 合同.docx --api-key sk-xxx --base-url https://api.deepseek.com/v1

  # 输出到文件
  node analyze.js --file 合同.docx --output 分析结果.md
`);
}

// 检查依赖
async function checkDependencies() {
  try {
    require("mammoth");
  } catch (e) {
    console.error("❌ 未找到 mammoth ，请先运行：npm install");
    process.exit(1);
  }
  try {
    require("openai");
  } catch (e) {
    console.error("❌ 未找到 openai，请先运行：npm install");
    process.exit(1);
  }
}

// 提取 DOCX 文本
async function extractDocxText(filePath) {
  const mammoth = require("mammoth");
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();

  if (!text) {
    throw new Error("未能从 DOCX 中提取到文本，请确认文件不是空文档。");
  }
  return text;
}

// 系统提示词
const SYSTEM_PROMPT = `你是严谨的合同信息抽取助手。请从合同文本中提取付款计划、质保明细和合同问题。
要求：
1. 只根据合同文本输出，不要编造。
2. 问题严重程度只能是 error、warning、info。
3. 付款描述必须保留为数组，包含付款前置条件、付款节点、发票要求等描述。
4. 质保字段分为 core_fields 和 extra_fields。
5. 每条结果尽量给出 location 和 sourceText，便于人工复核。
6. confidence 取 0 到 1 的小数。
7. 【语言要求】所有输出文字（stage、name、field、type、description、content 等）必须使用简体中文。除非合同原文为纯英文合同，否则禁止输出英文或中英混排的字段名/阶段名。
   - stage 格式示例：「第一阶段」「第二阶段」或「预付款」「验收款」「质保金」，禁止「First stage - 合同签订后预付款」这种格式
   - name 应为简洁的付款节点名称，如「合同签订」「系统上线」「质保期满」等
   - field 必须是中文，如「质保期」「响应时效」「违约金」等，禁止 camelCase 英文
   - type 必须是中文，如「条款矛盾」「定义模糊」「付款延迟风险」等，禁止「ContradictoryTerms」「AmbiguousDefinition」等 camelCase 英文
`;

// JSON Schema 结构化输出
const JSON_SCHEMA = {
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
            sourceText: { type: "string" },
          },
        },
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
            sourceText: { type: "string" },
          },
        },
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
                sourceText: { type: "string" },
              },
            },
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
                sourceText: { type: "string" },
              },
            },
          },
        },
      },
      confidence: {
        type: "object",
        additionalProperties: false,
        required: ["overall", "payment_plan", "warranty", "issues"],
        properties: {
          overall: { type: "number" },
          payment_plan: { type: "number" },
          warranty: { type: "number" },
          issues: { type: "number" },
        },
      },
    },
  },
  strict: true,
};

// 调用 AI 分析
async function analyzeContract(text, fileName, apiKey, baseUrl, model) {
  const { OpenAI } = require("openai");

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });

  console.log("🔍 正在分析合同，请稍候...");

  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `文件名：${fileName}\n\n合同文本：\n${text}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        ...JSON_SCHEMA,
      },
    },
  });

  const result = JSON.parse(response.output_text);
  return result;
}

// 格式化结果为 Markdown
function formatMarkdown(result, fileName) {
  const lines = [];
  lines.push(`# 合同分析结果\n`);
  lines.push(`**文件：**${fileName}`);
  lines.push(`**分析时间：**${new Date().toLocaleString("zh-CN")}\n`);

  // 置信度
  lines.push(`## 📊 置信度\n`);
  const c = result.confidence;
  lines.push(`| 维度 | 分数 |`);
  lines.push(`|------|------|`);
  lines.push(`| 整体 | ${c.overall} |`);
  lines.push(`| 付款计划 | ${c.payment_plan} |`);
  lines.push(`| 质保明细 | ${c.warranty} |`);
  lines.push(`| 问题检测 | ${c.issues} |\n`);

  // 付款计划
  lines.push(`## 💳 付款计划\n`);
  if (result.payment_plan && result.payment_plan.length > 0) {
    lines.push(`| 阶段 | 名称 | 比例 | 触发条件 | 时限 | 备注 |`);
    lines.push(`|------|------|------|----------|------|------|`);
    for (const item of result.payment_plan) {
      const conditions = item.conditions.join("；") || "-";
      lines.push(`| ${item.stage} | ${item.name} | ${item.percentage} | ${conditions} | ${item.deadline || "-"} | ${item.note || "-"} |`);
    }
    lines.push("");
  } else {
    lines.push("未提取到付款计划信息。\n");
  }

  // 质保明细
  lines.push(`## 🔧 质保明细\n`);
  const allWarranty = [
    ...(result.warranty.core_fields || []),
    ...(result.warranty.extra_fields || []),
  ];
  if (allWarranty.length > 0) {
    lines.push(`| 字段 | 内容 | 备注 |`);
    lines.push(`|------|------|------|`);
    for (const item of allWarranty) {
      lines.push(`| ${item.field} | ${item.content} | ${item.note || "-"} |`);
    }
    lines.push("");
  } else {
    lines.push("未提取到质保明细信息。\n");
  }

  // 合同问题
  lines.push(`## ⚠️ 合同问题\n`);
  if (result.issues && result.issues.length > 0) {
    for (const issue of result.issues) {
      const severityEmoji =
        issue.severity === "error" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
      lines.push(`${severityEmoji} **${issue.type}** \u3010${issue.severity.toUpperCase()}\u3011`);
      lines.push(`- 问题：${issue.description}`);
      lines.push(`- 位置：${issue.location || "-"}`);
      if (issue.sourceText) {
        lines.push(`- 原文：${issue.sourceText.substring(0, 200)}${issue.sourceText.length > 200 ? "..." : ""}`);
      }
      lines.push("");
    }
  } else {
    lines.push("未发现明显问题。\n");
  }

  // 免责声明
  lines.push(`---\n`);
  lines.push(`> ⚠️ 免责声明：本分析结果仅供参考，不构成法律意见。请始终以合同原文为准。`);

  return lines.join("\n");
}

// 主程序
async function main() {
  const options = parseArgs();

  if (options.help || !options.file) {
    showHelp();
    if (!options.file) {
      console.error("❌ 错误：缺少必需参数 --file");
      process.exit(1);
    }
    return;
  }

  // 检查依赖
  await checkDependencies();

  // 检查文件
  if (!fs.existsSync(options.file)) {
    console.error(`❌ 文件不存在：${options.file}`);
    process.exit(1);
  }

  const ext = path.extname(options.file).toLowerCase();
  if (ext !== ".docx") {
    console.error(`❌ 不支持的文件格式：${ext}，当前仅支持 DOCX 文件。`);
    process.exit(1);
  }

  // 检查 API Key
  if (!options.apiKey) {
    console.error("❌ 未提供 API Key，请通过环境变量 OPENAI_API_KEY 或 --api-key 参数指定。");
    process.exit(1);
  }

  try {
    // 提取文本
    console.log(`📄 正在读取：${options.file}`);
    const text = await extractDocxText(options.file);
    console.log(`✅ 文本提取完成，共 ${text.length} 字符`);

    // 调用 AI 分析
    const result = await analyzeContract(
      text,
      path.basename(options.file),
      options.apiKey,
      options.baseUrl,
      options.model
    );
    console.log("✅ AI 分析完成\n");

    // 输出
    if (options.json) {
      const json = JSON.stringify(result, null, 2);
      if (options.output) {
        fs.writeFileSync(options.output, json, "utf-8");
        console.log(`📁 结果已保存到：${options.output}`);
      } else {
        console.log(json);
      }
    } else {
      const markdown = formatMarkdown(result, path.basename(options.file));
      if (options.output) {
        fs.writeFileSync(options.output, markdown, "utf-8");
        console.log(`📁 分析报告已保存到：${options.output}`);
      } else {
        console.log("\n" + "=".repeat(60));
        console.log(markdown);
        console.log("=".repeat(60) + "\n");
      }
    }

    console.log("🎉 分析完成！");
  } catch (error) {
    console.error(`
❌ 分析失败：${error.message || error}`);
    if (error.response) {
      console.error(`详细信息：${JSON.stringify(error.response.data || error.response)}`);
    }
    process.exit(1);
  }
}

main();
