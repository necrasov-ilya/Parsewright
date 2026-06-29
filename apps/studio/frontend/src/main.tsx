import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { LaunchSplash } from "./components/LaunchSplash";
import { Onboarding, type OnboardingConfig, type ProviderInfo } from "./components/Onboarding";
import { Sidebar, type DialogInfo } from "./components/Sidebar";
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
  strategy: {
    kind: "fields" | "collection" | "summary";
    fields?: string[];
    ranking?: { objective: string; topK: number };
  };
  table: Array<Record<string, unknown>>;
  bestItem?: Record<string, unknown>;
  verification: {
    answersGoal: boolean;
    answer: string;
    title: string;
    issues: string[];
  };
  validation: {
    page: { ok: boolean; issues: Array<{ code: string; message: string }> };
    data: { ok: boolean; issues: Array<{ field?: string; code: string; message: string }> };
  };
  capture: {
    url: string;
    finalUrl: string;
    status?: number;
    title: string;
    favicon?: string;
    timingMs: number;
  };
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

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function App() {
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [shellVisible, setShellVisible] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [dialogs, setDialogs] = useState<DialogInfo[]>([]);
  const [activeDialogId, setActiveDialogId] = useState<number | null>(null);
  const [currentResult, setCurrentResult] = useState<ExtractResult | null>(null);
  const splashDoneRef = useRef(false);

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
      if (config) {
        setPhase("main");
        refreshDialogs();
      } else {
        setPhase("greeting");
      }
    }
  }, [onboardingChecked, config, phase]);

  const refreshDialogs = useCallback(() => {
    fetch(`${SIDECAR}/dialogs`)
      .then((r) => r.json())
      .then((data) => { if (data.dialogs) setDialogs(data.dialogs); })
      .catch(() => {});
  }, []);

  const resetApp = useCallback(async () => {
    setResetting(true);
    setShellVisible(false);
    setPhase("splash");
    setSessionKey((key) => key + 1);
    setConfig(null);
    setDialogs([]);
    setActiveDialogId(null);
    setCurrentResult(null);
    splashDoneRef.current = false;
    window.localStorage.removeItem("parsewright.apiKey");
    window.localStorage.removeItem("parsewright.baseUrl");
    window.localStorage.removeItem("parsewright.model");
    try { await window.go?.main?.App?.Reset(); } catch {}
    setResetting(false);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key === "R") {
        event.preventDefault();
        event.stopPropagation();
        resetApp();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [resetApp]);

  function handleSplashComplete() {
    splashDoneRef.current = true;
    if (onboardingChecked) {
      if (config) {
        setPhase("main");
        refreshDialogs();
      } else {
        setPhase("greeting");
      }
    }
  }

  async function handleOnboardingComplete(cfg: OnboardingConfig) {
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
    setConfig(cfg);
    setPhase("main");
  }

  function handleSelectDialog(id: number) {
    setActiveDialogId(id);
    const dialog = dialogs.find((d) => d.id === id);
    if (dialog?.answer) {
      setCurrentResult({
        answer: dialog.answer,
        data: {},
        strategy: { kind: "fields" },
        table: [],
        verification: { answersGoal: true, answer: dialog.answer, title: dialog.title, issues: [] },
        validation: { page: { ok: true, issues: [] }, data: { ok: true, issues: [] } },
        capture: { url: dialog.url, finalUrl: dialog.url, title: dialog.title, timingMs: 0 },
        manifest: {},
        repaired: false,
        dialogId: id
      });
    }
  }

  function handleDeleteDialog(id: number) {
    fetch(`${SIDECAR}/dialogs/${id}`, { method: "DELETE" })
      .then(() => {
        setDialogs((prev) => prev.filter((d) => d.id !== id));
        if (activeDialogId === id) {
          setActiveDialogId(null);
          setCurrentResult(null);
        }
      })
      .catch(() => {});
  }

  function handleExtractComplete(result: ExtractResult) {
    setCurrentResult(result);
    if (result.dialogId) {
      setActiveDialogId(result.dialogId);
      refreshDialogs();
    }
  }

  return (
    <div className="app-root">
      <div className={shellVisible ? "app-root__shell app-root__shell--visible" : "app-root__shell"}>
        {phase === "main" && config ? (
          <MainLayout
            key={sessionKey}
            config={config}
            dialogs={dialogs}
            activeDialogId={activeDialogId}
            onSelectDialog={handleSelectDialog}
            onDeleteDialog={handleDeleteDialog}
            onExtractComplete={handleExtractComplete}
          />
        ) : null}
      </div>

      {phase === "splash" || resetting ? (
        <LaunchSplash key={sessionKey} onComplete={handleSplashComplete} />
      ) : null}

      {phase === "greeting" && !resetting ? (
        <Onboarding providers={PROVIDERS} onComplete={handleOnboardingComplete} />
      ) : null}
    </div>
  );
}

function MainLayout({ config, dialogs, activeDialogId, onSelectDialog, onDeleteDialog, onExtractComplete }: {
  config: OnboardingConfig;
  dialogs: DialogInfo[];
  activeDialogId: number | null;
  onSelectDialog: (id: number) => void;
  onDeleteDialog: (id: number) => void;
  onExtractComplete: (result: ExtractResult) => void;
}) {
  return (
    <div className="main-layout">
      <Sidebar
        dialogs={dialogs}
        activeDialogId={activeDialogId}
        onSelectDialog={onSelectDialog}
        onDeleteDialog={onDeleteDialog}
      />
      <MainContent config={config} onExtractComplete={onExtractComplete} activeDialogId={activeDialogId} dialogs={dialogs} />
    </div>
  );
}

function MainContent({ config, onExtractComplete, activeDialogId, dialogs }: {
  config: OnboardingConfig;
  onExtractComplete: (result: ExtractResult) => void;
  activeDialogId: number | null;
  dialogs: DialogInfo[];
}) {
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [status, setStatus] = useState<string>("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const urlValid = isValidUrl(url);
  const showUrlError = urlTouched && url.length > 0 && !urlValid;
  const canSubmit = urlValid && goal.trim().length > 0 && !loading;

  useEffect(() => {
    if (activeDialogId) {
      const dialog = dialogs.find((d) => d.id === activeDialogId);
      if (dialog) {
        setResult({
          answer: dialog.answer ?? "",
          data: {},
          strategy: { kind: "fields" },
          table: [],
          verification: { answersGoal: true, answer: dialog.answer ?? "", title: dialog.title, issues: [] },
          validation: { page: { ok: true, issues: [] }, data: { ok: true, issues: [] } },
          capture: { url: dialog.url, finalUrl: dialog.url, title: dialog.title, timingMs: 0 },
          manifest: {},
          repaired: false,
          dialogId: dialog.id
        });
      }
    } else {
      setResult(null);
    }
  }, [activeDialogId, dialogs]);

  async function extract() {
    if (!canSubmit) return;
    setUrlTouched(true);
    if (!urlValid) return;

    setCreating(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus("capture");

    try {
      const api = window.go?.main?.App;
      if (!api) throw new Error("Wails bridge is not available.");

      setStatus("analyzing");
      const response = await api.Extract({
        url,
        goal,
        provider: config.useHeuristic ? "heuristic" : config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        maxItems: 2000,
        mode: "auto"
      });

      setStatus("answer");
      setResult(response);
      onExtractComplete(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setCreating(false);
      window.setTimeout(() => setStatus(""), 1000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && canSubmit) {
      e.preventDefault();
      extract();
    }
  }

  return (
    <main className="main-content">
      {!result && !loading ? (
        <div className="main-content__welcome">
          <Sparkles size={32} className="main-content__welcome-icon" />
          <h2 className="main-content__welcome-title">Что нужно со страницы?</h2>
          <p className="main-content__welcome-subtitle">Вставьте ссылку и опишите, что хотите извлечь</p>
        </div>
      ) : null}

      {loading ? (
        <div className="main-content__loading">
          <Loader2 size={28} className="main-content__spinner" />
          <p className="main-content__status">
            {status === "capture" ? "Открываю страницу..." :
             status === "analyzing" ? "Анализирую содержимое..." :
             "Формирую ответ..."}
          </p>
        </div>
      ) : null}

      {error ? <div className="main-content__error">{error}</div> : null}

      {result && !loading ? <ResultView result={result} /> : null}

      <div className="input-bar">
        <div className="input-bar__url">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlTouched(true); }}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            className={`input-bar__input ${showUrlError ? "input-bar__input--error" : ""}`}
            disabled={loading}
          />
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Что нужно извлечь?"
          className="input-bar__goal"
          disabled={loading}
          rows={1}
        />
        <button
          className="input-bar__submit"
          onClick={extract}
          disabled={!canSubmit}
        >
          {loading ? <Loader2 size={18} className="main-content__spinner" /> : <ArrowUp size={18} />}
        </button>
      </div>
      {showUrlError ? <p className="input-bar__url-error">Введите корректную ссылку (http:// или https://)</p> : null}
    </main>
  );
}

function ResultView({ result }: { result: ExtractResult }) {
  const kind = result.strategy.kind;

  return (
    <div className={`result-view ${result.dialogId ? "result-view--animate" : ""}`}>
      {result.repaired ? <p className="result-view__repaired">Сайт изменился — алгоритм обновлён.</p> : null}
      {!result.verification.answersGoal ? (
        <p className="result-view__warning">{result.verification.issues.join(" ") || "Данные могут не полностью отвечать на запрос."}</p>
      ) : null}

      <div className="result-view__answer">
        <p className="result-view__answer-text">{result.answer}</p>
      </div>

      {kind === "fields" ? <FieldsTable data={result.data} /> : null}
      {kind === "collection" && result.table.length > 0 ? <CollectionTable table={result.table} /> : null}
      {kind === "summary" ? <SummaryView data={result.data} /> : null}

      <details className="result-view__details">
        <summary>Диагностика</summary>
        <pre>{JSON.stringify({ strategy: result.strategy, validation: result.validation, capture: result.capture }, null, 2)}</pre>
      </details>
    </div>
  );
}

function FieldsTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <p className="result-view__warning">Не удалось извлечь поля.</p>;
  return (
    <div className="result-view__table-wrap">
      <table>
        <thead><tr><th>Поле</th><th>Значение</th></tr></thead>
        <tbody>
          {entries.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{Array.isArray(v) ? `${v.length} items` : String(v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function CollectionTable({ table }: { table: Array<Record<string, unknown>> }) {
  if (table.length === 0) return <p className="result-view__warning">Не найдено элементов.</p>;
  const columns = Object.keys(table[0]).filter((k) => k !== "raw");
  return (
    <div className="result-view__table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.slice(0, 50).map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{c === "url" && typeof row[c] === "string" ? <a href={String(row[c])}>{String(row[c])}</a> : formatCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="result-view__table-wrap">
      <table>
        <thead><tr><th>Ключ</th><th>Значение</th></tr></thead>
        <tbody>
          {entries.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{Array.isArray(v) ? `${v.length} items` : String(v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}

createRoot(document.getElementById("root")!).render(<App />);
