import React, { useState } from "react";
import { createRoot } from "react-dom/client";
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

function App() {
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
          <div className="mark" />
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

createRoot(document.getElementById("root")!).render(<App />);
