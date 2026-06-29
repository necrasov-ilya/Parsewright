import { useState, useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { X } from "lucide-react";
import parsewrightLogoMark from "../assets/parsewright-logo-mark.svg";

export interface BotStage {
  id: string;
  text: string;
  status: "typing" | "done";
}

export interface ChatResult {
  answer: string;
  strategy: { kind: "fields" | "collection" | "summary"; fields?: string[] };
  data: Record<string, unknown>;
  table: Array<Record<string, unknown>>;
  verification: { answersGoal: boolean; issues: string[] };
  repaired: boolean;
  dialogId?: number;
}

export interface ChatRound {
  id: string;
  goal: string;
  stages: BotStage[];
  result: ChatResult | null;
  error: string | null;
  loading: boolean;
}

interface ChatFeedProps {
  url: string;
  domain: string;
  faviconUrl: string | null;
  rounds: ChatRound[];
  anyLoading: boolean;
  onGoalSubmit: (goal: string) => void;
  onCancel: () => void;
}

export function ChatFeed({
  url, domain, faviconUrl, rounds, anyLoading, onGoalSubmit, onCancel
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
          <div className="chat-feed__favicon-placeholder">
            {domain.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="chat-feed__domain">{domain}</span>
        <span className="chat-feed__url">{url}</span>
      </div>

      <div className="chat-feed__messages" ref={feedRef}>
        {rounds.map((round, idx) => (
          <RoundBlock key={round.id} round={round} showAvatar={idx === 0} />
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
            onClick={() => {
              if (goalText.trim()) {
                onGoalSubmit(goalText);
                setGoalText("");
              }
            }}
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

function RoundBlock({ round, showAvatar }: { round: ChatRound; showAvatar: boolean }): ReactElement {
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
          {round.stages.map((stage) => (
            <StageMessage key={stage.id} stage={stage} />
          ))}
          {round.loading && round.stages.length === 0 ? (
            <div className="chat-feed__typing">
              <span /><span /><span />
            </div>
          ) : null}
        </div>
      </div>

      {round.error ? <div className="chat-feed__error">{round.error}</div> : null}
      {round.result ? <ResultCard result={round.result} /> : null}
      {round.result ? (
        <div className="chat-feed__bot">
          <div className="chat-feed__bot-avatar-spacer" />
          <div className="chat-feed__bot-messages">
            <div className="chat-feed__stage chat-feed__stage--done">
              <span className="chat-feed__stage-dot chat-feed__stage-dot--done" />
              <p className="chat-feed__stage-text">Готово. Алгоритм сохранён — можно переиспользовать для этого сайта.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StageMessage({ stage }: { stage: BotStage }): ReactElement {
  const [displayedText, setDisplayedText] = useState("");
  const [isPrinting, setIsPrinting] = useState(stage.status === "typing");
  const doneRef = useRef(false);

  useEffect(() => {
    if (stage.status === "done") {
      if (!doneRef.current) {
        doneRef.current = true;
        setDisplayedText(stage.text);
        setIsPrinting(false);
      }
      return;
    }
    setDisplayedText("");
    setIsPrinting(true);
    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      setDisplayedText(stage.text.slice(0, i));
      if (i >= stage.text.length) {
        window.clearInterval(interval);
        setIsPrinting(false);
      }
    }, 22);
    return () => window.clearInterval(interval);
  }, [stage.status, stage.text]);

  return (
    <div className={`chat-feed__stage ${stage.status === "typing" ? "chat-feed__stage--active" : ""}`}>
      <span className={`chat-feed__stage-dot ${stage.status === "done" ? "chat-feed__stage-dot--done" : ""}`} />
      <p className="chat-feed__stage-text">
        {displayedText}
        {isPrinting ? <span className="chat-feed__cursor">▎</span> : null}
      </p>
    </div>
  );
}

function ResultCard({ result }: { result: ChatResult }): ReactElement {
  const kind = result.strategy.kind;
  return (
    <div className="result-card">
      {!result.verification.answersGoal ? (
        <p className="result-card__warning">
          {result.verification.issues.join(" ") || "Данные могут не полностью отвечать на запрос."}
        </p>
      ) : null}
      {result.repaired ? (
        <p className="result-card__repaired">Сайт изменился — алгоритм обновлён.</p>
      ) : null}

      <div className="result-card__answer">
        <p className="result-card__answer-text">{result.answer}</p>
      </div>

      {kind === "fields" ? <FieldsTable data={result.data} /> : null}
      {kind === "collection" && result.table.length > 0 ? <CollectionTable table={result.table} /> : null}
      {kind === "summary" ? <SummaryView data={result.data} /> : null}
    </div>
  );
}

function FieldsTable({ data }: { data: Record<string, unknown> }): ReactElement | null {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <p className="result-card__empty">Не удалось извлечь поля.</p>;
  return (
    <div className="result-card__table-wrap">
      <table>
        <thead><tr><th>Поле</th><th>Значение</th></tr></thead>
        <tbody>
          {entries.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{Array.isArray(v) ? `${v.length} items` : String(v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function CollectionTable({ table }: { table: Array<Record<string, unknown>> }): ReactElement | null {
  if (table.length === 0) return <p className="result-card__empty">Не найдено элементов.</p>;
  const columns = Object.keys(table[0]).filter((k) => k !== "raw");
  return (
    <div className="result-card__table-wrap">
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

function SummaryView({ data }: { data: Record<string, unknown> }): ReactElement | null {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="result-card__table-wrap">
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
