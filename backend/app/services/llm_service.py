from typing import Any
import asyncio
import json
import re

from app.config import Settings
from app.schemas import ApiError
from app.services.runtime_config import ModelRuntimeConfig, RuntimeConfigStore


DEMO_ANALYSIS: dict[str, Any] = {
    "issues": [
        {
            "id": "issue-demo-1",
            "type": "配置提示",
            "severity": "info",
            "description": "当前后端未配置 OPENAI_API_KEY，返回演示分析结果用于联调。",
            "location": "系统配置",
            "sourceText": "未配置模型服务",
        }
    ],
    "payment_plan": [],
    "warranty": {"core_fields": [], "extra_fields": []},
    "confidence": {"overall": 0.3, "payment_plan": 0.3, "warranty": 0.3, "issues": 0.3},
    "message": "当前为后端演示数据。",
}


JSON_SCHEMA: dict[str, Any] = {
    "name": "contract_analysis_result",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["issues", "payment_plan", "warranty", "confidence"],
        "properties": {
            "issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "type", "severity", "description", "location", "sourceText"],
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string"},
                        "severity": {"type": "string", "enum": ["error", "warning", "info"]},
                        "description": {"type": "string"},
                        "location": {"type": "string"},
                        "sourceText": {"type": "string"},
                    },
                },
            },
            "payment_plan": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["id", "stage", "name", "percentage", "conditions", "deadline", "note", "location", "sourceText"],
                    "properties": {
                        "id": {"type": "string"},
                        "stage": {"type": "string"},
                        "name": {"type": "string"},
                        "percentage": {"type": "string"},
                        "conditions": {"type": "array", "items": {"type": "string"}},
                        "deadline": {"type": "string"},
                        "note": {"type": "string"},
                        "location": {"type": "string"},
                        "sourceText": {"type": "string"},
                    },
                },
            },
            "warranty": {
                "type": "object",
                "additionalProperties": False,
                "required": ["core_fields", "extra_fields"],
                "properties": {
                    "core_fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["id", "field", "content", "note", "location", "sourceText"],
                            "properties": {
                                "id": {"type": "string"},
                                "field": {"type": "string"},
                                "content": {"type": "string"},
                                "note": {"type": "string"},
                                "location": {"type": "string"},
                                "sourceText": {"type": "string"},
                            },
                        },
                    },
                    "extra_fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["id", "field", "content", "note", "location", "sourceText"],
                            "properties": {
                                "id": {"type": "string"},
                                "field": {"type": "string"},
                                "content": {"type": "string"},
                                "note": {"type": "string"},
                                "location": {"type": "string"},
                                "sourceText": {"type": "string"},
                            },
                        },
                    },
                },
            },
            "confidence": {
                "type": "object",
                "additionalProperties": False,
                "required": ["overall", "payment_plan", "warranty", "issues"],
                "properties": {
                    "overall": {"type": "number"},
                    "payment_plan": {"type": "number"},
                    "warranty": {"type": "number"},
                    "issues": {"type": "number"},
                },
            },
        },
    },
    "strict": True,
}


class LlmService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.runtime_config_store = RuntimeConfigStore(settings)

    async def analyze(
        self,
        file_name: str,
        contract_text: str,
        model_override: ModelRuntimeConfig | None = None,
    ) -> dict[str, Any]:
        model_config = self.runtime_config_store.get_effective_model_config(model_override)
        if not model_config.openai_api_key:
            return DEMO_ANALYSIS

        prompt = self._build_user_prompt(file_name, contract_text)
        return await asyncio.to_thread(self._analyze_sync, model_config, prompt)

    def _analyze_sync(self, model_config: ModelRuntimeConfig, prompt: str) -> dict[str, Any]:
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=model_config.openai_api_key,
                base_url=model_config.openai_base_url or None,
                timeout=60,
            )
            try:
                return self._analyze_with_responses(client, model_config.openai_model, prompt)
            except Exception:
                return self._analyze_with_chat_completions(client, model_config.openai_model, prompt)
        except Exception as exc:
            raise ApiError("MODEL_ANALYSIS_FAILED", "模型分析失败，请检查模型服务配置、模型名称或接口兼容性。") from exc

    def _analyze_with_responses(self, client: Any, model: str, prompt: str) -> dict[str, Any]:
        response = client.responses.create(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": self._system_prompt(),
                },
                {"role": "user", "content": prompt},
            ],
            text={"format": {"type": "json_schema", **JSON_SCHEMA}},
        )
        return self._parse_json(response.output_text)

    def _analyze_with_chat_completions(self, client: Any, model: str, prompt: str) -> dict[str, Any]:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": self._system_prompt()},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_schema", "json_schema": JSON_SCHEMA},
                temperature=0.1,
            )
        except Exception:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": self._system_prompt()},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
            )

        content = response.choices[0].message.content or ""
        return self._parse_json(content)

    def _system_prompt(self) -> str:
        return """你是严谨的合同信息抽取助手。请从合同文本中提取付款计划、质保明细和合同问题。
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
   - type 必须是中文，如「条款矛盾」「定义模糊」「付款延迟风险」等，禁止「ContradictoryTerms」「AmbiguousDefinition」等 camelCase 英文"""

    def _build_user_prompt(self, file_name: str, contract_text: str) -> str:
        return f"文件名：{file_name}\n\n合同文本：\n{contract_text[:120000]}"

    def _parse_json(self, text: str) -> dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if not match:
                raise
            return json.loads(match.group(0))
