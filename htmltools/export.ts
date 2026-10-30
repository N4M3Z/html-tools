// Export managed files into a consumer. Refuse local edits before writing any file.
//
// The manifest at `<destination>/manifest.json` records a sha256 digest per exported file. A consumer that
// edits an exported file stops the next export until it reverts the edit.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export const FOLDERS = ["runtime", "htmltools", "templates"];
export const SUFFIXES = [".ts", ".js", ".css", ".html", ".svg", ".json", ".md"];

export type Manifest = { version: number; files: Record<string, string> };

export function digest(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function exportInto(source: string, destination: string, folders: string[] = FOLDERS, suffixes: string[] = SUFFIXES): Manifest {
  source = resolve(source);
  destination = resolve(destination);
  const manifestPath = join(destination, "manifest.json");
  const prior: Record<string, string> = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest).files : {};
  const files = new Map<string, Uint8Array>();
  for (const folder of folders) {
    const dir = join(source, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isFile() && suffixes.includes(extname(name))) files.set(relative(source, path), readFileSync(path));
    }
  }
  for (const [name, expected] of Object.entries(prior)) {
    const target = resolve(destination, name);
    if (target !== destination && !target.startsWith(destination + sep)) throw new Error("Invalid export manifest path");
    if (!existsSync(target) || !statSync(target).isFile() || digest(readFileSync(target)) !== expected) throw new Error(`Export changed locally: ${name}`);
  }
  for (const [name, data] of files) {
    const target = join(destination, name);
    if (existsSync(target) && !(name in prior) && !Buffer.from(readFileSync(target)).equals(Buffer.from(data))) throw new Error(`Unmanaged file exists: ${name}`);
  }
  if (Object.keys(prior).some((name) => !files.has(name))) throw new Error("Source files were removed. Review the export before updating it.");
  for (const [name, data] of files) {
    const target = join(destination, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  const result: Manifest = { version: 1, files: {} };
  for (const name of [...files.keys()].sort()) result.files[name] = digest(files.get(name)!);
  mkdirSync(destination, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(result, null, 2) + "\n");
  return result;
}
