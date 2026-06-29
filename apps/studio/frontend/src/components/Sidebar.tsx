import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
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
  onSelectDialog: (id: number) => void;
  onDeleteDialog: (id: number) => void;
}

export function Sidebar({ dialogs, activeDialogId, onSelectDialog, onDeleteDialog }: SidebarProps): ReactElement {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img src={parsewrightLogoFull} alt="Parsewright" className="sidebar__logo-img" />
      </div>

      <div className="sidebar__section">
        <div className="sidebar__label">
          <MessageSquare size={14} />
          <span>Недавние диалоги</span>
        </div>

        <div className="sidebar__dialogs">
          {dialogs.length === 0 ? (
            <p className="sidebar__empty">Пока нет диалогов</p>
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

  useEffect(() => {
    if (dialog.accent_color) {
      setAccentColor(dialog.accent_color);
      return;
    }
    if (dialog.favicon_url) {
      extractAccentColor(dialog.favicon_url).then((color) => {
        if (color) setAccentColor(color);
      });
    }
  }, [dialog.favicon_url, dialog.accent_color]);

  const gradient = accentColor
    ? `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`
    : "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))";

  return (
    <div
      className={`dialog-card ${active ? "dialog-card--active" : ""}`}
      style={{ background: gradient }}
      onClick={onSelect}
    >
      <div className="dialog-card__header">
        {dialog.favicon_url ? (
          <img src={dialog.favicon_url} alt="" className="dialog-card__favicon" />
        ) : (
          <div
            className="dialog-card__favicon-placeholder"
            style={accentColor ? { background: `${accentColor}44` } : undefined}
          >
            {dialog.domain.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="dialog-card__domain">{dialog.domain}</span>
        <button
          className="dialog-card__delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Удалить"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <a href={dialog.url} className="dialog-card__url" onClick={(e) => e.stopPropagation()} title={dialog.url}>
        {dialog.url}
      </a>
      <p className="dialog-card__title">{dialog.title}</p>
    </div>
  );
}

async function extractAccentColor(faviconUrl: string): Promise<string | null> {
  try {
    const response = await fetch(faviconUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    bitmap.close?.();
    if (r < 20 && g < 20 && b < 20) return null;
    if (r > 240 && g > 240 && b > 240) return null;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return null;
  }
}
