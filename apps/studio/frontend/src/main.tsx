import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import parsewrightLogo from "./assets/parsewright-logo-mark.svg";
import { LaunchSplash } from "./components/LaunchSplash";
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
}

function ExtractionShell() {
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [baseUrl, setBaseUrl] = useState(() => window.localStorage.getItem("parsewright.baseUrl") ?? "");
  const [model, setModel] = useState(() => window.localStorage.getItem("parsewright.model") ?? "");
  const [apiKey, setApiKey] = useState(() => window.localStorage.getItem("parsewright.apiKey") ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function extract() {
    setLoading(true);
    setError(null);
    setStatus("capture");
    try {
      const api = window.go?.main?.App;
      if (!api) throw new Error("Wails bridge is not available. Run through Wails, or use the CLI for now.");
      window.localStorage.setItem("parsewright.baseUrl", baseUrl);
      window.localStorage.setItem("parsewright.model", model);
      window.localStorage.setItem("parsewright.apiKey", apiKey);
      setStatus("analyze");
      const response = await api.Extract({ url, goal, provider: "openai-compatible", baseUrl, model, apiKey, maxItems: 2000, mode: "auto" });
      setResult(response);
      setStatus("answer");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      window.setTimeout(() => setStatus(null), 900);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">
          <img className="mark" src={parsewrightLogo} alt="" aria-hidden="true" />
          <h1>Parsewright</h1>
        </div>
        <p>Turn a website request into data and a reusable parser artifact.</p>
      </section>

      <section className="panel">
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/product" />
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="title, price, availability" />
        <div className="actions">
          <button className="ghost-button" onClick={() => setShowSettings((value) => !value)} type="button">
            Model
          </button>
          <div className="action-right">
            {status ? <span className="status">{status}</span> : null}
            <button onClick={extract} disabled={loading || !url || !goal}>
              {loading ? "Extracting..." : "Start"}
            </button>
          </div>
        </div>
        {showSettings ? (
          <div className="settings">
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="OpenAI-compatible base URL" />
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="model" />
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API key" type="password" />
          </div>
        ) : null}
      </section>

      {error ? <pre className="error">{error}</pre> : null}
      {result ? <ResultView result={result} /> : null}
    </main>
  );
}

function ResultView({ result }: { result: ExtractResult }) {
  const kind = result.strategy.kind;

  return (
    <section className="result-card">
      {result.repaired ? <p className="warning">The site changed, so the algorithm was updated automatically.</p> : null}
      {!result.verification.answersGoal ? (
        <p className="warning">{result.verification.issues.join(" ") || "The extracted data may not fully answer your request."}</p>
      ) : null}

      <p className="answer">{result.answer}</p>

      {kind === "fields" ? <FieldsTable data={result.data} /> : null}
      {kind === "collection" && result.table.length > 0 ? <CollectionTable table={result.table} /> : null}
      {kind === "summary" ? <SummaryView data={result.data} /> : null}

      <details>
        <summary>Diagnostics</summary>
        <pre>{JSON.stringify({ strategy: result.strategy, validation: result.validation, capture: result.capture }, null, 2)}</pre>
      </details>
    </section>
  );
}

function FieldsTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return <p className="warning">No fields were extracted.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], index) => (
            <tr key={index}>
              <td>{key}</td>
              <td>{Array.isArray(value) ? `${value.length} items` : String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionTable({ table }: { table: Array<Record<string, unknown>> }) {
  if (table.length === 0) return <p className="warning">No items were found.</p>;
  const columns = Object.keys(table[0]).filter((key) => key !== "raw");

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.slice(0, 50).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>
                  {column === "url" && typeof row[column] === "string" ? (
                    <a href={String(row[column])}>{String(row[column])}</a>
                  ) : column === "title" && typeof row[column] === "string" ? (
                    String(row[column])
                  ) : (
                    formatCell(row[column])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (entries.length === 0) return null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], index) => (
            <tr key={index}>
              <td>{key}</td>
              <td>{Array.isArray(value) ? `${value.length} items` : String(value)}</td>
            </tr>
          ))}
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

function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [shellVisible, setShellVisible] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!introComplete) return;
    const timer = window.setTimeout(() => setShellVisible(true), 40);
    return () => window.clearTimeout(timer);
  }, [introComplete]);

  const resetApp = useCallback(async () => {
    setResetting(true);
    setShellVisible(false);
    setIntroComplete(false);
    setSessionKey((key) => key + 1);
    window.localStorage.removeItem("parsewright.baseUrl");
    window.localStorage.removeItem("parsewright.model");
    window.localStorage.removeItem("parsewright.apiKey");
    try {
      await window.go?.main?.App?.Reset();
    } catch {
      // Sidecar restart failure is non-fatal — ensureSidecar will retry on next extract.
    }
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

  return (
    <div className="app-root">
      <div className={shellVisible ? "app-root__shell app-root__shell--visible" : "app-root__shell"}>
        <ExtractionShell key={sessionKey} />
      </div>
      {introComplete && !resetting ? null : <LaunchSplash onComplete={() => setIntroComplete(true)} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
