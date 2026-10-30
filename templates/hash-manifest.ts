// Refresh derived receipts only after verifying the immutable native package.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { digest } from "../htmltools/export.ts";

export function refreshManifest(directory: string): void {
  const root = resolve(directory), manifestPath = resolve(root, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  function bytes(path: string): Buffer {
    const target = resolve(root, path);
    if (!target.startsWith(root + sep) || target === manifestPath) throw new Error("Invalid provenance path");
    return readFileSync(target);
  }
  if (manifest.nativePackage.immutable !== true || digest(bytes(manifest.nativePackage.path)) !== manifest.nativePackage.sha256) {
    throw new Error("Native package changed. Preserve a new source revision instead.");
  }
  for (const key of ["objectIndex", "editableMaster", "derivedBuild", "slide", "preview"]) {
    manifest[key].sha256 = digest(bytes(manifest[key].path));
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

if (import.meta.main) refreshManifest(dirname(import.meta.path));
