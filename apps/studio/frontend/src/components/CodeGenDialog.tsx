import { useState, useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { X, Code2, FileText, Terminal, FileCode, Copy, Check, Download, Loader2, Sparkles } from "lucide-react";

interface CodeGenDialogProps {
  open: boolean;
  manifest: Record<string, unknown> | null;
  config: { provider: string; model: string; baseUrl: string; apiKey: string; useHeuristic: boolean } | null;
  onClose: () => void;
  onGenerate: (params: CodeGenParams) => void;
  codeChunks: string[];
  codeDone: boolean;
  codeError: string | null;
}

export interface CodeGenParams {
  language: "python" | "javascript" | "curl";
  includeDocs: boolean;
  extraRequirements: string;
  destination: "local" | "export";
}

type Step = "language" | "docs" | "extra" | "destination" | "generating" | "result";

const LANG_OPTIONS = [
  { id: "python" as const, label: "Python", icon: <FileCode size={18} />, desc: "BeautifulSoup + requests" },
  { id: "javascript" as const, label: "JavaScript", icon: <Terminal size={18} />, desc: "Cheerio + node-fetch" },
  { id: "curl" as const, label: "Shell", icon: <Terminal size={18} />, desc: "curl + jq" }
];

export function CodeGenDialog({ open, manifest, config, onClose, onGenerate, codeChunks, codeDone, codeError }: CodeGenDialogProps): ReactElement {
  const [step, setStep] = useState<Step>("language");
  const [language, setLanguage] = useState<"python" | "javascript" | "curl">("python");
  const [includeDocs, setIncludeDocs] = useState(true);
  const [extraRequirements, setExtraRequirements] = useState("");
  const [destination, setDestination] = useState<"local" | "export">("export");
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("language");
      setExtraRequirements("");
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (codeChunks.length > 0 && step === "generating") {
      setStep("result");
    }
  }, [codeChunks, step]);

  useEffect(() => {
    if (codeError && step === "generating") {
      setStep("result");
    }
  }, [codeError, step]);

  if (!open) return <></>;

  const fullCode = codeChunks.join("");

  function handleStart() {
    setStep("generating");
    onGenerate({ language, includeDocs, extraRequirements, destination });
  }

  function handleCopy() {
    navigator.clipboard.writeText(fullCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const ext = language === "python" ? "py" : language === "javascript" ? "js" : "sh";
    const blob = new Blob([fullCode], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `parsewright-extract.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="codegen-overlay" onClick={onClose}>
      <div className="codegen-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="codegen-dialog__header">
          <div className="codegen-dialog__title">
            <Code2 size={20} />
            <span>Генерация кода</span>
          </div>
          <button className="codegen-dialog__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="codegen-dialog__body">
          {step === "language" ? (
            <CodeGenStep title="На каком языке написать скрипт?" subtitle="Выберите язык программирования">
              <div className="codegen-options">
                {LANG_OPTIONS.map((opt) => (
                  <button key={opt.id} className={`codegen-option ${language === opt.id ? "codegen-option--selected" : ""}`} onClick={() => setLanguage(opt.id)}>
                    <span className="codegen-option__icon">{opt.icon}</span>
                    <div className="codegen-option__info">
                      <span className="codegen-option__label">{opt.label}</span>
                      <span className="codegen-option__desc">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              <CodeGenNav onNext={() => setStep("docs")} />
            </CodeGenStep>
          ) : null}

          {step === "docs" ? (
            <CodeGenStep title="Нужна ли инструкция по запуску?" subtitle="Документация поможет быстро начать">
              <div className="codegen-options">
                <button className={`codegen-option ${includeDocs ? "codegen-option--selected" : ""}`} onClick={() => setIncludeDocs(true)}>
                  <span className="codegen-option__icon"><FileText size={18} /></span>
                  <div className="codegen-option__info">
                    <span className="codegen-option__label">Да, с документацией</span>
                    <span className="codegen-option__desc">Комментарии и инструкция</span>
                  </div>
                </button>
                <button className={`codegen-option ${!includeDocs ? "codegen-option--selected" : ""}`} onClick={() => setIncludeDocs(false)}>
                  <span className="codegen-option__icon"><Code2 size={18} /></span>
                  <div className="codegen-option__info">
                    <span className="codegen-option__label">Только код</span>
                    <span className="codegen-option__desc">Без лишних комментариев</span>
                  </div>
                </button>
              </div>
              <CodeGenNav onBack={() => setStep("language")} onNext={() => setStep("extra")} />
            </CodeGenStep>
          ) : null}

          {step === "extra" ? (
            <CodeGenStep title="Что-то ещё?" subtitle="Особые требования к коду (необязательно)">
              <textarea
                className="codegen-textarea"
                value={extraRequirements}
                onChange={(e) => setExtraRequirements(e.target.value)}
                placeholder="Например: добавить retry, использовать proxy, вывод в CSV…"
                rows={3}
              />
              <CodeGenNav onBack={() => setStep("docs")} onNext={() => setStep("destination")} nextLabel="Далее" />
            </CodeGenStep>
          ) : null}

          {step === "destination" ? (
            <CodeGenStep title="Куда сохранить?" subtitle="Выберите место для результата">
              <div className="codegen-options">
                <button className={`codegen-option ${destination === "export" ? "codegen-option--selected" : ""}`} onClick={() => setDestination("export")}>
                  <span className="codegen-option__icon"><Download size={18} /></span>
                  <div className="codegen-option__info">
                    <span className="codegen-option__label">Экспортировать файл</span>
                    <span className="codegen-option__desc">Скачать скрипт на компьютер</span>
                  </div>
                </button>
                <button className={`codegen-option ${destination === "local" ? "codegen-option--selected" : ""}`} onClick={() => setDestination("local")}>
                  <span className="codegen-option__icon"><FileCode size={18} /></span>
                  <div className="codegen-option__info">
                    <span className="codegen-option__label">Локально в приложении</span>
                    <span className="codegen-option__desc">Сохранить в проектах Parsewright</span>
                  </div>
                </button>
              </div>
              <CodeGenNav onBack={() => setStep("extra")} onNext={handleStart} nextLabel="Сгенерировать" />
            </CodeGenStep>
          ) : null}

          {step === "generating" ? (
            <div className="codegen-generating">
              <Loader2 size={32} className="codegen-generating__spinner" />
              <p className="codegen-generating__text">Генерирую код…</p>
              <p className="codegen-generating__hint">{LANG_OPTIONS.find((o) => o.id === language)?.label} · {includeDocs ? "с документацией" : "без документации"}</p>
            </div>
          ) : null}

          {step === "result" ? (
            <div className="codegen-result">
              {codeError ? (
                <div className="codegen-result__error">{codeError}</div>
              ) : (
                <>
                  <div className="codegen-result__code">
                    <pre ref={codeRef}>{fullCode || "…"}</pre>
                  </div>
                  <div className="codegen-result__actions">
                    <button className="result-action" onClick={handleCopy}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copied ? "Скопировано" : "Копировать"}</span>
                    </button>
                    <button className="result-action" onClick={handleDownload}>
                      <Download size={15} />
                      <span>Скачать</span>
                    </button>
                    <button className="result-action" onClick={() => { setStep("language"); setExtraRequirements(""); }}>
                      <Sparkles size={15} />
                      <span>Начать заново</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CodeGenStep({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }): ReactElement {
  return (
    <div className="codegen-step">
      <h3 className="codegen-step__title">{title}</h3>
      <p className="codegen-step__subtitle">{subtitle}</p>
      <div className="codegen-step__content">{children}</div>
    </div>
  );
}

function CodeGenNav({ onBack, onNext, nextLabel = "Далее" }: { onBack?: () => void; onNext: () => void; nextLabel?: string }): ReactElement {
  return (
    <div className="codegen-nav">
      {onBack ? <button className="codegen-nav__back" onClick={onBack}>Назад</button> : <span />}
      <button className="codegen-nav__next" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
