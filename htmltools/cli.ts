#!/usr/bin/env bun
// Export the runtime and tools into a consumer, bundle one page into a single file, or print a page's prose.
//
//   bun htmltools/cli.ts export /path/to/consumer/vendor/html-tools
//   bun htmltools/cli.ts bundle page.html page-share.html
//   bun htmltools/cli.ts prose page.html [more.html] > prose.md
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Bundler } from "./bundle.ts";
import { exportInto } from "./export.ts";
import { extract } from "./prose.ts";

const ROOT = dirname(dirname(import.meta.path));

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "export" && rest.length === 1) {
    const result = exportInto(ROOT, rest[0]);
    console.log(`Exported ${Object.keys(result.files).length} files`);
    return 0;
  }
  if (command === "bundle" && rest.length === 2) {
    const source = resolve(rest[0]);
    console.log(JSON.stringify(new Bundler(dirname(source)).write(source, rest[1])));
    return 0;
  }
  if (command === "prose" && rest.length >= 1) {
    console.log(rest.map((page) => extract(readFileSync(page, "utf8"), basename(page))).join("\n"));
    return 0;
  }
  console.error("usage: bun htmltools/cli.ts export <dest> | bundle <page> <output> | prose <page>...");
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
