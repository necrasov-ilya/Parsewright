import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ParsewrightManifest } from "@parsewright/manifest";

export interface SavedProject {
  id: string;
  dir: string;
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
