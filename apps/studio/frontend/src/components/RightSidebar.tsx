import type { ReactElement } from "react";
import { FileText, Code2, Activity, CheckCircle2, XCircle, AlertCircle, Clock, Link2, Tag } from "lucide-react";

export interface SidebarData {
  capture?: {
    url: string;
    finalUrl: string;
    title: string;
    favicon?: string;
    status?: number;
    timingMs?: number;
  };
  manifest?: Record<string, unknown>;
  strategy?: { kind: string; fields?: string[] };
  validation?: {
    page: { ok: boolean; issues?: Array<{ code: string; message: string }> };
    data: { ok: boolean; issues?: Array<{ field?: string; code: string; message: string }> };
  };
  verification?: { answersGoal: boolean; issues: string[] };
  repaired?: boolean;
}

interface RightSidebarProps {
  collapsed: boolean;
  data: SidebarData | null;
}

export function RightSidebar({ collapsed, data }: RightSidebarProps): ReactElement {
  if (collapsed) return <></>;
  return (
    <aside className="right-sidebar">
      <Section icon={<FileText size={14} />} label="Страница">
        {data?.capture ? <PageInfo capture={data.capture} /> : <Placeholder text="Информация появится после загрузки" />}
      </Section>

      <Section icon={<Code2 size={14} />} label="Алгоритм">
        {data?.manifest ? <ManifestInfo manifest={data.manifest} strategy={data.strategy} /> : <Placeholder text="Manifest появится после генерации" />}
      </Section>

      <Section icon={<Activity size={14} />} label="Диагностика">
        {data?.validation ? (
          <DiagnosticsInfo
            validation={data.validation}
            verification={data.verification}
            repaired={data.repaired}
          />
        ) : (
          <Placeholder text="Результаты проверки появятся здесь" />
        )}
      </Section>
    </aside>
  );
}

function Section({ icon, label, children }: { icon: ReactElement; label: string; children: ReactElement }): ReactElement {
  return (
    <div className="right-sidebar__section">
      <div className="right-sidebar__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="right-sidebar__panel">
        {children}
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }): ReactElement {
  return <p className="right-sidebar__placeholder">{text}</p>;
}

function PageInfo({ capture }: { capture: NonNullable<SidebarData["capture"]> }): ReactElement {
  const redirected = capture.finalUrl && capture.finalUrl !== capture.url;
  return (
    <div className="right-sidebar__content">
      {capture.favicon ? (
        <div className="right-sidebar__page-header">
          <img src={capture.favicon} alt="" className="right-sidebar__page-favicon" />
          <span className="right-sidebar__page-title">{capture.title}</span>
        </div>
      ) : (
        <div className="right-sidebar__page-header">
          <span className="right-sidebar__page-title">{capture.title}</span>
        </div>
      )}
      <div className="right-sidebar__field">
        <Link2 size={12} />
        <span className="right-sidebar__field-value right-sidebar__field-value--truncate">{capture.url}</span>
      </div>
      {redirected ? (
        <div className="right-sidebar__field">
          <span className="right-sidebar__field-label">→</span>
          <span className="right-sidebar__field-value right-sidebar__field-value--truncate">{capture.finalUrl}</span>
        </div>
      ) : null}
      {capture.status ? (
        <div className="right-sidebar__field">
          <Tag size={12} />
          <span className="right-sidebar__field-value">Status {capture.status}</span>
        </div>
      ) : null}
      {capture.timingMs ? (
        <div className="right-sidebar__field">
          <Clock size={12} />
          <span className="right-sidebar__field-value">{(capture.timingMs / 1000).toFixed(1)}s</span>
        </div>
      ) : null}
    </div>
  );
}

function ManifestInfo({ manifest, strategy }: { manifest: Record<string, unknown>; strategy?: { kind: string; fields?: string[] } }): ReactElement {
  const id = String(manifest.id ?? "—");
  const fields = strategy?.fields ?? [];
  const kind = strategy?.kind ?? "—";

  const manifestFields = manifest.fields as Record<string, { selector?: string }> | undefined;
  const collections = manifest.collections as Record<string, { selector?: string; fields?: Record<string, { selector?: string }> }> | undefined;

  return (
    <div className="right-sidebar__content">
      <div className="right-sidebar__badge-row">
        <span className="right-sidebar__badge">{kind}</span>
      </div>
      <div className="right-sidebar__field">
        <span className="right-sidebar__field-label">ID</span>
        <span className="right-sidebar__field-value right-sidebar__field-value--mono">{id}</span>
      </div>
      {fields.length > 0 ? (
        <div className="right-sidebar__field">
          <span className="right-sidebar__field-label">Fields</span>
          <span className="right-sidebar__field-value">{fields.join(", ")}</span>
        </div>
      ) : null}
      {manifestFields ? (
        <div className="right-sidebar__selectors">
          {Object.entries(manifestFields).slice(0, 6).map(([name, rule]) => (
            <div key={name} className="right-sidebar__selector-row">
              <span className="right-sidebar__selector-name">{name}</span>
              <span className="right-sidebar__selector-value">{rule?.selector ?? "—"}</span>
            </div>
          ))}
        </div>
      ) : null}
      {collections ? (
        <div className="right-sidebar__selectors">
          {Object.entries(collections).slice(0, 3).map(([name, col]) => (
            <div key={name} className="right-sidebar__selector-row">
              <span className="right-sidebar__selector-name">{name}</span>
              <span className="right-sidebar__selector-value">{col?.selector ?? "—"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiagnosticsInfo({ validation, verification, repaired }: {
  validation: NonNullable<SidebarData["validation"]>;
  verification?: { answersGoal: boolean; issues: string[] };
  repaired?: boolean;
}): ReactElement {
  return (
    <div className="right-sidebar__content">
      <DiagRow
        ok={validation.page.ok}
        label="Page sanity"
        issues={validation.page.issues?.map((i) => i.message) ?? []}
      />
      <DiagRow
        ok={validation.data.ok}
        label="Data validation"
        issues={validation.data.issues?.map((i) => `${i.field ? `${i.field}: ` : ""}${i.message}`) ?? []}
      />
      {repaired ? (
        <div className="right-sidebar__diag-row right-sidebar__diag-row--info">
          <AlertCircle size={14} />
          <span>Manifest repaired</span>
        </div>
      ) : null}
      {verification ? (
        <DiagRow
          ok={verification.answersGoal}
          label="Answers goal"
          issues={verification.issues}
        />
      ) : null}
    </div>
  );
}

function DiagRow({ ok, label, issues }: { ok: boolean; label: string; issues: string[] }): ReactElement {
  return (
    <div className={`right-sidebar__diag-row ${ok ? "right-sidebar__diag-row--ok" : "right-sidebar__diag-row--fail"}`}>
      {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span className="right-sidebar__diag-label">{label}</span>
      {!ok && issues.length > 0 ? (
        <ul className="right-sidebar__diag-issues">
          {issues.slice(0, 4).map((issue, i) => <li key={i}>{issue}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
