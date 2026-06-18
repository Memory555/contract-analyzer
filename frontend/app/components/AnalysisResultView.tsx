import { Search } from "lucide-react";
import type { AnalysisResult, ContractAnalysisRecord, ContractIssue, PaymentPlanItem, WarrantyField } from "@/lib/types";
import { WarrantyTable } from "./WarrantyTable";

const severityMap = {
  error: "错误",
  warning: "警告",
  info: "提示"
};

/** 翻译合同问题 type 英文名 → 中文 */
const issueTypeMap: Record<string, string> = {
  ContradictoryTerms: "条款矛盾",
  AmbiguousDefinition: "定义模糊",
  MissingClause: "条款缺失",
  UnfairTerms: "不公平条款",
  PenaltyOrLiquidatedDamages: "违约金/惩罚条款",
  WarrantyPeriodConflict: "质保期冲突",
  PaymentTermConflict: "付款条件冲突",
  ScopeAmbiguity: "范围模糊",
  RiskAllocation: "风险分配",
  TerminationClause: "终止条款问题",
  LiabilityLimitation: "责任限制",
  ForceMajeure: "不可抗力条款",
  IntellectualProperty: "知识产权条款",
  ConfidentialityClause: "保密条款",
  DisputeResolution: "争议解决条款",
  ComplianceIssue: "合规问题",
  DataPrivacy: "数据隐私条款",
  InsuranceRequirement: "保险要求",
  ChangeOrderClause: "变更条款",
  PaymentDelayRisk: "付款延迟风险",
  PenaltyClause: "惩罚条款",
  GuaranteeOrBond: "担保/保证金条款"
};

function translateIssueType(type: string): string {
  return issueTypeMap[type] || type;
}

/** 翻译质保英文字段名 → 中文（兼容已存在的英文数据） */
const warrantyFieldMap: Record<string, string> = {
  // core fields
  WarrantyPeriod: "质保期",
  ResponseTimeMinor: "一般故障响应时效",
  ResponseTimeCritical: "重大故障响应时效",
  PenaltyPerIncidentResponseFailure: "响应超时违约金（单次）",
  PenaltyPerIncidentMajorFailure: "重大故障违约金",
  FreeMaintenanceDuringWarranty: "免费维保范围",
  TrainingObligation: "培训义务",
  // extra fields
  MaintenanceDocumentation: "维护文档义务",
  PostWarrantySupport: "质保期后支持",
  UpdateAndPatchProvision: "更新与补丁服务",
  HandoverOnWarrantyExpiry: "质保期满交接",
  SparePartsAvailability: "备件供应",
  OnsiteSupportRequirement: "现场支持要求",
  AcceptanceCriteria: "验收标准"
};

function translateField(field: string): string {
  return warrantyFieldMap[field] || field;
}

type SourceItem = ContractIssue | PaymentPlanItem | WarrantyField;

export function AnalysisResultView({
  result,
  issueCounts,
  currentContract,
  onOpenSource
}: {
  result: AnalysisResult;
  issueCounts: { error: number; warning: number; info: number };
  currentContract: ContractAnalysisRecord | null;
  onOpenSource: (item: SourceItem) => void;
}) {
  /** 过滤掉「发票与付款要求」这类通用说明行，只保留真正的付款阶段 */
  const paymentItems = result.payment_plan.filter(
    (item) => item.percentage && item.percentage !== "N/A" && !item.stage.includes("发票") && !item.name.includes("发票")
  );

  return (
    <section className="results">
      <div className="result-heading">
        <div>
          <h2>{currentContract ? `${currentContract.exportName} 分析结果` : "分析结果"}</h2>
          <p>
            {currentContract
              ? `批次：${currentContract.batchId}，原始文件名：${currentContract.fileName}`
              : "优先查看问题提示，再核对结构化明细。置信度不代表法律结论。"}
          </p>
        </div>
        <div className="confidence">
          <span>付款 {Math.round(result.confidence.payment_plan * 100)}%</span>
          <span>质保 {Math.round(result.confidence.warranty * 100)}%</span>
          <span>问题 {Math.round(result.confidence.issues * 100)}%</span>
        </div>
      </div>

      <section className="panel issue-panel">
        <div className="panel-title compact">
          <h2>合同问题提示</h2>
          <div className="issue-counts">
            <span className="tag error">错误 {issueCounts.error}</span>
            <span className="tag warning">警告 {issueCounts.warning}</span>
            <span className="tag info">提示 {issueCounts.info}</span>
          </div>
        </div>
        {result.issues.length === 0 ? (
          <p className="empty">未发现合同问题。</p>
        ) : (
          <div className="issue-list">
            {result.issues.map((issue) => (
              <article key={issue.id} className={`issue-card ${issue.severity}`}>
                <span className={`tag ${issue.severity}`}>{severityMap[issue.severity]}</span>
                <strong>{translateIssueType(issue.type)}</strong>
                <p>{issue.description}</p>
                <button type="button" onClick={() => onOpenSource(issue)}>
                  <Search size={15} />
                  查看原文位置：{issue.location || "未标明"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>付款计划明细</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>阶段</th>
                <th>比例</th>
                <th>付款描述</th>
                <th>支付时限</th>
                <th>备注</th>
                <th>位置</th>
              </tr>
            </thead>
            <tbody>
              {paymentItems.map((item) => (
                <tr key={item.id}>
                  <td>{formatStage(item)}</td>
                  <td>{item.percentage}</td>
                  <td>{item.conditions.map((condition) => <div key={condition}>{condition}</div>)}</td>
                  <td>{item.deadline}</td>
                  <td>{item.note}</td>
                  <td>
                    <button className="link-button" type="button" onClick={() => onOpenSource(item)}>
                      {item.location || "查看"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title compact">
          <h2>质保明细</h2>
          <span className="muted">核心字段 + LLM 扩展字段</span>
        </div>
        <WarrantyTable title="核心字段" items={translateFields(result.warranty.core_fields)} onOpenSource={onOpenSource} />
        <WarrantyTable title="扩展字段" items={translateFields(result.warranty.extra_fields)} onOpenSource={onOpenSource} />
      </section>
    </section>
  );
}

/**
 * 格式化付款阶段：合并 stage + percentage 为简洁的「第一阶段 30%」格式
 */
function formatStage(item: PaymentPlanItem): React.ReactNode {
  const pct = item.percentage || "";
  // 如果 stage 已经是中文简短格式（如「第一阶段」「预付款」），直接用
  if (/^第[一二三四五六七八九十]+阶段$/.test(item.stage.trim())) {
    return <strong>{item.stage} {pct}</strong>;
  }
  // 如果 stage 包含英文或过长，提取/生成中文阶段
  let cleanStage = item.stage
    .replace(/^[Ff]irst\s+[Ss]tage\s*[-—–]\s*/, "")
    .replace(/^[Ss]econd\s+[Ss]tage\s*[-—–]\s*/, "")
    .replace(/^[Tt]hird\s+[Ss]tage\s*[-—–]\s*/, "")
    .replace(/^[Ff]ourth\s+[Ss]tage\s*[-—–]\s*/, "")
    .replace(/^[Ff]ifth\s+[Ss]tage\s*[-—–]\s*/, "")
    .trim();

  // 如果清理后为空或和 name 重复，用 name 作为阶段名
  if (!cleanStage || cleanStage === item.name) {
    cleanStage = item.name || "付款阶段";
  }

  return (
    <>
      <strong>{cleanStage}</strong>
      <span>{pct}</span>
    </>
  );
}

/** 将 warranty items 的 field 字段从英文翻译成中文 */
function translateFields(items: WarrantyField[]): WarrantyField[] {
  return items.map((item) => ({ ...item, field: translateField(item.field) }));
}

export type { SourceItem };
