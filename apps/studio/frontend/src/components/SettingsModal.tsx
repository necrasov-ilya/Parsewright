import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { KeyRound, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import type { OnboardingConfig, ProviderInfo } from "./Onboarding";

interface SettingsModalProps {
  providers: ProviderInfo[];
  config: OnboardingConfig;
  onClose: () => void;
  onSave: (config: OnboardingConfig) => Promise<void>;
}

const CUSTOM_ID = "openai-compatible";

export function SettingsModal({ providers, config, onClose, onSave }: SettingsModalProps): ReactElement {
  const [provider, setProvider] = useState(config.useHeuristic ? "fireworks" : config.provider);
  const [model, setModel] = useState(config.model);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [useHeuristic, setUseHeuristic] = useState(config.useHeuristic);
  const [providerQuery, setProviderQuery] = useState("");

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === provider) ?? providers[0],
    [provider, providers]
  );
  const visibleProviders = useMemo(() => {
    const query = providerQuery.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((item) =>
      [item.label, item.id, item.defaultModel, item.baseUrl]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [providerQuery, providers]);
  const isCustom = provider === CUSTOM_ID;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleProviderChange(id: string): void {
    const preset = providers.find((item) => item.id === id);
    setProvider(id);
    setModel(preset?.defaultModel ?? "");
    setBaseUrl(preset?.baseUrl ?? "");
    if (id !== CUSTOM_ID) setUseHeuristic(false);
  }

  useEffect(() => {
    if (!useHeuristic && !apiKey.trim() && !isCustom) return;
    const timer = window.setTimeout(() => {
      void onSave({
        provider: useHeuristic ? "heuristic" : provider,
        model: model || selectedProvider?.defaultModel || "",
        baseUrl: baseUrl || selectedProvider?.baseUrl || "",
        apiKey,
        useHeuristic
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [apiKey, baseUrl, isCustom, model, onSave, provider, selectedProvider?.baseUrl, selectedProvider?.defaultModel, useHeuristic]);

  return (
    <div className="settings-modal" role="presentation">
      <div className="settings-modal__scrim" onClick={onClose} />
      <section className="settings-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="settings-modal__close" type="button" aria-label="Закрыть настройки" onClick={onClose}>
          <X size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <aside className="settings-modal__nav" aria-label="Разделы настроек">
          <p>Настройки</p>
          <button className="settings-modal__nav-item settings-modal__nav-item--active" type="button">
            <Settings2 size={15} strokeWidth={2.1} />
            <span>Модель</span>
          </button>
          <button className="settings-modal__nav-item" type="button" disabled>
            <SlidersHorizontal size={15} strokeWidth={2.1} />
            <span>Извлечение</span>
          </button>
        </aside>

        <div className="settings-modal__content">
          <div className="settings-modal__header">
            <div>
              <h2 id="settings-title">Провайдер и модель</h2>
            </div>
          </div>

          <section className="settings-modal__panel" aria-labelledby="provider-section-title">
            <div className="settings-modal__card-head">
              <div>
                <h3 id="provider-section-title">Провайдер</h3>
                <p>Выберите совместимый API. Параметры подключения можно уточнить ниже.</p>
              </div>
            </div>

            <label className="settings-modal__provider-search">
              <Search size={15} strokeWidth={2.1} aria-hidden="true" />
              <input
                type="search"
                value={providerQuery}
                onChange={(event) => setProviderQuery(event.target.value)}
                placeholder="Найти провайдера"
              />
            </label>

            <div className="settings-modal__provider-grid">
              {visibleProviders.length ? visibleProviders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-modal__provider ${provider === item.id ? "settings-modal__provider--selected" : ""}`}
                  onClick={() => handleProviderChange(item.id)}
                >
                  <span>{item.label}</span>
                  <small>{item.defaultModel}</small>
                </button>
              )) : (
                <p className="settings-modal__provider-empty">Ничего не найдено</p>
              )}
            </div>

            <div className="settings-modal__divider" />

            {isCustom ? (
              <div className="settings-modal__connection-head">
                <button
                  type="button"
                  className={`settings-modal__switch ${useHeuristic ? "settings-modal__switch--on" : ""}`}
                  onClick={() => setUseHeuristic((value) => !value)}
                >
                  <span className="settings-modal__switch-track">
                    <span className="settings-modal__switch-thumb" />
                  </span>
                  <span>{useHeuristic ? "Без ключа" : "С ключом"}</span>
                </button>
              </div>
            ) : null}

            <div className="settings-modal__form-grid">
              {isCustom ? (
              <label className="settings-field">
                <span>Base URL</span>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://localhost:11434/v1"
                />
              </label>
              ) : null}

              <label className="settings-field">
                <span>Модель</span>
                <input
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={selectedProvider?.defaultModel ?? "gpt-4.1-mini"}
                />
              </label>

              <label className="settings-field settings-field--full">
                <span>
                  <KeyRound size={14} strokeWidth={2.1} aria-hidden="true" />
                  API ключ
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={selectedProvider?.docsUrl ? `Ключ ${selectedProvider.label}` : "Введите API ключ"}
                  disabled={useHeuristic}
                />
              </label>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
