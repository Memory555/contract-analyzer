"use client";

import mammoth from "mammoth/mammoth.browser";

export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();

  if (!text) {
    throw new Error("未能从 DOCX 中提取到文本，请确认文件不是空文档。");
  }

  return text;
}

export function validateDocxFile(file: File): string | null {
  const maxBytes = 20 * 1024 * 1024;
  const lowerName = file.name.toLowerCase();

  if (!lowerName.endsWith(".docx")) {
    return "Demo 版本暂时仅支持 DOCX 文件。";
  }

  if (file.size > maxBytes) {
    return "文件大小超过 20MB，请选择更小的 DOCX 文件。";
  }

  return null;
}
