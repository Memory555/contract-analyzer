import { useEffect, useState } from "react";

type LlmSettings = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
};

export function SettingsPage({
  settings,
  onSave,
  onClearLocalData
}: {
  settings: LlmSettings;
  onSave: (settings: LlmSettings) => void;
  onClearLocalData: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [openSection, setOpenSection] = useState<"model" | "about" | "data">("model");
  const [savedFlash, setSavedFlash] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: "idle" | "testing" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [clearFlash, setClearFlash] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    window.localStorage.setItem("contract-analyzer-theme", next ? "dark" : "light");
  }

  async function testModelService() {
    setTestStatus({ type: "testing", message: "正在测试模型服务连通性..." });
    try {
      const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL || "").replace(/\/+$/, "");
      const response = await fetch(`${backendBaseUrl}/api/model-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: draft.openaiApiKey.trim() || undefined,
          openaiBaseUrl: draft.openaiBaseUrl.trim() || undefined,
          openaiModel: draft.openaiModel.trim() || undefined
        })
      });
      const data = (await response.json()) as { message?: string; model?: string; baseURL?: string; mode?: string; source?: { model?: string } };
      if (!response.ok) {
        throw new Error(data.message || "模型服务联通测试失败。");
      }
      setTestStatus({
        type: "success",
        message: `联通成功：${data.model || "当前模型"}，${data.baseURL || "当前地址"}，${data.mode || "当前接口"}，来源：${data.source?.model || "默认"}`
      });
    } catch (error) {
      setTestStatus({
        type: "error",
        message: error instanceof Error ? error.message : "模型服务联通测试失败。"
      });
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p>设置 / 模型配置</p>
          <h1>平台设置</h1>
        </div>
        <div className="badges">
          <span>本地保存</span>
          <span>模型配置</span>
        </div>
      </header>

      <section className="settings-list">
        <article className={openSection === "model" ? "settings-item open" : "settings-item"}>
          <button className="settings-summary" type="button" onClick={() => setOpenSection("model")}>
            <span>
              <strong>个人默认模型服务配置</strong>
              <small>保存后会存于当前浏览器，后续上传默认优先使用个人模型；留空则使用后端管理员全局模型</small>
            </span>
            <span>{openSection === "model" ? "收起" : "展开"}</span>
          </button>
          {openSection === "model" ? (
            <div className="settings-content settings-panel">
              <label>
                Base URL
                <input
                  value={draft.openaiBaseUrl}
                  onChange={(event) => setDraft({ ...draft, openaiBaseUrl: event.target.value })}
                  placeholder="留空则使用后端管理员配置；自定义地址需填写 API Key"
                />
              </label>
              <label>
                API Key
                <input
                  value={draft.openaiApiKey}
                  onChange={(event) => setDraft({ ...draft, openaiApiKey: event.target.value })}
                  type="password"
                  placeholder="留空则使用后端管理员配置；自定义地址需填写"
                />
              </label>
              <label>
                模型名称
                <input
                  value={draft.openaiModel}
                  onChange={(event) => setDraft({ ...draft, openaiModel: event.target.value })}
                  placeholder="留空则使用后端管理员配置"
                />
              </label>
              <div className="settings-actions">
                <button
                  className={savedFlash ? "primary settings-save saved" : "primary settings-save"}
                  type="button"
                  onClick={() => {
                    onSave(draft);
                    setSavedFlash(true);
                    window.setTimeout(() => setSavedFlash(false), 1600);
                  }}
                >
                  {savedFlash ? "已保存" : "保存设置"}
                </button>
                <button
                  className="secondary settings-test"
                  type="button"
                  disabled={testStatus.type === "testing"}
                  onClick={() => void testModelService()}
                >
                  {testStatus.type === "testing" ? "测试中..." : "联通测试"}
                </button>
              </div>
              {testStatus.type !== "idle" ? (
                <p className={`test-result ${testStatus.type}`}>{testStatus.message}</p>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className={openSection === "about" ? "settings-item open" : "settings-item"}>
          <button className="settings-summary" type="button" onClick={() => setOpenSection("about")}>
            <span>
              <strong>关于平台</strong>
              <small>查看当前 Demo 的能力范围、版本和数据说明</small>
            </span>
            <span>{openSection === "about" ? "收起" : "展开"}</span>
          </button>
          {openSection === "about" ? (
            <div className="settings-content about-panel">
              <p>
                合同智能分析平台用于将 PDF、DOC、DOCX、JPG、PNG 合同中的付款计划、质保明细和合同问题结构化展示，并支持 Excel 导出。
              </p>
              <div className="theme-toggle-row">
                <span>外观模式</span>
                <button className="secondary" type="button" onClick={toggleDarkMode}>
                  {darkMode ? "☀️ 切换到亮色模式" : "🌙 切换到暗色模式"}
                </button>
              </div>
              <dl>
                <div>
                  <dt>当前版本</dt>
                  <dd>Demo V0.1</dd>
                </div>
                <div>
                  <dt>文件范围</dt>
                  <dd>PDF / DOC / DOCX / JPG / PNG</dd>
                </div>
                <div>
                  <dt>页面形态</dt>
                  <dd>Next.js</dd>
                </div>
                <div>
                  <dt>数据说明</dt>
                  <dd>历史记录保存在当前浏览器 IndexedDB 中。</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </article>

        <article className={openSection === "data" ? "settings-item open" : "settings-item"}>
          <button className="settings-summary" type="button" onClick={() => setOpenSection("data")}>
            <span>
              <strong>本地数据管理</strong>
              <small>清除当前浏览器中保存的模型配置、合同分析记录和临时状态</small>
            </span>
            <span>{openSection === "data" ? "收起" : "展开"}</span>
          </button>
          {openSection === "data" ? (
          <div className="settings-content settings-panel">
            <p className="settings-note">
              该操作只影响当前浏览器，不会删除已经下载到电脑上的 Excel 文件，也不会影响 Vercel 环境变量。
            </p>
            <button
              className={clearFlash ? "danger-button cleared" : "danger-button"}
              type="button"
              onClick={() => onClearLocalData()}
            >
              {clearFlash ? "已清除" : "清除本地数据"}
            </button>
          </div>
          ) : null}
        </article>
      </section>
    </>
  );
}

export type { LlmSettings };
