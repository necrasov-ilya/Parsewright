import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { KeyRound, Settings2, Sparkles } from "lucide-react";

export interface ProviderInfo {
  id: string;
  label: string;
  defaultModel: string;
  baseUrl: string;
  docsUrl?: string;
}

interface OnboardingProps {
  providers: ProviderInfo[];
  onComplete: (config: OnboardingConfig) => void;
}

export interface OnboardingConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  useHeuristic: boolean;
}

export function Onboarding({ providers, onComplete }: OnboardingProps): ReactElement {
  const [phase, setPhase] = useState<"greeting" | "setup">("greeting");
  const [greetingVisible, setGreetingVisible] = useState(false);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setGreetingVisible(true), 200);
    const advanceTimer = window.setTimeout(() => {
      setGreetingVisible(false);
      window.setTimeout(() => setPhase("setup"), 600);
    }, 3000);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(advanceTimer);
    };
  }, []);

  if (phase === "greeting") {
    return (
      <div className={`onboarding-greeting ${greetingVisible ? "onboarding-greeting--visible" : ""}`}>
        <Sparkles size={36} className="onboarding-greeting__icon" />
        <h2 className="onboarding-greeting__title">Привет! Это Parsewright</h2>
        <p className="onboarding-greeting__subtitle">Студия для извлечения данных с любых сайтов</p>
      </div>
    );
  }

  return <ModelSetup providers={providers} onComplete={onComplete} />;
}

const CUSTOM_ID = "openai-compatible";

function ModelSetup({ providers, onComplete }: { providers: ProviderInfo[]; onComplete: (config: OnboardingConfig) => void }): ReactElement {
  const [provider, setProvider] = useState("fireworks");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useHeuristic, setUseHeuristic] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedProvider = providers.find((p) => p.id === provider);
  const isCustom = provider === CUSTOM_ID;

  function handleProviderChange(id: string) {
    const preset = providers.find((p) => p.id === id);
    setProvider(id);
    setModel(preset?.defaultModel ?? "");
    setBaseUrl(preset?.baseUrl ?? "");
  }

  async function handleSave() {
    setSaving(true);
    try {
      onComplete({
        provider: useHeuristic ? "heuristic" : provider,
        model: model || selectedProvider?.defaultModel || "",
        baseUrl: baseUrl || selectedProvider?.baseUrl || "",
        apiKey,
        useHeuristic
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-setup">
      <div className="onboarding-setup__header">
        <Settings2 size={28} className="onboarding-setup__icon" />
        <h2 className="onboarding-setup__title">Настройка модели</h2>
        <p className="onboarding-setup__subtitle">Выберите провайдера для анализа страниц</p>
      </div>

      <div className="onboarding-setup__body">
        <div className="onboarding-field">
          <label className="onboarding-field__label">Провайдер</label>
          <div className="provider-grid">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`provider-card ${provider === p.id && !useHeuristic ? "provider-card--selected" : ""}`}
                onClick={() => { handleProviderChange(p.id); setUseHeuristic(false); }}
                disabled={useHeuristic}
              >
                <span className="provider-card__label">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {isCustom && !useHeuristic ? (
          <div className="onboarding-field">
            <label className="onboarding-field__label">Base URL</label>
            <input
              type="text"
              className="onboarding-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
            />
          </div>
        ) : null}

        {!useHeuristic ? (
          <div className="onboarding-field">
            <label className="onboarding-field__label">Модель</label>
            <input
              type="text"
              className="onboarding-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={selectedProvider?.defaultModel ?? "gpt-4.1-mini"}
            />
          </div>
        ) : null}

        <div className="onboarding-field">
          <div className="onboarding-field__row">
            <label className="onboarding-field__label">
              <KeyRound size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              API ключ
            </label>
            <button
              type="button"
              className={`heuristic-toggle ${useHeuristic ? "heuristic-toggle--on" : ""}`}
              onClick={() => setUseHeuristic((v) => !v)}
            >
              <span className="heuristic-toggle__track">
                <span className="heuristic-toggle__thumb" />
              </span>
              <span className="heuristic-toggle__label">{useHeuristic ? "Без ключа" : "С ключом"}</span>
            </button>
          </div>
          {useHeuristic ? (
            <p className="onboarding-field__hint">
              Подходит для локальных провайдеров без авторизации (Ollama, LM Studio и др.)
            </p>
          ) : (
            <input
              type="password"
              className="onboarding-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selectedProvider?.docsUrl ? `Введите ключ — получить: ${selectedProvider.docsUrl}` : "Введите API ключ"}
              disabled={useHeuristic}
            />
          )}
        </div>

        <button
          className="onboarding-setup__save"
          onClick={handleSave}
          disabled={saving || (!useHeuristic && !apiKey && !isCustom)}
        >
          {saving ? "Сохранение..." : "Продолжить"}
        </button>
      </div>
    </div>
  );
}
