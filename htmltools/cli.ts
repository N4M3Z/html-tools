#!/usr/bin/env bun
// Export the runtime and tools into a consumer, bundle one page into a single file, or print a page's prose.
//
//   bun htmltools/cli.ts export /path/to/consumer/vendor/html-tools
//   bun htmltools/cli.ts bundle page.html page-share.html
//   bun htmltools/cli.ts prose page.html [more.html] > prose.md
//   bun htmltools/cli.ts cast stream.jsonl out.cast [--prompt prompt.txt] [--max-gap 2] [--speed 2]
//                             [--cols 120] [--rows 36] [--title "…"] [--trim last-workflow]
//   bun htmltools/cli.ts concepts concepts.jsonld concepts.json [--languages en,cs] [--manifest concepts-manifest.json]
//                             [--download concepts.jsonld]
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Bundler } from "./bundle.ts";
import { convert } from "./cast.ts";
import { conceptManifest, fromJsonLd, serialize } from "./concepts.ts";
import { exportInto } from "./export.ts";
import { extract } from "./prose.ts";

function flags(args: string[]): { positional: string[]; named: Record<string, string> } {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { named[args[i].slice(2)] = args[i + 1] ?? ""; i++; }
    else positional.push(args[i]);
  }
  return { positional, named };
}

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
  if (command === "cast") {
    const { positional, named } = flags(rest);
    if (positional.length === 2) {
      const result = convert(readFileSync(positional[0], "utf8"), {
        prompt: named.prompt ? readFileSync(named.prompt, "utf8") : undefined,
        maxGap: named["max-gap"] ? Number(named["max-gap"]) : undefined,
        speed: named.speed ? Number(named.speed) : undefined,
        cols: named.cols ? Number(named.cols) : undefined,
        rows: named.rows ? Number(named.rows) : undefined,
        title: named.title,
        trim: named.trim === "last-workflow" ? "last-workflow" : "none",
      });
      writeFileSync(positional[1], result.cast);
      console.log(JSON.stringify({ output: positional[1], events: result.events, agents: result.agents, seconds: result.seconds }));
      return 0;
    }
  }
  if (command === "concepts") {
    const { positional, named } = flags(rest);
    if (positional.length === 2) {
      const input = readFileSync(positional[0]);
      const data = fromJsonLd(JSON.parse(input.toString("utf8")), {
        languages: named.languages ? named.languages.split(",").map((language) => language.trim()).filter(Boolean) : undefined,
        downloads: named.download ? [{ label: "JSON-LD", href: named.download }] : undefined,
      });
      const output = serialize(data);
      writeFileSync(positional[1], output);
      const manifest = conceptManifest({ [basename(positional[0])]: input }, { [basename(positional[1])]: output }, data);
      if (named.manifest) writeFileSync(named.manifest, serialize(manifest));
      console.log(JSON.stringify({ output: positional[1], ...manifest.counts }));
      return 0;
    }
  }
  console.error("usage: bun htmltools/cli.ts export <dest> | bundle <page> <output> | prose <page>... | cast <stream.jsonl> <out.cast> [flags] | concepts <in.jsonld> <out.json> [flags]");
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
