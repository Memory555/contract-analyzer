from html import escape

from app.services.runtime_config import EffectiveModelConfig


def render_admin_page(config: EffectiveModelConfig, *, has_admin_token: bool, admin_token: str = "", message: str = "") -> str:
    key_status = "已配置" if config.openai_api_key else "未配置"
    escaped_base_url = escape(config.openai_base_url or "")
    escaped_model = escape(config.openai_model or "")
    escaped_message = escape(message)
    escaped_token = escape(admin_token)
    token_notice = "已启用管理口令" if has_admin_token else "未设置管理口令，仅建议本地使用"
    form_action = f"/admin/model-config?token={escaped_token}" if escaped_token else "/admin/model-config"
    test_action = f"/admin/model-test?token={escaped_token}" if escaped_token else "/admin/model-test"
    message_html = f'<div class="message">{escaped_message}</div>' if escaped_message else ""
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>合同分析后端管理</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #172033; }}
    main {{ max-width: 760px; margin: 48px auto; padding: 0 20px; }}
    h1 {{ font-size: 28px; margin: 0 0 8px; }}
    p {{ color: #5d6677; line-height: 1.7; }}
    form, .meta div, .test-panel {{ background: #fff; border: 1px solid #e3e7ee; border-radius: 8px; padding: 24px; box-shadow: 0 8px 24px rgba(18, 31, 53, 0.06); }}
    label {{ display: block; margin: 18px 0; font-weight: 650; }}
    input {{ width: 100%; box-sizing: border-box; margin-top: 8px; padding: 11px 12px; border: 1px solid #cdd5e1; border-radius: 6px; font-size: 15px; }}
    button {{ padding: 11px 18px; border: 0; border-radius: 6px; background: #1f5eff; color: #fff; font-weight: 700; cursor: pointer; }}
    code {{ background: #eef2f7; padding: 2px 6px; border-radius: 4px; }}
    .meta {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }}
    .meta strong {{ display: block; margin-bottom: 4px; }}
    .message {{ margin: 16px 0; padding: 12px 14px; border-radius: 6px; background: #ecfdf3; color: #11613a; }}
    .warning {{ background: #fff7ed; color: #9a3412; padding: 12px 14px; border-radius: 6px; }}
    .test-panel {{ margin-top: 20px; }}
    .test-panel h2 {{ margin: 0 0 8px; font-size: 20px; }}
    .test-panel form {{ padding: 0; border: 0; box-shadow: none; }}
    .secondary {{ background: #eef2f7; color: #172033; margin-left: 8px; }}
  </style>
</head>
<body>
  <main>
    <h1>合同分析后端管理</h1>
    <p>这里配置后端实际调用的 OpenAI 或兼容 OpenAI 协议模型服务。保存后立即生效，后续合同分析会使用新配置。</p>
    <p class="warning">{token_notice}</p>
    {message_html}
    <section class="meta">
      <div><strong>API Key</strong><span>{key_status}，来源：{escape(config.api_key_source)}</span></div>
      <div><strong>模型</strong><span>{escape(config.openai_model)}，来源：{escape(config.model_source)}</span></div>
      <div><strong>Base URL</strong><span>{escape(config.openai_base_url or "SDK 默认地址")}，来源：{escape(config.base_url_source)}</span></div>
      <div><strong>健康检查</strong><span><code>/api/health</code></span></div>
    </section>
    <form method="post" action="{form_action}">
      <label>
        Base URL
        <input name="openai_base_url" value="{escaped_base_url}" placeholder="https://api.openai.com/v1" />
      </label>
      <label>
        模型名称
        <input name="openai_model" value="{escaped_model}" placeholder="gpt-4.1-mini" />
      </label>
      <label>
        API Key
        <input name="openai_api_key" type="password" placeholder="留空则保留已有后端管理配置；若无管理配置则使用 .env" />
      </label>
      <button type="submit">保存后端模型配置</button>
    </form>
    <section class="test-panel">
      <h2>连通性测试</h2>
      <p>使用当前后端全局模型配置进行测试。用户个人模型请在前端设置页测试。</p>
      <form method="post" action="{test_action}">
        <button type="submit" class="secondary">测试当前后端模型</button>
      </form>
    </section>
  </main>
</body>
</html>"""
