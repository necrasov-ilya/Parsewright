import { useState, useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { X, Code2, Download, Copy, Check, Globe, Cpu, FileCode, Search, Wrench, CheckCircle2 } from "lucide-react";
import parsewrightLogoMark from "../assets/parsewright-logo-mark.svg";

export interface AgentEvent {
  id: string;
  type: "thinking" | "tool_call" | "tool_result" | "answer" | "error" | "info";
  stage?: string;
  thinking?: string;
  tool?: { name: string; label: string; status: "running" | "done" };
  toolData?: unknown;
  answer?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number };
  result?: ChatResult;
}

export interface ChatResult {
  answer: string;
  strategy: { kind: "fields" | "collection" | "summary"; fields?: string[] };
  data: Record<string, unknown>;
  table: Array<Record<string, unknown>>;
  verification: { answersGoal: boolean; issues: string[] };
  repaired: boolean;
  manifest?: Record<string, unknown>;
  usage?: { promptTokens: number; completionTokens: number };
  dialogId?: number;
}

export interface ChatRound {
  id: string;
  goal: string;
  events: AgentEvent[];
  result: ChatResult | null;
  error: string | null;
  loading: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

interface ChatFeedProps {
  url: string;
  domain: string;
  faviconUrl: string | null;
  rounds: ChatRound[];
  anyLoading: boolean;
  onGoalSubmit: (goal: string) => void;
  onCancel: () => void;
  onGenerateCode: (manifest: Record<string, unknown>, roundId: string) => void;
}

const TOOL_ICONS: Record<string, ReactElement> = {
  "Playwright": <Globe size={14} />,
  "Page Reducer": <Search size={14} />,
  "Model": <Cpu size={14} />,
  "Runner": <Wrench size={14} />,
  "Validator": <CheckCircle2 size={14} />,
  "Ranker": <FileCode size={14} />
};

export function ChatFeed({
  url, domain, faviconUrl, rounds, anyLoading, onGoalSubmit, onCancel, onGenerateCode
}: ChatFeedProps): ReactElement {
  const [goalText, setGoalText] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [rounds]);

  return (
    <div className="chat-feed">
      <div className="chat-feed__context">
        {faviconUrl ? (
          <img src={faviconUrl} alt="" className="chat-feed__favicon" />
        ) : (
          <div className="chat-feed__favicon-placeholder">{domain.charAt(0).toUpperCase()}</div>
        )}
        <span className="chat-feed__domain">{domain}</span>
        <span className="chat-feed__url">{url}</span>
      </div>

      <div className="chat-feed__messages" ref={feedRef}>
        {rounds.map((round, idx) => (
          <RoundBlock key={round.id} round={round} showAvatar={idx === 0} onGenerateCode={onGenerateCode} />
        ))}
      </div>

      <div className="chat-feed__input">
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && goalText.trim() && !anyLoading) {
              e.preventDefault();
              onGoalSubmit(goalText);
              setGoalText("");
            }
          }}
          placeholder="Опишите, что нужно извлечь…"
          className="chat-feed__textarea"
          rows={1}
          disabled={anyLoading}
        />
        {anyLoading ? (
          <button className="chat-feed__send chat-feed__send--cancel" onClick={onCancel} aria-label="Отменить">
            <X size={18} />
          </button>
        ) : (
          <button
            className="chat-feed__send"
            onClick={() => { if (goalText.trim()) { onGoalSubmit(goalText); setGoalText(""); } }}
            disabled={!goalText.trim()}
            aria-label="Отправить"
          >
            <span className="chat-feed__send-arrow">↑</span>
          </button>
        )}
      </div>
    </div>
  );
}

function RoundBlock({ round, showAvatar, onGenerateCode }: { round: ChatRound; showAvatar: boolean; onGenerateCode: (manifest: Record<string, unknown>, roundId: string) => void }): ReactElement {
  return (
    <>
      <div className="chat-feed__user-message">
        <p className="chat-feed__user-text">{round.goal}</p>
      </div>

      <div className="chat-feed__bot">
        {showAvatar ? (
          <img src={parsewrightLogoMark} alt="" className="chat-feed__bot-avatar" />
        ) : (
          <div className="chat-feed__bot-avatar-spacer" />
        )}
        <div className="chat-feed__bot-messages">
          {round.events.map((event) => (
            <EventRenderer key={event.id} event={event} />
          ))}
          {round.loading && round.events.length === 0 ? (
            <div className="chat-feed__typing"><span /><span /><span /></div>
          ) : null}
        </div>
      </div>

      {round.error ? <div className="chat-feed__error">{round.error}</div> : null}

      {round.result ? (
        <>
          <ResultCard result={round.result} />
          <ResultActions result={round.result} onGenerateCode={() => onGenerateCode(round.result?.manifest ?? {}, round.id)} />
          {round.usage ? <TokenBadge usage={round.usage} /> : null}
        </>
      ) : null}
    </>
  );
}

function EventRenderer({ event }: { event: AgentEvent }): ReactElement {
  if (event.type === "thinking" && event.thinking) {
    return <ThinkingBubble text={event.thinking} done={event.tool?.status === "done"} />;
  }

  if (event.type === "tool_call" && event.tool) {
    return <ToolCall name={event.tool.name} label={event.tool.label} status={event.tool.status} icon={TOOL_ICONS[event.tool.name] ?? <Wrench size={14} />} data={event.toolData} />;
  }

  if (event.type === "error") {
    return <div className="chat-feed__error">{event.error}</div>;
  }

  return <></>;
}

function ThinkingBubble({ text, done }: { text: string; done: boolean }): ReactElement {
  const [displayed, setDisplayed] = useState("");
  const [printing, setPrinting] = useState(!done);
  const doneRef = useRef(false);

  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      setDisplayed(text);
      setPrinting(false);
      return;
    }
    if (done) return;
    setDisplayed("");
    setPrinting(true);
    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { window.clearInterval(interval); setPrinting(false); }
    }, 22);
    return () => window.clearInterval(interval);
  }, [text, done]);

  return (
    <div className="chat-feed__thinking">
      <p className="chat-feed__thinking-text">
        {displayed}
        {printing ? <span className="chat-feed__cursor">▎</span> : null}
      </p>
    </div>
  );
}

function ToolCall({ name, label, status, icon, data }: {
  name: string;
  label: string;
  status: "running" | "done";
  icon: ReactElement;
  data?: unknown;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`tool-call ${status === "done" ? "tool-call--done" : ""}`} onClick={() => data && setExpanded(!expanded)}>
      <div className="tool-call__header">
        <span className="tool-call__icon">{icon}</span>
        <span className="tool-call__name">{name}</span>
        <span className="tool-call__label">{label}</span>
        <span className={`tool-call__status ${status === "done" ? "tool-call__status--done" : "tool-call__status--running"}`}>
          {status === "done" ? <CheckCircle2 size={12} /> : <span className="tool-call__spinner" />}
        </span>
      </div>
      {expanded && data ? (
        <div className="tool-call__details">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({ result }: { result: ChatResult }): ReactElement {
  const kind = result.strategy.kind;
  return (
    <div className="result-card">
      {!result.verification.answersGoal ? (
        <p className="result-card__warning">{result.verification.issues.join(" ") || "Данные могут не полностью отвечать на запрос."}</p>
      ) : null}
      {result.repaired ? <p className="result-card__repaired">Сайт изменился — алгоритм обновлён.</p> : null}
      <div className="result-card__answer">
        <p className="result-card__answer-text">{result.answer}</p>
      </div>
      {kind === "fields" ? <FieldsTable data={result.data} /> : null}
      {kind === "collection" && result.table.length > 0 ? <CollectionTable table={result.table} /> : null}
      {kind === "summary" ? <SummaryView data={result.data} /> : null}
    </div>
  );
}

function ResultActions({ result, onGenerateCode }: { result: ChatResult; onGenerateCode: () => void }): ReactElement {
  return (
    <div className="result-actions">
      <button className="result-action" onClick={onGenerateCode}>
        <Code2 size={15} />
        <span>Сформировать код</span>
      </button>
      <button className="result-action" onClick={() => {
        const json = JSON.stringify(result.manifest ?? {}, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "parsewright-manifest.json";
        a.click();
        URL.revokeObjectURL(a.href);
      }}>
        <Download size={15} />
        <span>Экспортировать алгоритм</span>
      </button>
    </div>
  );
}

function TokenBadge({ usage }: { usage: { promptTokens: number; completionTokens: number } }): ReactElement {
  return (
    <div className="token-badge">
      <span className="token-badge__item">↑ {usage.promptTokens.toLocaleString()}</span>
      <span className="token-badge__sep">·</span>
      <span className="token-badge__item">↓ {usage.completionTokens.toLocaleString()}</span>
      <span className="token-badge__sep">·</span>
      <span className="token-badge__total">{(usage.promptTokens + usage.completionTokens).toLocaleString()} токенов</span>
    </div>
  );
}

function FieldsTable({ data }: { data: Record<string, unknown> }): ReactElement | null {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <p className="result-card__empty">Не удалось извлечь поля.</p>;
  return (
    <div className="result-card__table-wrap">
      <table><thead><tr><th>Поле</th><th>Значение</th></tr></thead>
        <tbody>{entries.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{Array.isArray(v) ? `${v.length} items` : String(v)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function CollectionTable({ table }: { table: Array<Record<string, unknown>> }): ReactElement | null {
  if (table.length === 0) return <p className="result-card__empty">Не найдено элементов.</p>;
  const columns = Object.keys(table[0]).filter((k) => k !== "raw");
  return (
    <div className="result-card__table-wrap">
      <table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{table.slice(0, 50).map((row, i) => (
          <tr key={i}>{columns.map((c) => <td key={c}>{c === "url" && typeof row[c] === "string" ? <a href={String(row[c])}>{String(row[c])}</a> : formatCell(row[c])}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SummaryView({ data }: { data: Record<string, unknown> }): ReactElement | null {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="result-card__table-wrap">
      <table><thead><tr><th>Ключ</th><th>Значение</th></tr></thead>
        <tbody>{entries.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{Array.isArray(v) ? `${v.length} items` : String(v)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}
