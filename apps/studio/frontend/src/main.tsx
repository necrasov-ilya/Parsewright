import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import parsewrightLogo from "./assets/parsewright-logo-mark.svg";
import { LaunchSplash } from "./components/LaunchSplash";
import "./styles.css";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          Extract(input: { url: string; goal: string; heuristic: boolean }): Promise<unknown>;
        };
      };
    };
  }
}

function ExtractionShell() {
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [heuristic, setHeuristic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setLoading(true);
    setError(null);
    try {
      const api = window.go?.main?.App;
      if (!api) throw new Error("Wails bridge is not available. Run through Wails, or use the CLI for now.");
      setResult(await api.Extract({ url, goal, heuristic }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
          <label>
            <input type="checkbox" checked={heuristic} onChange={(event) => setHeuristic(event.target.checked)} />
            heuristic smoke mode
          </label>
          <button onClick={extract} disabled={loading || !url || !goal}>
            {loading ? "Extracting..." : "Start"}
          </button>
        </div>
      </section>

      {error ? <pre className="error">{error}</pre> : null}
      {result ? <pre className="result">{JSON.stringify(result, null, 2)}</pre> : null}
    </main>
  );
}

function App() {
  const [introComplete, setIntroComplete] = useState(false);
  const [shellVisible, setShellVisible] = useState(false);

  useEffect(() => {
    if (!introComplete) return;
    const timer = window.setTimeout(() => setShellVisible(true), 40);
    return () => window.clearTimeout(timer);
  }, [introComplete]);

  return (
    <div className="app-root">
      <div className={shellVisible ? "app-root__shell app-root__shell--visible" : "app-root__shell"}>
        <ExtractionShell />
      </div>
      {introComplete ? null : <LaunchSplash onComplete={() => setIntroComplete(true)} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
