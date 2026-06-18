import type { AnalysisResult } from "./types";

export const demoResult: AnalysisResult = {
  issues: [
    {
      id: "issue-1",
      type: "条款矛盾",
      severity: "error",
      description: "5.4 条约定质保期为 3 年，7.1 条约定质保期为 1 年，存在同一事项定义不一致。",
      location: "第五条 5.4 vs 第七条 7.1",
      sourceText: "5.4 质保期为三年；7.1 质保期为一年。"
    },
    {
      id: "issue-2",
      type: "定义模糊",
      severity: "info",
      description: "合同中出现“合理期限内”，但未量化具体天数或工作日。",
      location: "售后服务条款",
      sourceText: "乙方应在合理期限内完成响应。"
    }
  ],
  payment_plan: [
    {
      id: "pay-1",
      stage: "第一阶段",
      name: "合同签订后",
      percentage: "30%",
      conditions: ["合同签订", "收到业主方首付款", "乙方提供增值税专用发票"],
      deadline: "60 个工作日",
      note: "背靠背付款",
      location: "第五条 5.1",
      sourceText: "合同签订后，乙方提供增值税专用发票，甲方在收到业主方首付款后 60 个工作日内支付合同总额的 30%。"
    },
    {
      id: "pay-2",
      stage: "第二阶段",
      name: "项目验收后",
      percentage: "65%",
      conditions: ["项目通过验收", "乙方提交验收资料"],
      deadline: "30 个工作日",
      note: "需完成验收流程",
      location: "第五条 5.2",
      sourceText: "项目验收合格后，甲方向乙方支付合同总额的 65%。"
    },
    {
      id: "pay-3",
      stage: "第三阶段",
      name: "质保期满后",
      percentage: "5%",
      conditions: ["质保期届满", "无未解决质量问题"],
      deadline: "30 个工作日",
      note: "质保金",
      location: "第五条 5.3",
      sourceText: "质保期满且无未解决质量问题后，甲方向乙方支付合同总额的 5%。"
    }
  ],
  warranty: {
    core_fields: [
      {
        id: "war-1",
        field: "质保期",
        content: "验收合格之日起 1 年",
        note: "与付款条款中的 3 年存在冲突",
        location: "第七条 7.1",
        sourceText: "自项目验收合格之日起，乙方提供一年质保服务。"
      },
      {
        id: "war-2",
        field: "响应时效",
        content: "重大故障 0.5 小时响应，3 小时解决；一般故障 1 小时响应，24 小时解决。",
        note: "按故障等级区分",
        location: "第七条 7.3",
        sourceText: "重大故障 0.5 小时响应，3 小时解决；一般故障 1 小时响应，24 小时解决。"
      },
      {
        id: "war-3",
        field: "违约金",
        content: "一般故障超时 1000 元/次，重大故障超时 5000 元/次。",
        note: "需结合实际违约责任确认",
        location: "第七条 7.5",
        sourceText: "一般故障超时违约金为 1000 元/次，重大故障超时违约金为 5000 元/次。"
      }
    ],
    extra_fields: [
      {
        id: "war-extra-1",
        field: "更新升级",
        content: "7 个工作日内无条件提供版本更新或补丁。",
        note: "LLM 识别的扩展字段",
        location: "第七条 7.6",
        sourceText: "乙方应在 7 个工作日内无条件提供版本更新或补丁。"
      }
    ]
  },
  confidence: {
    overall: 0.86,
    payment_plan: 0.9,
    warranty: 0.83,
    issues: 0.78
  }
};
