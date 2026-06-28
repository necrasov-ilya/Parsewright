import Database from "better-sqlite3";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { ParsewrightManifest } from "@parsewright/manifest";

export interface SavedProject {
  id: string;
  dir: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  goal: string;
  url: string;
  strategy: string | null;
  created_at: string;
  updated_at: string;
  mcp_enabled: number;
}

export interface RunRecord {
  id: number;
  project_id: string | null;
  started_at: string;
  duration_ms: number | null;
  success: number;
  answer: string | null;
  data: string | null;
  validation: string | null;
  repaired: number;
  issues: string | null;
}

export interface SettingRecord {
  key: string;
  value: string;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    goal        TEXT NOT NULL,
    url         TEXT NOT NULL,
    strategy    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    mcp_enabled INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    started_at  TEXT NOT NULL,
    duration_ms INTEGER,
    success     INTEGER NOT NULL,
    answer      TEXT,
    data        TEXT,
    validation  TEXT,
    repaired    INTEGER DEFAULT 0,
    issues      TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC)`
].join(";");

export class ParsewrightStorage {
  private readonly db: Database.Database;
  private readonly projectsDir: string;
  private readonly snapshotsDir: string;

  constructor(private readonly dataDir: string) {
    this.db = new Database(path.join(dataDir, "parsewright.db"));
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
    this.projectsDir = path.join(dataDir, "projects");
    this.snapshotsDir = path.join(dataDir, "snapshots");
  }

  saveProject(input: {
    manifest: ParsewrightManifest;
    result: Record<string, unknown>;
    snapshotHtml?: string;
  }): SavedProject {
    const { manifest, result } = input;
    const now = new Date().toISOString();
    const dir = path.join(this.projectsDir, manifest.id);

    this.db.prepare(
      `INSERT INTO projects (id, name, goal, url, strategy, created_at, updated_at, mcp_enabled)
       VALUES (@id, @name, @goal, @url, @strategy, @created_at, @updated_at, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = @name, goal = @goal, url = @url, strategy = @strategy, updated_at = @updated_at`
    ).run({
      id: manifest.id,
      name: manifest.name,
      goal: manifest.goal,
      url: manifest.source.url,
      strategy: manifest.strategy ? JSON.stringify(manifest.strategy) : null,
      created_at: manifest.createdAt ?? now,
      updated_at: now
    });

    return { id: manifest.id, dir };
  }

  saveProjectFiles(input: {
    manifest: ParsewrightManifest;
    result: Record<string, unknown>;
    snapshotHtml?: string;
  }): Promise<SavedProject> {
    const { manifest, result, snapshotHtml } = input;
    const dir = path.join(this.projectsDir, manifest.id);
    return mkdir(dir, { recursive: true }).then(async () => {
      await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await writeFile(path.join(dir, "latest-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
      if (snapshotHtml) {
        const snapshotDir = path.join(this.snapshotsDir, manifest.id);
        await mkdir(snapshotDir, { recursive: true });
        await writeFile(path.join(snapshotDir, `${Date.now()}.html`), snapshotHtml, "utf8");
      }
      return { id: manifest.id, dir };
    });
  }

  getProject(id: string): ProjectRecord | undefined {
    return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRecord | undefined;
  }

  listProjects(): ProjectRecord[] {
    return this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as ProjectRecord[];
  }

  deleteProject(id: string): void {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    void rm(path.join(this.projectsDir, id), { recursive: true, force: true });
    void rm(path.join(this.snapshotsDir, id), { recursive: true, force: true });
  }

  recordRun(input: {
    projectId?: string;
    startedAt: string;
    durationMs?: number;
    success: boolean;
    answer?: string;
    data?: Record<string, unknown>;
    validation?: unknown;
    repaired?: boolean;
    issues?: string[];
  }): number {
    const result = this.db.prepare(
      `INSERT INTO runs (project_id, started_at, duration_ms, success, answer, data, validation, repaired, issues)
       VALUES (@project_id, @started_at, @duration_ms, @success, @answer, @data, @validation, @repaired, @issues)`
    ).run({
      project_id: input.projectId ?? null,
      started_at: input.startedAt,
      duration_ms: input.durationMs ?? null,
      success: input.success ? 1 : 0,
      answer: input.answer ?? null,
      data: input.data ? JSON.stringify(input.data) : null,
      validation: input.validation ? JSON.stringify(input.validation) : null,
      repaired: input.repaired ? 1 : 0,
      issues: input.issues ? JSON.stringify(input.issues) : null
    });
    return Number(result.lastInsertRowid);
  }

  listRuns(projectId: string, limit = 50): RunRecord[] {
    return this.db.prepare("SELECT * FROM runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all(projectId, limit) as RunRecord[];
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as SettingRecord | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(key, value, value);
  }

  deleteSetting(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  reset(): void {
    this.db.exec("DELETE FROM runs; DELETE FROM projects; DELETE FROM settings;");
    void rm(this.projectsDir, { recursive: true, force: true });
    void rm(this.snapshotsDir, { recursive: true, force: true });
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDataDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  return path.join(home, ".parsewright");
}

export async function ensureDataDir(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, "projects"), { recursive: true });
  await mkdir(path.join(dir, "snapshots"), { recursive: true });
  return dir;
}

export async function saveProject(input: {
  rootDir: string;
  manifest: ParsewrightManifest;
  result: Record<string, unknown>;
  snapshotHtml: string;
}): Promise<SavedProject> {
  const dir = path.join(input.rootDir, input.manifest.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(input.manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(dir, "latest-result.json"), `${JSON.stringify(input.result, null, 2)}\n`, "utf8");
  await writeFile(path.join(dir, "snapshot.html"), input.snapshotHtml, "utf8");
  return { id: input.manifest.id, dir };
}

export async function loadManifest(dir: string): Promise<ParsewrightManifest> {
  const text = await readFile(path.join(dir, "manifest.json"), "utf8");
  return JSON.parse(text);
}
