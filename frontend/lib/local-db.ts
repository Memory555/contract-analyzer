"use client";

import Dexie, { type Table } from "dexie";
import type { AnalysisRecord } from "./types";

class ContractAnalyzerDb extends Dexie {
  records!: Table<AnalysisRecord, string>;

  constructor() {
    super("contract-analyzer-demo");
    this.version(1).stores({
      records: "id, fileName, createdAt"
    });
  }
}

export const db = new ContractAnalyzerDb();

export async function saveAnalysisRecord(record: AnalysisRecord) {
  await db.records.put(record);
}

export async function listRecentRecords(limit = 8) {
  return db.records.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function cleanupExpiredRecords(retentionDays = 15) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  await db.records.where("createdAt").below(cutoff.toISOString()).delete();
}

export async function clearLocalDatabase() {
  await db.records.clear();
}
