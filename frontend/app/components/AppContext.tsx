"use client";

import { useCallback, useContext, createContext, useReducer, type ReactNode } from "react";
import type { AnalysisResult, BatchAnalysisRecord, ContractAnalysisRecord, ExportHistoryRecord } from "@/lib/types";

type Status = "idle" | "uploading" | "analyzing" | "success" | "error";
type PageKey = "analysis" | "exports" | "settings";
type LlmSettings = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
};
type Toast = { message: string; tone: "success" | "error" } | null;
type SourceItem = unknown | null;

/* --- State shape --- */
export type AppState = {
  activePage: PageKey;
  sidebarCollapsed: boolean;
  status: Status;
  fileName: string;
  error: string;
  message: string;
  selectedFiles: File[];
  result: AnalysisResult | null;
  includeIssues: boolean;
  sourceItem: unknown | null;
  batches: BatchAnalysisRecord[];
  contracts: ContractAnalysisRecord[];
  exportRecords: ExportHistoryRecord[];
  activeBatchId: string;
  currentContractId: string;
  llmSettings: LlmSettings;
  showClearConfirm: boolean;
  toast: Toast;
};

/* --- Actions --- */
export type AppAction =
  | { type: "SET_PAGE"; page: PageKey }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_STATUS"; status: Status; fileName?: string; error?: string; message?: string }
  | { type: "SET_RESULT"; result: AnalysisResult | null; fileName?: string }
  | { type: "ADD_FILES"; files: File[]; maxBatch: number }
  | { type: "REMOVE_FILE"; index: number }
  | { type: "SET_CONTRACTS"; contracts: ContractAnalysisRecord[] }
  | { type: "UPDATE_CONTRACT"; contract: ContractAnalysisRecord }
  | { type: "SET_ACTIVE_BATCH"; batchId: string; contracts: ContractAnalysisRecord[]; currentContractId?: string }
  | { type: "SET_CURRENT_CONTRACT"; contractId: string; result?: AnalysisResult | null; fileName?: string }
  | { type: "SET_BATCHES"; batches: BatchAnalysisRecord[] }
  | { type: "SET_EXPORT_RECORDS"; records: ExportHistoryRecord[] }
  | { type: "SET_INCLUDE_ISSUES"; value: boolean }
  | { type: "SET_SOURCE_ITEM"; item: unknown | null }
  | { type: "SET_LLM_SETTINGS"; settings: LlmSettings }
  | { type: "SET_SHOW_CLEAR_CONFIRM"; value: boolean }
  | { type: "SET_TOAST"; toast: Toast }
  | { type: "CLEAR_ALL" }
  | { type: "CLEAR_FILES" };

const initialState: AppState = {
  activePage: "analysis",
  sidebarCollapsed: false,
  status: "idle",
  fileName: "",
  error: "",
  message: "",
  selectedFiles: [],
  result: null,
  includeIssues: true,
  sourceItem: null,
  batches: [],
  contracts: [],
  exportRecords: [],
  activeBatchId: "",
  currentContractId: "",
  llmSettings: { openaiApiKey: "", openaiBaseUrl: "", openaiModel: "" },
  showClearConfirm: false,
  toast: null
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_PAGE":
      return { ...state, activePage: action.page };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "SET_STATUS":
      return {
        ...state,
        status: action.status,
        fileName: action.fileName ?? state.fileName,
        error: action.error ?? "",
        message: action.message ?? ""
      };
    case "SET_RESULT":
      return {
        ...state,
        result: action.result,
        fileName: action.fileName ?? state.fileName
      };
    case "ADD_FILES": {
      const nextFiles = [...state.selectedFiles, ...action.files].slice(0, action.maxBatch);
      const excess = state.selectedFiles.length + action.files.length > action.maxBatch;
      return {
        ...state,
        selectedFiles: nextFiles,
        status: "idle",
        error: "",
        fileName: nextFiles.length === 1 ? nextFiles[0].name : `${nextFiles.length} 份待分析合同`,
        message: excess
          ? `已加入前 ${action.maxBatch} 份合同，超出部分未加入。`
          : `已加入 ${nextFiles.length} 份待分析合同，可继续添加或点击开始分析。`
      };
    }
    case "REMOVE_FILE": {
      const nextFiles = state.selectedFiles.filter((_, i) => i !== action.index);
      return {
        ...state,
        selectedFiles: nextFiles,
        fileName: nextFiles.length === 0 ? "" : nextFiles.length === 1 ? nextFiles[0].name : `${nextFiles.length} 份待分析合同`,
        message: nextFiles.length === 0 ? "待分析列表已清空。" : `待分析列表剩余 ${nextFiles.length} 份合同。`
      };
    }
    case "SET_CONTRACTS":
      return { ...state, contracts: action.contracts };
    case "UPDATE_CONTRACT":
      return { ...state, contracts: state.contracts.map((c) => c.id === action.contract.id ? action.contract : c) };
    case "SET_ACTIVE_BATCH":
      return {
        ...state,
        activeBatchId: action.batchId,
        contracts: action.contracts,
        currentContractId: action.currentContractId ?? action.contracts[0]?.id ?? ""
      };
    case "SET_CURRENT_CONTRACT":
      return {
        ...state,
        currentContractId: action.contractId,
        result: action.result ?? state.result,
        fileName: action.fileName ?? state.fileName
      };
    case "SET_BATCHES":
      return { ...state, batches: action.batches };
    case "SET_EXPORT_RECORDS":
      return { ...state, exportRecords: action.records };
    case "SET_INCLUDE_ISSUES":
      return { ...state, includeIssues: action.value };
    case "SET_SOURCE_ITEM":
      return { ...state, sourceItem: action.item };
    case "SET_LLM_SETTINGS":
      return { ...state, llmSettings: action.settings };
    case "SET_SHOW_CLEAR_CONFIRM":
      return { ...state, showClearConfirm: action.value };
    case "SET_TOAST":
      return { ...state, toast: action.toast };
    case "CLEAR_ALL":
      return {
        ...state,
        batches: [],
        contracts: [],
        exportRecords: [],
        activeBatchId: "",
        currentContractId: "",
        selectedFiles: [],
        result: null,
        fileName: "",
        error: "",
        message: "",
        status: "idle",
        llmSettings: { openaiApiKey: "", openaiBaseUrl: "", openaiModel: "" },
        showClearConfirm: false
      };
    case "CLEAR_FILES":
      return { ...state, selectedFiles: [] };
    default:
      return state;
  }
}

/* --- Context --- */
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => initialState });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const { state } = useContext(AppContext);
  return state;
}

export function useAppDispatch() {
  const { dispatch } = useContext(AppContext);
  return dispatch;
}

/* Convenience hooks for specific slices */
export function useAnalysisState() {
  const { state } = useContext(AppContext);
  return {
    status: state.status,
    fileName: state.fileName,
    error: state.error,
    message: state.message,
    result: state.result,
    selectedFiles: state.selectedFiles,
    contracts: state.contracts,
    activeBatchId: state.activeBatchId,
    currentContractId: state.currentContractId,
    includeIssues: state.includeIssues,
    sourceItem: state.sourceItem,
    canStartAnalysis: state.selectedFiles.length > 0 && state.status !== "uploading" && state.status !== "analyzing"
  };
}

export function useSettingsState() {
  const { state } = useContext(AppContext);
  return {
    llmSettings: state.llmSettings,
    showClearConfirm: state.showClearConfirm
  };
}

export type { Status, PageKey, LlmSettings, Toast };
