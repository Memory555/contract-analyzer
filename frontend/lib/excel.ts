"use client";

import ExcelJS from "exceljs";
import type { AnalysisResult } from "./types";

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

export async function exportAnalysisExcel(
  fileName: string,
  result: AnalysisResult,
  includeIssues: boolean
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
        issueSheet.addRow([index + 1, issue.type, issue.severity, issue.description, issue.location]);
      });
    }
    issueSheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    autoWidth(issueSheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = fileName.replace(/\.docx$/i, "");
  link.href = url;
  link.download = `合同分析结果_${safeName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
