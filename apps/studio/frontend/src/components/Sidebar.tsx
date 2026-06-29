import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Clock3, Plus, Settings, Trash2 } from "lucide-react";
import parsewrightLogoFull from "../assets/parsewright-logo-full.svg";

export interface DialogInfo {
  id: number;
  title: string;
  url: string;
  domain: string;
  favicon_url: string | null;
  accent_color: string | null;
  goal: string;
  answer: string | null;
  created_at: string;
}

interface SidebarProps {
  dialogs: DialogInfo[];
  activeDialogId: number | null;
  collapsed: boolean;
  onSelectDialog: (id: number) => void;
  onDeleteDialog: (id: number) => void;
  onNewDialog: () => void;
  modelName: string;
  providerLabel: string;
  onOpenSettings: () => void;
}

export function Sidebar({
  dialogs,
  activeDialogId,
  collapsed,
  onSelectDialog,
  onDeleteDialog,
  onNewDialog,
  modelName,
  providerLabel,
  onOpenSettings
}: SidebarProps): ReactElement {
  if (collapsed) return <></>;
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={parsewrightLogoFull} alt="Parsewright" className="sidebar__logo-img" />
      </div>

      <button className="sidebar__new-dialog" onClick={onNewDialog}>
        <Plus size={16} />
        <span>Новый диалог</span>
      </button>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <div>
            <p className="sidebar__eyebrow">Недавние чаты</p>
            <span className="sidebar__count">{dialogs.length ? `${dialogs.length} в истории` : "Пока пусто"}</span>
          </div>
          <Clock3 size={17} aria-hidden="true" />
        </div>
        <div className="sidebar__dialogs">
          {dialogs.length === 0 ? (
            <div className="sidebar__empty">
              <p>Здесь появятся последние разборы сайтов.</p>
              <span>Начните с URL в центре экрана.</span>
            </div>
          ) : (
            dialogs.map((dialog) => (
              <DialogCard
                key={dialog.id}
                dialog={dialog}
                active={dialog.id === activeDialogId}
                onSelect={() => onSelectDialog(dialog.id)}
                onDelete={() => onDeleteDialog(dialog.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__provider">
          <span className="sidebar__model-dot" />
          <div className="sidebar__provider-text">
            <span className="sidebar__provider-label">{providerLabel}</span>
            <span className="sidebar__model-name">{modelName}</span>
          </div>
        </div>
        <button
          className="sidebar__settings-button"
          type="button"
          aria-label="Открыть настройки"
          title="Настройки"
          onClick={onOpenSettings}
        >
          <Settings size={17} strokeWidth={2.15} />
        </button>
      </div>
    </aside>
  );
}

function DialogCard({ dialog, active, onSelect, onDelete }: {
  dialog: DialogInfo;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}): ReactElement {
  const [accentColor, setAccentColor] = useState<string | null>(dialog.accent_color);
  const [displayFavicon, setDisplayFavicon] = useState<string | null>(() => dialog.favicon_url ?? faviconFromUrl(dialog.url));

  useEffect(() => {
    setDisplayFavicon(dialog.favicon_url ?? faviconFromUrl(dialog.url));
  }, [dialog.favicon_url, dialog.url]);

  useEffect(() => {
    if (displayFavicon) {
      extractAccentColor(displayFavicon).then((color) => {
        if (color) setAccentColor(color);
      });
      return;
    }
    if (dialog.accent_color) {
      setAccentColor(dialog.accent_color);
    }
  }, [displayFavicon, dialog.accent_color]);

  const displayTitle = dialog.title || dialog.goal || dialog.domain;
  const cardStyle = accentColor ? {
    "--dialog-accent": accentColor,
    "--dialog-accent-rgb": hexToRgb(accentColor)
  } as CSSProperties : undefined;

  return (
    <div
      className={`dialog-card ${active ? "dialog-card--active" : ""} ${displayFavicon ? "" : "dialog-card--no-favicon"}`}
      style={cardStyle}
      onClick={onSelect}
    >
      {displayFavicon ? (
        <img
          src={displayFavicon}
          alt=""
          className="dialog-card__glow"
          aria-hidden="true"
          onError={() => setDisplayFavicon(null)}
        />
      ) : null}
      <div className="dialog-card__header">
        {displayFavicon ? (
          <img
            src={displayFavicon}
            alt=""
            className="dialog-card__favicon"
            onError={() => setDisplayFavicon(null)}
          />
        ) : null}
        <div className="dialog-card__meta">
          <span className="dialog-card__domain">{dialog.domain}</span>
          <span className="dialog-card__url">{dialog.url}</span>
        </div>
        <button
          className="dialog-card__delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Удалить"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <p className="dialog-card__title">{displayTitle}</p>
    </div>
  );
}

function faviconFromUrl(url: string): string | null {
  try {
    return new URL("/favicon.ico", url).toString();
  } catch {
    return null;
  }
}

async function extractAccentColor(faviconUrl: string): Promise<string | null> {
  try {
    const response = await fetch(faviconUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const size = 24;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    bitmap.close?.();

    let best: { r: number; g: number; b: number; score: number } | null = null;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if (a < 80) continue;
      if (r < 18 && g < 18 && b < 18) continue;
      if (r > 238 && g > 238 && b > 238) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max - min;
      const brightness = (r + g + b) / 3;
      const score = saturation * 1.8 + Math.min(brightness, 210) * 0.35;
      if (!best || score > best.score) best = { r, g, b, score };
    }

    if (!best) return null;
    const { r, g, b } = best;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "209, 59, 114";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return "209, 59, 114";
  return `${r}, ${g}, ${b}`;
}
