import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime";
import { LaunchSplash } from "./components/LaunchSplash";
import { Onboarding, type OnboardingConfig, type ProviderInfo } from "./components/Onboarding";
import { Sidebar, type DialogInfo } from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import { UrlInput } from "./components/UrlInput";
import { ChatFeed, type ChatRound, type ChatResult, type AgentEvent } from "./components/ChatFeed";
import { RightSidebar, type SidebarData } from "./components/RightSidebar";
import { CodeGenDialog, type CodeGenParams } from "./components/CodeGenDialog";
import "./styles.css";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          Extract(input: ExtractInput): Promise<ExtractResult>;
          GenerateCode(input: CodeGenInput): Promise<Record<string, unknown>>;
          Reset(): Promise<{ ok: boolean }>;
        };
      };
    };
  }
}

interface ExtractInput {
  url: string;
  goal: string;
  dialogId?: number;
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
  usage?: { promptTokens: number; completionTokens: number };
  dialogId?: number;
}

interface CodeGenInput {
  manifest: Record<string, unknown>;
  language: string;
  includeDocs: boolean;
  extraRequirements: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  heuristic: boolean;
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

interface ConversationState {
  url: string;
  domain: string;
  favicon: string | null;
  rounds: ChatRound[];
  sidebarData: SidebarData | null;
}

function extractDomain(url: string): string {
  try { const u = new URL(url); return u.hostname.replace(/^www\./, ""); } catch { return url; }
}

function faviconForUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=32`;
}

function resultToSidebarData(response: Pick<ExtractResult, "capture" | "manifest" | "strategy" | "validation" | "verification" | "repaired">): SidebarData {
  return {
    capture: response.capture,
    manifest: response.manifest,
    strategy: response.strategy,
    validation: response.validation,
    verification: response.verification,
    repaired: response.repaired
  };
}

function conversationFromDialog(dialog: DialogInfo): ConversationState {
  const parsed = parseDialogResult(dialog);
  const result = parsed ? resultToChatResult(parsed, dialog.id) : null;
  return {
    url: dialog.url,
    domain: dialog.domain,
    favicon: dialog.favicon_url ?? faviconForUrl(dialog.url),
    sidebarData: parsed ? resultToSidebarData(parsed) : null,
    rounds: [{
      id: `dialog-${dialog.id}`,
      goal: dialog.goal,
      events: [],
      result,
      error: null,
      loading: false,
      usage: parsed?.usage
    }]
  };
}

function parseDialogResult(dialog: DialogInfo): ExtractResult | null {
  if (!dialog.result_json) return null;
  try { return JSON.parse(dialog.result_json) as ExtractResult; } catch { return null; }
}

function resultToChatResult(result: ExtractResult, dialogId: number): ChatResult {
  return {
    answer: result.answer,
    strategy: result.strategy,
    data: result.data,
    table: result.table,
    verification: result.verification,
    repaired: result.repaired,
    manifest: result.manifest,
    usage: result.usage,
    dialogId
  };
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
  const [conversations, setConversations] = useState<Record<number, ConversationState>>({});

  const [dialogs, setDialogs] = useState<DialogInfo[]>([]);
  const [activeDialogId, setActiveDialogId] = useState<number | null>(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [codegenOpen, setCodegenOpen] = useState(false);
  const [codegenManifest, setCodegenManifest] = useState<Record<string, unknown> | null>(null);
  const [codegenChunks, setCodegenChunks] = useState<string[]>([]);
  const [codegenDone, setCodegenDone] = useState(false);
  const [codegenError, setCodegenError] = useState<string | null>(null);

  const splashDoneRef = useRef(false);
  const cancelledRoundsRef = useRef<Set<string>>(new Set());
  const activeRoundRef = useRef<{ dialogId: number; roundId: string } | null>(null);

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
    if (phase === "main" && config) refreshDialogs();
  }, [phase, config, refreshDialogs]);

  useEffect(() => {
    function handleExtractEvent(event: Record<string, unknown>) {
      try {
        const stage = event.stage as string;
        const status = event.status as string;
        const active = activeRoundRef.current;
        if (!active) return;

        const eventId = `${stage}-${status}-${Date.now()}`;
        const tool = event.tool as string | undefined;
        const toolLabel = event.toolLabel as string | undefined;
        const thinking = event.thinking as string | undefined;
        const data = event.data;
        const usage = event.usage as { promptTokens: number; completionTokens: number } | undefined;

        if (stage === "done" && status === "done" && data) {
          const rawResult = data as Record<string, unknown>;
          if (typeof rawResult.answer !== "string") return;
          const result = data as ExtractResult;
          const chatResult: ChatResult = {
            answer: result.answer ?? "",
            strategy: result.strategy ?? { kind: "fields" },
            data: result.data ?? {},
            table: result.table ?? [],
            verification: result.verification ?? { answersGoal: false, issues: [] },
            repaired: result.repaired ?? false,
            manifest: result.manifest,
            usage: result.usage,
            dialogId: result.dialogId
          };
          updateRound(active.dialogId, active.roundId, {
            result: chatResult,
            loading: false,
            usage: result.usage
          });
          updateConversation(active.dialogId, (state) => ({
            ...state,
            favicon: result.capture?.favicon ?? state.favicon,
            sidebarData: resultToSidebarData(result)
          }));
          if (result.capture?.favicon) setChatFavicon(result.capture.favicon);
          if (result.dialogId) { setActiveDialogId(result.dialogId); refreshDialogs(); }
          activeRoundRef.current = null;
          return;
        }

        if (stage === "error" || status === "error") {
          const errMsg = (data as { error?: string })?.error ?? "extraction failed";
          updateRound(active.dialogId, active.roundId, {
            error: errMsg,
            loading: false
          });
          activeRoundRef.current = null;
          return;
        }

        if (status === "start" && thinking) {
          const newEvent: AgentEvent = {
            id: `${stage}-thinking-${Date.now()}`,
            type: "thinking",
            stage,
            thinking,
          };
          updateRound(active.dialogId, active.roundId, (prev) => ({
            events: [...(prev.events ?? []), newEvent]
          }));
        }

        if (status === "start" && tool) {
          const newEvent: AgentEvent = {
            id: `${stage}-tool-${Date.now()}`,
            type: "tool_call",
            stage,
            tool: { name: tool, label: toolLabel ?? tool, status: "running" },
          };
          updateRound(active.dialogId, active.roundId, (prev) => ({
            events: [...(prev.events ?? []), newEvent]
          }));
        }

        if (status === "done" && tool) {
          updateRound(active.dialogId, active.roundId, (prev) => ({
            events: (prev.events ?? []).map((ev) => {
              if (ev.stage === stage && ev.type === "tool_call") {
                return {
                  ...ev,
                  tool: ev.tool ? { ...ev.tool, status: "done" as const } : ev.tool,
                  toolData: data,
                  usage,
                };
              }
              return ev;
            })
          }));
        }
      } catch (err) {
        console.error("extract event handler error:", err);
      }
    }

    function handleCodeGenEvent(event: Record<string, unknown>) {
      try {
        const type = event.type as string;
        if (type === "chunk") {
          setCodegenChunks((prev) => [...prev, event.text as string]);
        } else if (type === "done") {
          setCodegenDone(true);
        } else if (type === "error") {
          setCodegenError(event.error as string);
        }
      } catch (err) {
        console.error("codegen event handler error:", err);
      }
    }

    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).runtime) {
      EventsOn("extract:event", handleExtractEvent);
      EventsOn("codegen:event", handleCodeGenEvent);
    }

    return () => {
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).runtime) {
        EventsOff("extract:event");
        EventsOff("codegen:event");
      }
    };
  }, []);

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
        body: JSON.stringify({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, use_heuristic: String(cfg.useHeuristic), onboarding_complete: "true" })
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
    setActiveDialogId(null);
    setRightCollapsed(true);
  }

  function handleUrlSubmit(url: string) {
    setChatUrl(url);
    setChatDomain(extractDomain(url));
    setChatFavicon(faviconForUrl(url));
    setCenterState("chat");
    setRightCollapsed(false);
  }

  function updateConversation(dialogId: number, updater: (state: ConversationState) => ConversationState) {
    setConversations((prev) => {
      const current = prev[dialogId];
      if (!current) return prev;
      return { ...prev, [dialogId]: updater(current) };
    });
  }

  function updateRound(dialogId: number, roundId: string, patch: Partial<ChatRound> | ((prev: ChatRound) => Partial<ChatRound>)) {
    updateConversation(dialogId, (state) => ({
      ...state,
      rounds: state.rounds.map((r) => {
        if (r.id !== roundId) return r;
        const patchObj = typeof patch === "function" ? patch(r) : patch;
        return { ...r, ...patchObj };
      })
    }));
  }

  async function handleGoalSubmit(goal: string) {
    if (!config) return;
    const currentConversation = activeDialogId ? conversations[activeDialogId] : null;
    if (currentConversation?.rounds.some((round) => round.loading)) return;

    const url = currentConversation?.url ?? chatUrl;
    const domain = currentConversation?.domain ?? chatDomain;
    const favicon = currentConversation?.favicon ?? chatFavicon ?? faviconForUrl(url);
    if (!url || !domain) return;

    const roundId = `round-${Date.now()}`;
    const newRound: ChatRound = { id: roundId, goal, events: [], result: null, error: null, loading: true };

    let dialogId = activeDialogId ?? 0;
    if (!dialogId) {
      try {
        const response = await fetch(`${SIDECAR}/dialogs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: goal.slice(0, 60), url, domain, faviconUrl: favicon, goal })
        });
        const data = await response.json();
        dialogId = Number(data.id);
        if (!dialogId) throw new Error("Dialog was not created.");
        setActiveDialogId(dialogId);
        refreshDialogs();
      } catch {
        dialogId = Date.now() * -1;
        setActiveDialogId(dialogId);
      }
    }

    setConversations((prev) => {
      const existing = prev[dialogId];
      return { ...prev, [dialogId]: { url, domain, favicon, sidebarData: existing?.sidebarData ?? null, rounds: [...(existing?.rounds ?? []), newRound] } };
    });

    activeRoundRef.current = { dialogId, roundId };

    try {
      const api = window.go?.main?.App;
      if (!api) throw new Error("Wails bridge is not available.");
      await api.Extract({
        url, goal,
        dialogId: dialogId > 0 ? dialogId : undefined,
        provider: config.useHeuristic ? "heuristic" : config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        maxItems: 100,
        mode: "auto"
      });
    } catch (err) {
      if (cancelledRoundsRef.current.has(roundId)) return;
      updateRound(dialogId, roundId, { error: err instanceof Error ? err.message : String(err), loading: false });
      activeRoundRef.current = null;
    }
  }

  function handleCancelActiveRound() {
    const active = activeRoundRef.current;
    if (!active) return;
    cancelledRoundsRef.current.add(active.roundId);
    updateRound(active.dialogId, active.roundId, { loading: false, error: "Отменено" });
    activeRoundRef.current = null;
  }

  function handleSelectDialog(id: number) {
    setActiveDialogId(id);
    const dialog = dialogs.find((d) => d.id === id);
    if (dialog) {
      setConversations((prev) => prev[id] ? prev : { ...prev, [id]: conversationFromDialog(dialog) });
      setCenterState("chat");
      setRightCollapsed(false);
    }
  }

  function handleDeleteDialog(id: number) {
    fetch(`${SIDECAR}/dialogs/${id}`, { method: "DELETE" })
      .then(() => {
        setDialogs((prev) => prev.filter((d) => d.id !== id));
        setConversations((prev) => { const next = { ...prev }; delete next[id]; return next; });
        if (activeDialogId === id) handleNewDialog();
      })
      .catch(() => {});
  }

  function handleGenerateCode(manifest: Record<string, unknown>, _roundId: string) {
    setCodegenManifest(manifest);
    setCodegenChunks([]);
    setCodegenDone(false);
    setCodegenError(null);
    setCodegenOpen(true);
  }

  async function handleCodegenStart(params: CodeGenParams) {
    if (!config || !codegenManifest) return;
    setCodegenChunks([]);
    setCodegenDone(false);
    setCodegenError(null);

    try {
      const api = window.go?.main?.App;
      if (!api) throw new Error("Wails bridge is not available.");
      await api.GenerateCode({
        manifest: codegenManifest,
        language: params.language,
        includeDocs: params.includeDocs,
        extraRequirements: params.extraRequirements,
        provider: config.useHeuristic ? "heuristic" : config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        heuristic: config.useHeuristic
      });
    } catch (err) {
      setCodegenError(err instanceof Error ? err.message : String(err));
    }
  }

  const providerLabel = config
    ? config.useHeuristic ? "Heuristic" : PROVIDERS.find((p) => p.id === config.provider)?.label ?? config.provider : "";
  const modelName = config
    ? config.useHeuristic ? "Без API ключа" : config.model || PROVIDERS.find((p) => p.id === config.provider)?.defaultModel || "" : "";

  const activeConversation = activeDialogId ? conversations[activeDialogId] : null;
  const currentUrl = activeConversation?.url ?? chatUrl;
  const currentDomain = activeConversation?.domain ?? chatDomain;
  const currentFavicon = activeConversation?.favicon ?? chatFavicon;
  const currentRounds = activeConversation?.rounds ?? [];
  const currentLoading = currentRounds.some((round) => round.loading);
  const currentSidebarData = activeConversation?.sidebarData ?? null;

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
                  url={currentUrl}
                  domain={currentDomain}
                  faviconUrl={currentFavicon}
                  rounds={currentRounds}
                  anyLoading={currentLoading}
                  onGoalSubmit={handleGoalSubmit}
                  onCancel={handleCancelActiveRound}
                  onGenerateCode={handleGenerateCode}
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
            <RightSidebar collapsed={rightCollapsed} data={currentSidebarData} />
          </div>
        ) : null}
      </div>

      {phase === "splash" ? <LaunchSplash key="splash" onComplete={handleSplashComplete} /> : null}
      {phase === "greeting" ? <Onboarding providers={PROVIDERS} onComplete={handleOnboardingComplete} /> : null}

      {settingsOpen && config ? (
        <SettingsModal providers={PROVIDERS} config={config} onClose={() => setSettingsOpen(false)} onSave={handleSettingsSave} />
      ) : null}

      <CodeGenDialog
        open={codegenOpen}
        manifest={codegenManifest}
        config={config}
        onClose={() => setCodegenOpen(false)}
        onGenerate={handleCodegenStart}
        codeChunks={codegenChunks}
        codeDone={codegenDone}
        codeError={codegenError}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
