import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { LaunchSplash } from "./components/LaunchSplash";
import { Onboarding, type OnboardingConfig, type ProviderInfo } from "./components/Onboarding";
import { Sidebar, type DialogInfo } from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import { UrlInput } from "./components/UrlInput";
import { ChatFeed, type ChatRound, type ChatResult } from "./components/ChatFeed";
import { RightSidebar, type SidebarData } from "./components/RightSidebar";
import "./styles.css";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          Extract(input: ExtractInput): Promise<ExtractResult>;
          Reset(): Promise<{ ok: boolean }>;
        };
      };
    };
  }
}

interface ExtractInput {
  url: string;
  goal: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  maxItems: number;
  mode: "auto";
}

interface ExtractResult {
  answer: string;
  data: Record<string, unknown>;
  strategy: { kind: "fields" | "collection" | "summary"; fields?: string[] };
  table: Array<Record<string, unknown>>;
  verification: { answersGoal: boolean; answer: string; title: string; issues: string[] };
  validation: {
    page: { ok: boolean; issues: Array<{ code: string; message: string }> };
    data: { ok: boolean; issues: Array<{ field?: string; code: string; message: string }> };
  };
  capture: { url: string; finalUrl: string; title: string; favicon?: string; status?: number; timingMs: number };
  manifest: Record<string, unknown>;
  repaired: boolean;
  dialogId?: number;
}

const SIDECAR = "http://127.0.0.1:47831";

const PROVIDERS: ProviderInfo[] = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1", docsUrl: "https://platform.openai.com/api-keys" },
  { id: "fireworks", label: "Fireworks AI", defaultModel: "accounts/fireworks/models/deepseek-v4-pro", baseUrl: "https://api.fireworks.ai/inference/v1", docsUrl: "https://fireworks.ai/account/api-keys" },
  { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com/v1", docsUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google Gemini", defaultModel: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", docsUrl: "https://aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", defaultModel: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1", docsUrl: "https://console.groq.com/keys" },
  { id: "together", label: "Together AI", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", baseUrl: "https://api.together.xyz/v1", docsUrl: "https://api.together.ai/settings/api-keys" },
  { id: "mistral", label: "Mistral AI", defaultModel: "mistral-large-latest", baseUrl: "https://api.mistral.ai/v1", docsUrl: "https://console.mistral.ai/api-keys" },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1", docsUrl: "https://platform.deepseek.com/api_keys" },
  { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini", baseUrl: "https://openrouter.ai/api/v1", docsUrl: "https://openrouter.ai/keys" },
  { id: "xai", label: "xAI (Grok)", defaultModel: "grok-3-mini", baseUrl: "https://api.x.ai/v1", docsUrl: "https://console.x.ai" },
  { id: "perplexity", label: "Perplexity", defaultModel: "sonar", baseUrl: "https://api.perplexity.ai", docsUrl: "https://www.perplexity.ai/settings/api" },
  { id: "cohere", label: "Cohere", defaultModel: "command-r-plus", baseUrl: "https://api.cohere.ai/v1", docsUrl: "https://dashboard.cohere.com/api-keys" },
  { id: "cerebras", label: "Cerebras", defaultModel: "llama-3.3-70b", baseUrl: "https://api.cerebras.ai/v1", docsUrl: "https://cloud.cerebras.ai" },
  { id: "sambanova", label: "SambaNova", defaultModel: "Meta-Llama-3.3-70B-Instruct", baseUrl: "https://api.sambanova.ai/v1", docsUrl: "https://cloud.sambanova.ai/apis" },
  { id: "novita", label: "Novita AI", defaultModel: "deepseek/deepseek-v3-0324", baseUrl: "https://api.novita.ai/v3/openai", docsUrl: "https://novita.ai/get-key" },
  { id: "hyperbolic", label: "Hyperbolic", defaultModel: "meta-llama/Meta-Llama-3.1-405B-Instruct", baseUrl: "https://api.hyperbolic.xyz/v1", docsUrl: "https://app.hyperbolic.xyz/settings" },
  { id: "lepton", label: "Lepton AI", defaultModel: "gpt-4o-mini", baseUrl: "https://api.lepton.ai/api/v1", docsUrl: "https://www.lepton.ai/dashboard" },
  { id: "ai21", label: "AI21 Labs", defaultModel: "jamba-1.5-large", baseUrl: "https://api.ai21.com/v1", docsUrl: "https://studio.ai21.com/account/api-key" },
  { id: "siliconflow", label: "SiliconFlow", defaultModel: "deepseek-ai/DeepSeek-V3", baseUrl: "https://api.siliconflow.cn/v1", docsUrl: "https://cloud.siliconflow.cn/account/ak" },
  { id: "openai-compatible", label: "Custom", defaultModel: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" }
];

type AppPhase = "splash" | "greeting" | "main";
type CenterState = "url-input" | "chat";

const STAGE_DEFS: Array<{ id: string; text: string }> = [
  { id: "capture", text: "Позвольте мне открыть страницу…" },
  { id: "page_reduction", text: "Изучаю структуру страницы…" },
  { id: "strategy", text: "Понял задачу. Определяю стратегию извлечения…" },
  { id: "manifest", text: "Составляю алгоритм извлечения…" },
  { id: "runner", text: "Применяю алгоритм…" },
  { id: "validation", text: "Проверяю результат…" },
  { id: "verify", text: "Формирую ответ…" }
];

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconForUrl(url: string): string {
  const domain = extractDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function App() {
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [shellVisible, setShellVisible] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [config, setConfig] = useState<OnboardingConfig | null>(null);

  const [centerState, setCenterState] = useState<CenterState>("url-input");
  const [chatUrl, setChatUrl] = useState("");
  const [chatDomain, setChatDomain] = useState("");
  const [chatFavicon, setChatFavicon] = useState<string | null>(null);
  const [rounds, setRounds] = useState<ChatRound[]>([]);
  const [anyLoading, setAnyLoading] = useState(false);
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null);

  const [dialogs, setDialogs] = useState<DialogInfo[]>([]);
  const [activeDialogId, setActiveDialogId] = useState<number | null>(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const splashDoneRef = useRef(false);

  const refreshDialogs = useCallback(() => {
    fetch(`${SIDECAR}/dialogs`)
      .then((r) => r.json())
      .then((data) => { if (data.dialogs) setDialogs(data.dialogs); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "splash") return;
    const timer = window.setTimeout(() => setShellVisible(true), 40);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!onboardingChecked) {
      fetch(`${SIDECAR}/settings`)
        .then((r) => r.json())
        .then((data) => {
          if (data.settings?.onboarding_complete === "true") {
            setConfig({
              provider: data.settings.provider ?? "fireworks",
              model: data.settings.model ?? "",
              baseUrl: data.settings.baseUrl ?? "",
              apiKey: window.localStorage.getItem("parsewright.apiKey") ?? "",
              useHeuristic: data.settings.use_heuristic === "true"
            });
          }
          setOnboardingChecked(true);
        })
        .catch(() => setOnboardingChecked(true));
    }
  }, [onboardingChecked]);

  useEffect(() => {
    if (onboardingChecked && splashDoneRef.current && phase === "splash") {
      setPhase(config ? "main" : "greeting");
    }
  }, [onboardingChecked, config, phase]);

  useEffect(() => {
    if (phase === "main" && config) {
      refreshDialogs();
    }
  }, [phase, config]);

  function handleSplashComplete() {
    splashDoneRef.current = true;
    if (onboardingChecked) {
      setPhase(config ? "main" : "greeting");
      if (config) refreshDialogs();
    }
  }

  async function handleOnboardingComplete(cfg: OnboardingConfig) {
    await saveConfig(cfg);
    setConfig(cfg);
    setPhase("main");
  }

  async function saveConfig(cfg: OnboardingConfig) {
    window.localStorage.setItem("parsewright.apiKey", cfg.apiKey);
    window.localStorage.setItem("parsewright.baseUrl", cfg.baseUrl);
    window.localStorage.setItem("parsewright.model", cfg.model);
    try {
      await fetch(`${SIDECAR}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: cfg.provider,
          model: cfg.model,
          baseUrl: cfg.baseUrl,
          use_heuristic: String(cfg.useHeuristic),
          onboarding_complete: "true"
        })
      });
    } catch {}
  }

  async function handleSettingsSave(cfg: OnboardingConfig) {
    await saveConfig(cfg);
    setConfig(cfg);
  }

  function handleNewDialog() {
    setCenterState("url-input");
    setChatUrl("");
    setChatDomain("");
    setChatFavicon(null);
    setRounds([]);
    setSidebarData(null);
    setActiveDialogId(null);
    setRightCollapsed(true);
  }

  function handleUrlSubmit(url: string) {
    const domain = extractDomain(url);
    setChatUrl(url);
    setChatDomain(domain);
    setChatFavicon(faviconForUrl(url));
    setRounds([]);
    setSidebarData(null);
    setCenterState("chat");
    setRightCollapsed(false);
  }

  function updateRound(roundId: string, patch: Partial<ChatRound>) {
    setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, ...patch } : r));
  }

  async function handleGoalSubmit(goal: string) {
    if (!config || anyLoading) return;

    const roundId = `round-${Date.now()}`;

    const initialStages = STAGE_DEFS.map((s) => ({ ...s, status: "typing" as const }));

    setRounds((prev) => [...prev, {
      id: roundId,
      goal,
      stages: initialStages,
      result: null,
      error: null,
      loading: true
    }]);
    setAnyLoading(true);

    const api = window.go?.main?.App;
    const apiPromise = api ? api.Extract({
      url: chatUrl,
      goal,
      provider: config.useHeuristic ? "heuristic" : config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      maxItems: 100,
      mode: "auto"
    }) : Promise.reject(new Error("Wails bridge is not available."));

    for (let i = 0; i < STAGE_DEFS.length; i++) {
      const stage = STAGE_DEFS[i];
      await sleep(stage.text.length * 22 + 250);
      setRounds((prev) => prev.map((r) =>
        r.id === roundId
          ? { ...r, stages: r.stages.map((s, idx) => idx <= i ? { ...s, status: "done" as const } : s) }
          : r
      ));
    }

    try {
      const response = await apiPromise;

      const chatResult: ChatResult = {
        answer: response.answer,
        strategy: response.strategy,
        data: response.data,
        table: response.table,
        verification: response.verification,
        repaired: response.repaired,
        dialogId: response.dialogId
      };

      updateRound(roundId, {
        result: chatResult,
        loading: false,
        stages: STAGE_DEFS.map((s) => ({ ...s, status: "done" as const }))
      });

      setSidebarData({
        capture: response.capture,
        manifest: response.manifest,
        strategy: response.strategy,
        validation: response.validation,
        verification: response.verification,
        repaired: response.repaired
      });

      if (response.capture?.favicon) {
        setChatFavicon(response.capture.favicon);
      }

      if (response.dialogId) {
        setActiveDialogId(response.dialogId);
        refreshDialogs();
      }
    } catch (err) {
      try {
        await fetch(`${SIDECAR}/dialogs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: goal.slice(0, 60),
            url: chatUrl,
            domain: chatDomain,
            faviconUrl: chatFavicon ?? faviconForUrl(chatUrl),
            goal
          })
        });
        refreshDialogs();
      } catch {}

      updateRound(roundId, {
        error: err instanceof Error ? err.message : String(err),
        loading: false,
        stages: STAGE_DEFS.map((s) => ({ ...s, status: "done" as const }))
      });
    } finally {
      setAnyLoading(false);
    }
  }

  function handleSelectDialog(id: number) {
    setActiveDialogId(id);
    const dialog = dialogs.find((d) => d.id === id);
    if (dialog) {
      setChatUrl(dialog.url);
      setChatDomain(dialog.domain);
      setChatFavicon(dialog.favicon_url);
      setSidebarData(null);
      setRounds(dialog.answer ? [{
        id: `dialog-${dialog.id}`,
        goal: dialog.goal,
        stages: [],
        result: {
          answer: dialog.answer,
          strategy: { kind: "fields" },
          data: {},
          table: [],
          verification: { answersGoal: true, issues: [] },
          repaired: false,
          dialogId: dialog.id
        },
        error: null,
        loading: false
      }] : [{
        id: `dialog-${dialog.id}`,
        goal: dialog.goal,
        stages: [],
        result: null,
        error: null,
        loading: false
      }]);
      setCenterState("chat");
      setRightCollapsed(false);
    }
  }

  function handleDeleteDialog(id: number) {
    fetch(`${SIDECAR}/dialogs/${id}`, { method: "DELETE" })
      .then(() => {
        setDialogs((prev) => prev.filter((d) => d.id !== id));
        if (activeDialogId === id) handleNewDialog();
      })
      .catch(() => {});
  }

  const providerLabel = config
    ? config.useHeuristic
      ? "Heuristic"
      : PROVIDERS.find((p) => p.id === config.provider)?.label ?? config.provider
    : "";
  const modelName = config
    ? config.useHeuristic
      ? "Без API ключа"
      : config.model || PROVIDERS.find((p) => p.id === config.provider)?.defaultModel || ""
    : "";

  return (
    <div className="app-root">
      <div className={shellVisible ? "app-root__shell app-root__shell--visible" : "app-root__shell"}>
        {phase === "main" && config ? (
          <div className="app-layout">
            <Sidebar
              dialogs={dialogs}
              activeDialogId={activeDialogId}
              collapsed={leftCollapsed}
              onSelectDialog={handleSelectDialog}
              onDeleteDialog={handleDeleteDialog}
              onNewDialog={handleNewDialog}
              modelName={modelName}
              providerLabel={providerLabel}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <button
              className={`sidebar-toggle sidebar-toggle--left ${leftCollapsed ? "sidebar-toggle--show" : ""}`}
              onClick={() => setLeftCollapsed((v) => !v)}
              aria-label={leftCollapsed ? "Показать панель" : "Скрыть панель"}
            >
              {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>

            <main className="app-center">
              {centerState === "url-input" ? (
                <UrlInput onSubmit={handleUrlSubmit} />
              ) : (
                <ChatFeed
                  url={chatUrl}
                  domain={chatDomain}
                  faviconUrl={chatFavicon}
                  rounds={rounds}
                  anyLoading={anyLoading}
                  onGoalSubmit={handleGoalSubmit}
                />
              )}
            </main>

            <button
              className={`sidebar-toggle sidebar-toggle--right ${rightCollapsed ? "sidebar-toggle--show" : ""}`}
              onClick={() => setRightCollapsed((v) => !v)}
              aria-label={rightCollapsed ? "Показать панель" : "Скрыть панель"}
            >
              {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
            <RightSidebar collapsed={rightCollapsed} data={sidebarData} />
          </div>
        ) : null}
      </div>

      {phase === "splash" ? (
        <LaunchSplash key="splash" onComplete={handleSplashComplete} />
      ) : null}

      {phase === "greeting" ? (
        <Onboarding providers={PROVIDERS} onComplete={handleOnboardingComplete} />
      ) : null}

      {settingsOpen && config ? (
        <SettingsModal
          providers={PROVIDERS}
          config={config}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
        />
      ) : null}
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

createRoot(document.getElementById("root")!).render(<App />);
