import { afterEach, beforeEach, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { conceptManifest, fromJsonLd, localName, serialize } from "../htmltools/concepts.ts";
import { digest, exportInto } from "../htmltools/export.ts";
import { refreshManifest } from "../templates/hash-manifest.ts";

const repository = resolve(import.meta.dir, "..");
const templates = join(repository, "templates");
let temporary = "";
beforeEach(() => { temporary = mkdtempSync(join(tmpdir(), "html-tools-concepts-")); });
afterEach(() => { rmSync(temporary, { recursive: true, force: true }); });

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const text = (en: string, cs: string) => [{ "@value": en, "@language": "en" }, { "@value": cs, "@language": "cs" }];
function graph(): Record<string, unknown>[] {
  return [
    { "@id": "https://example.org/c#hill", "@type": [SKOS + "Concept"], [SKOS + "prefLabel"]: text("Hill", "Kopec"), [SKOS + "definition"]: text("A raised place.", "Vyvýšené místo."),
      [SKOS + "related"]: [{ "@id": "https://example.org/c#castle" }, { "@id": "https://example.org/c#unknown" }] },
    { "@id": "https://example.org/c#castle", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [{ "@id": SKOS + "Concept" }],
      [SKOS + "prefLabel"]: text("Castle", "Hrad"), [SKOS + "definition"]: text("A strong house.", "Pevný dům."), [SKOS + "altLabel"]: [{ "@value": "Zámek", "@language": "cs" }],
      [SKOS + "broader"]: [{ "@id": "https://example.org/c#hill" }], "http://www.w3.org/2000/01/rdf-schema#seeAlso": [{ "@id": "https://example.org/unit/b" }] },
    { "@id": "https://example.org/unit/b", "http://purl.org/dc/terms/title": text("Second", "Druhá"), "https://schema.org/position": [{ "@value": 2 }] },
    { "@id": "https://example.org/unit/a", "http://purl.org/dc/terms/identifier": [{ "@value": "1" }], "http://purl.org/dc/terms/title": text("First", "První"),
      "https://schema.org/position": [{ "@value": 1 }], "https://schema.org/about": [{ "@id": "https://example.org/c#hill" }] },
    { "@id": "https://example.org/other", "http://purl.org/dc/terms/title": text("Not a unit", "Není jednotka") },
  ];
}

test("expanded JSON-LD with SKOS concepts becomes atlas data", () => {
  expect(fromJsonLd({ "@graph": graph() }, { languages: ["en", "cs"] })).toEqual({
    schema: "html-tools-concept-atlas/v1",
    languages: ["en", "cs"],
    units: [{ id: "1", title: { en: "First", cs: "První" } }, { id: "b", title: { en: "Second", cs: "Druhá" } }],
    concepts: [
      { id: "castle", prefLabel: { en: "Castle", cs: "Hrad" }, definition: { en: "A strong house.", cs: "Pevný dům." }, altLabel: { cs: ["Zámek"] }, broader: ["hill"], related: [], units: ["b"] },
      { id: "hill", prefLabel: { en: "Hill", cs: "Kopec" }, definition: { en: "A raised place.", cs: "Vyvýšené místo." }, broader: [], related: ["castle"], units: ["1"] },
    ],
  });
  expect((fromJsonLd(graph()) as { languages: string[] }).languages).toEqual(["cs", "en"]);
  expect(localName("https://example.org/c#tidal-range")).toBe("tidal-range");
  expect(localName("https://example.org/unit/12/")).toBe("12");
  expect(localName("tag:example.org,2026:terms#A b")).toBe("A-b");
});

test("a concept with a missing text stops the conversion and names the concept", () => {
  const nodes = graph();
  (nodes[0][SKOS + "definition"] as unknown[]).pop();
  expect(() => fromJsonLd(nodes, { languages: ["en", "cs"] })).toThrow(/concepts\[1\] "hill" definition: has no text for cs/);
});

test("the conversion manifest has the digests of the input and the output", () => {
  const input = serialize({ "@graph": graph() }), data = fromJsonLd(JSON.parse(input)), output = serialize(data);
  expect(conceptManifest({ "in.jsonld": input }, { "out.json": output }, data)).toEqual({
    schema: "html-tools-concept-manifest/v1",
    inputs: { "in.jsonld": digest(input) },
    outputs: { "out.json": digest(output) },
    counts: { concepts: 2, units: 2, relations: 2 },
  });
});

test("the sample atlas data is the conversion of the sample JSON-LD, and the manifests agree", () => {
  const out = join(temporary, "concepts.json"), manifestPath = join(temporary, "concepts-manifest.json");
  const result = Bun.spawnSync([process.execPath, join(repository, "htmltools/cli.ts"), "concepts", join(templates, "concepts.jsonld"), out,
    "--languages", "en,cs", "--manifest", manifestPath, "--download", "concepts.jsonld"]);
  expect(result.exitCode).toBe(0);
  expect(readFileSync(out, "utf8")).toBe(readFileSync(join(templates, "concepts.json"), "utf8"));
  expect(readFileSync(manifestPath, "utf8")).toBe(readFileSync(join(templates, "concepts-manifest.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(templates, "manifest.json"), "utf8"));
  expect(manifest.companionData.map((entry: { path: string }) => entry.path)).toEqual(["concepts.jsonld", "concepts.json", "concepts-manifest.json", "library.json"]);
  for (const entry of manifest.companionData) expect(entry.sha256).toBe(digest(readFileSync(join(templates, entry.path))));
});

test("the manifest refresh updates the digests of the companion data", () => {
  const copy = join(temporary, "templates");
  cpSync(templates, copy, { recursive: true });
  writeFileSync(join(copy, "library.json"), "{}\n");
  refreshManifest(copy);
  const manifest = JSON.parse(readFileSync(join(copy, "manifest.json"), "utf8"));
  expect(manifest.companionData.find((entry: { path: string }) => entry.path === "library.json").sha256).toBe(digest("{}\n"));
});

test("the export carries the companion runtimes, pages and data, and each page loads its scripts in order", () => {
  const manifest = exportInto(repository, join(temporary, "vendor"));
  for (const name of ["runtime/companion-pages.js", "runtime/companion-pages.css", "runtime/concept-atlas.js", "runtime/asset-library.js", "htmltools/concepts.ts",
    "templates/concept-atlas.html", "templates/concept-dictionary.html", "templates/concept-panel.html", "templates/asset-library.html", "templates/references.html",
    "templates/companion.js", "templates/companion.css", "templates/concepts.json", "templates/concepts.jsonld", "templates/concepts-manifest.json", "templates/library.json"]) {
    expect(manifest.files[name]).toBe(digest(readFileSync(join(repository, name))));
  }
  for (const [page, runtime] of [["concept-atlas", "concept-atlas"], ["concept-dictionary", "concept-atlas"], ["concept-panel", "concept-atlas"], ["asset-library", "asset-library"], ["references", "asset-library"]]) {
    const html = readFileSync(join(templates, page + ".html"), "utf8");
    const order = ["../runtime/language-copy.js", "../runtime/companion-pages.js", `../runtime/${runtime}.js`, "companion.js"].map((source) => html.indexOf(`src="${source}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toMatch(/https?:\/\//);
  }
});

test("the sample data and the example copy name no real talk and keep language parity", () => {
  const wiring = readFileSync(join(templates, "companion.js"), "utf8");
  for (const name of ["concepts.json", "concepts.jsonld", "library.json"]) {
    const data = readFileSync(join(templates, name), "utf8");
    expect(data).not.toMatch(/uroboros/i);
    for (const link of data.matchAll(/https?:\/\/[^"\s]+/g)) expect(link[0]).toMatch(/^https?:\/\/(example\.org|www\.w3\.org|purl\.org|schema\.org)\//);
  }
  expect(wiring).not.toMatch(/uroboros/i);
  const keys = (language: string) => [...wiring.slice(wiring.indexOf(`    ${language}: {`), wiring.indexOf("    },", wiring.indexOf(`    ${language}: {`))).matchAll(/(\w+): '/g)].map((match) => match[1]).sort();
  expect(keys("cs")).toEqual(keys("en"));
  expect(keys("en").length).toBeGreaterThan(20);
});
