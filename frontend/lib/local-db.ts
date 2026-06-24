"use client";

import Dexie, { type Table } from "dexie";
import type { AnalysisFeedbackRecord, AnalysisRecord, BatchAnalysisRecord, ContractAnalysisRecord, ExportHistoryRecord } from "./types";

class ContractAnalyzerDb extends Dexie {
  records!: Table<AnalysisRecord, string>;
  batches!: Table<BatchAnalysisRecord, string>;
  contracts!: Table<ContractAnalysisRecord, string>;
  exports!: Table<ExportHistoryRecord, string>;
  feedbacks!: Table<AnalysisFeedbackRecord, string>;

  constructor() {
    super("contract-analyzer-demo");
    this.version(1).stores({
      records: "id, fileName, createdAt"
    });
    this.version(2).stores({
      records: "id, fileName, createdAt",
      batches: "batchId, createdAt, updatedAt, status",
      contracts: "id, batchId, uploadIndex, fileName, displayName, status, createdAt, updatedAt",
      exports: "id, batchId, contractId, mode, createdAt"
    });
    this.version(3).stores({
      records: "id, fileName, createdAt",
      batches: "batchId, createdAt, updatedAt, status",
      contracts: "id, batchId, uploadIndex, fileName, displayName, status, createdAt, updatedAt",
      exports: "id, batchId, contractId, mode, createdAt",
      feedbacks: "id, contractId, batchId, feedbackType, problemCategory, status, createdAt, updatedAt"
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

export async function saveBatchAnalysisRecord(record: BatchAnalysisRecord) {
  await db.batches.put(record);
}

export async function saveContractAnalysisRecord(record: ContractAnalysisRecord) {
  await db.contracts.put(record);
}

export async function bulkSaveContractAnalysisRecords(records: ContractAnalysisRecord[]) {
  await db.contracts.bulkPut(records);
}

export async function listRecentBatches(limit = 8) {
  return db.batches.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function listContractsByBatch(batchId: string) {
  return db.contracts.where("batchId").equals(batchId).sortBy("uploadIndex");
}

export async function listRecentSuccessfulContracts(limit = 50) {
  const contracts = await db.contracts.orderBy("updatedAt").reverse().limit(limit * 2).toArray();
  return contracts.filter((contract) => contract.status === "success" && contract.result).slice(0, limit);
}

export async function saveExportHistoryRecord(record: ExportHistoryRecord) {
  await db.exports.put(record);
}

export async function listRecentExports(limit = 8) {
  return db.exports.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function saveFeedbackRecord(record: AnalysisFeedbackRecord) {
  await db.feedbacks.put(record);
}

export async function listRecentFeedbacks(limit = 100) {
  return db.feedbacks.orderBy("updatedAt").reverse().limit(limit).toArray();
}

export async function getFeedbackByContract(contractId: string) {
  return db.feedbacks.where("contractId").equals(contractId).last();
}

export async function cleanupExpiredRecords(retentionDays = 15) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  await db.records.where("createdAt").below(cutoff.toISOString()).delete();
  await db.batches.where("createdAt").below(cutoff.toISOString()).delete();
  await db.contracts.where("createdAt").below(cutoff.toISOString()).delete();
  await db.exports.where("createdAt").below(cutoff.toISOString()).delete();
  await db.feedbacks.where("createdAt").below(cutoff.toISOString()).delete();
}

export async function clearLocalDatabase() {
  await db.records.clear();
  await db.batches.clear();
  await db.contracts.clear();
  await db.exports.clear();
  await db.feedbacks.clear();
}
