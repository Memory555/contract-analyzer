"use client";

import ExcelJS from "exceljs";
import type { AnalysisResult, ContractAnalysisRecord, IssueSeverity } from "./types";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "DDEBFF" }
  };
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = Array.isArray(cell.value) ? cell.value.join("\n") : String(cell.value ?? "");
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 42));
    });
    column.width = maxLength;
  });
}

function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function safeExcelName(name: string) {
  return name.replace(/\.(docx|doc|pdf)$/i, "").replace(/[\\/:*?"<>|]/g, "_").trim() || "未命名合同";
}

function severityLabel(severity: IssueSeverity) {
  const map: Record<IssueSeverity, string> = {
    error: "错误",
    warning: "警告",
    info: "提示"
  };
  return map[severity] ?? severity;
}

export async function exportAnalysisExcel(
  fileName: string,
  result: AnalysisResult,
  includeIssues: boolean,
  exportName?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "合同智能分析平台 Demo";
  workbook.created = new Date();

  const paymentSheet = workbook.addWorksheet("付款计划明细");
  paymentSheet.addRow(["阶段", "阶段名称", "支付比例", "付款描述", "支付时限", "备注", "涉及位置"]);
  styleHeader(paymentSheet.getRow(1));
  result.payment_plan.forEach((item) => {
    paymentSheet.addRow([
      item.stage,
      item.name,
      item.percentage,
      item.conditions.join("\n"),
      item.deadline,
      item.note,
      item.location
    ]);
  });
  paymentSheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(paymentSheet);

  const warrantySheet = workbook.addWorksheet("质保明细");
  warrantySheet.addRow(["字段", "内容", "备注", "涉及位置", "字段类型"]);
  styleHeader(warrantySheet.getRow(1));
  result.warranty.core_fields.forEach((item) => {
    warrantySheet.addRow([item.field, item.content, item.note, item.location, "核心字段"]);
  });
  result.warranty.extra_fields.forEach((item) => {
    warrantySheet.addRow([item.field, item.content, item.note, item.location, "扩展字段"]);
  });
  warrantySheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(warrantySheet);

  if (includeIssues) {
    const issueSheet = workbook.addWorksheet("合同问题");
    issueSheet.addRow(["序号", "问题类型", "严重程度", "问题描述", "涉及位置"]);
    styleHeader(issueSheet.getRow(1));
    if (result.issues.length === 0) {
      issueSheet.addRow(["", "未发现问题", "", "", ""]);
    } else {
      result.issues.forEach((issue, index) => {
        issueSheet.addRow([index + 1, issue.type, severityLabel(issue.severity), issue.description, issue.location]);
      });
    }
    issueSheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    autoWidth(issueSheet);
  }

  const safeName = exportName || safeExcelName(fileName);
  await saveWorkbook(workbook, `合同分析结果_${safeName}.xlsx`);
}

function contractPrefix(contract: ContractAnalysisRecord) {
  return [
    contract.batchId,
    String(contract.uploadIndex).padStart(3, "0"),
    contract.id,
    contract.displayName,
    contract.fileName
  ];
}

export async function exportBatchAnalysisExcel(
  batchId: string,
  contracts: ContractAnalysisRecord[],
  includeIssues: boolean
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "合同智能分析平台 Demo";
  workbook.created = new Date();

  const overviewSheet = workbook.addWorksheet("批量概览");
  overviewSheet.addRow([
    "批次ID",
    "上传序号",
    "合同ID",
    "合同名称",
    "原始文件名",
    "分析状态",
    "问题数量",
    "错误数量",
    "警告数量",
    "付款条目数",
    "质保字段数",
    "整体置信度",
    "失败原因"
  ]);
  styleHeader(overviewSheet.getRow(1));
  contracts.forEach((contract) => {
    const issues = contract.result?.issues ?? [];
    const warrantyFields = [
      ...(contract.result?.warranty.core_fields ?? []),
      ...(contract.result?.warranty.extra_fields ?? [])
    ];
    overviewSheet.addRow([
      contract.batchId,
      String(contract.uploadIndex).padStart(3, "0"),
      contract.id,
      contract.displayName,
      contract.fileName,
      contract.status === "success" ? "成功" : "失败",
      issues.length,
      issues.filter((issue) => issue.severity === "error").length,
      issues.filter((issue) => issue.severity === "warning").length,
      contract.result?.payment_plan.length ?? 0,
      warrantyFields.length,
      contract.result ? `${Math.round(contract.result.confidence.overall * 100)}%` : "",
      contract.errorMessage ?? ""
    ]);
  });
  overviewSheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(overviewSheet);

  const paymentSheet = workbook.addWorksheet("付款计划明细");
  paymentSheet.addRow([
    "批次ID",
    "上传序号",
    "合同ID",
    "合同名称",
    "原始文件名",
    "阶段",
    "阶段名称",
    "支付比例",
    "付款描述",
    "支付时限",
    "备注",
    "涉及位置"
  ]);
  styleHeader(paymentSheet.getRow(1));
  contracts.forEach((contract) => {
    contract.result?.payment_plan.forEach((item) => {
      paymentSheet.addRow([
        ...contractPrefix(contract),
        item.stage,
        item.name,
        item.percentage,
        item.conditions.join("\n"),
        item.deadline,
        item.note,
        item.location
      ]);
    });
  });
  paymentSheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(paymentSheet);

  const warrantySheet = workbook.addWorksheet("质保明细");
  warrantySheet.addRow([
    "批次ID",
    "上传序号",
    "合同ID",
    "合同名称",
    "原始文件名",
    "字段",
    "内容",
    "备注",
    "涉及位置",
    "字段类型"
  ]);
  styleHeader(warrantySheet.getRow(1));
  contracts.forEach((contract) => {
    contract.result?.warranty.core_fields.forEach((item) => {
      warrantySheet.addRow([...contractPrefix(contract), item.field, item.content, item.note, item.location, "核心字段"]);
    });
    contract.result?.warranty.extra_fields.forEach((item) => {
      warrantySheet.addRow([...contractPrefix(contract), item.field, item.content, item.note, item.location, "扩展字段"]);
    });
  });
  warrantySheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(warrantySheet);

  if (includeIssues) {
    const issueSheet = workbook.addWorksheet("合同问题");
    issueSheet.addRow([
      "批次ID",
      "上传序号",
      "合同ID",
      "合同名称",
      "原始文件名",
      "序号",
      "问题类型",
      "严重程度",
      "问题描述",
      "涉及位置"
    ]);
    styleHeader(issueSheet.getRow(1));
    contracts.forEach((contract) => {
      if (!contract.result || contract.result.issues.length === 0) {
        issueSheet.addRow([...contractPrefix(contract), "", "未发现问题", "", "", ""]);
        return;
      }
      contract.result.issues.forEach((issue, index) => {
        issueSheet.addRow([
          ...contractPrefix(contract),
          index + 1,
          issue.type,
          severityLabel(issue.severity),
          issue.description,
          issue.location
        ]);
      });
    });
    issueSheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    autoWidth(issueSheet);
  }

  const failedSheet = workbook.addWorksheet("失败清单");
  failedSheet.addRow(["批次ID", "上传序号", "合同ID", "合同名称", "原始文件名", "状态", "失败原因"]);
  styleHeader(failedSheet.getRow(1));
  const failedContracts = contracts.filter((contract) => contract.status === "failed");
  if (failedContracts.length === 0) {
    failedSheet.addRow([batchId, "", "", "", "", "无失败合同", ""]);
  } else {
    failedContracts.forEach((contract) => {
      failedSheet.addRow([
        contract.batchId,
        String(contract.uploadIndex).padStart(3, "0"),
        contract.id,
        contract.displayName,
        contract.fileName,
        "失败",
        contract.errorMessage ?? ""
      ]);
    });
  }
  failedSheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  autoWidth(failedSheet);

  await saveWorkbook(workbook, `合同批量分析结果_${batchId}.xlsx`);
}
