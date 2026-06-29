import { useState, useRef, useEffect } from "react";
import type { ReactElement } from "react";
import { MousePointer, Globe } from "lucide-react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
}

const EXAMPLES = [
  { label: "Найди цену товара", url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html" },
  { label: "Собери список книг", url: "https://books.toscrape.com/catalogue/category/books/mystery_3/index.html" },
  { label: "Сделай обзор страницы", url: "https://example.com" }
];

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlInput({ onSubmit }: UrlInputProps): ReactElement {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  const valid = url.length > 0 ? isValidUrl(url) : true;
  const showUrlError = touched && url.length > 0 && !valid;
  const canSubmit = url.length > 0 && valid;

  function handleSubmit() {
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    onSubmit(url);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="url-input-screen">
      <div className={`url-input-screen__card ${focused ? "url-input-screen__card--focused" : ""}`}>
        <div className="url-input-screen__field">
          <Globe size={20} className="url-input-screen__icon" />
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setTouched(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Вставьте ссылку на страницу"
            className="url-input-screen__input"
            spellCheck={false}
          />
          <button
            className="url-input-screen__submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Отправить"
          >
            <MousePointer size={18} />
          </button>
        </div>
        {showUrlError ? (
          <p className="url-input-screen__error">Введите корректную ссылку (http:// или https://)</p>
        ) : null}
      </div>

      <div className="url-input-screen__hints">
        <p className="url-input-screen__hints-label">Попробуйте</p>
        <div className="url-input-screen__chips">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              className="url-input-screen__chip"
              onClick={() => { setUrl(ex.url); setTouched(false); inputRef.current?.focus(); }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
