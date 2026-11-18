// Turn expanded JSON-LD with SKOS concepts into the data of the concept atlas, with a hash manifest.
//
// The input is JSON-LD in expanded form: full IRIs as keys, a list or an object with "@graph". This tool has no
// JSON-LD processor, so it does not read a "@context". Expand the document first when it has one.
// A unit is a node that a concept names with rdfs:seeAlso, or a node that names a concept with schema:about
// or dct:subject. Its id is dct:identifier, else the last part of its IRI.
import { createRequire } from "node:module";
import { digest } from "./export.ts";

const atlas = createRequire(import.meta.url)("../runtime/concept-atlas.js");

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCT = "http://purl.org/dc/terms/";
const SCHEMAS = ["https://schema.org/", "http://schema.org/"];

type Node = Record<string, unknown> & { "@id"?: string };
type Texts = Record<string, string>;
export type ConceptOptions = { languages?: string[]; downloads?: { label: string | Texts; href: string }[] };
export type ConceptManifest = {
  schema: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  counts: { concepts: number; units: number; relations: number };
};

const list = (value: unknown): unknown[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const values = (node: Node, ...keys: string[]): Record<string, unknown>[] =>
  keys.flatMap((key) => list(node[key])).map((item) => (typeof item === "object" && item !== null ? item : { "@value": item }) as Record<string, unknown>);
const refs = (node: Node, ...keys: string[]): string[] => values(node, ...keys).map((item) => item["@id"]).filter((id): id is string => typeof id === "string");
const schema = (name: string): string[] => SCHEMAS.map((base) => base + name);

// The last part of an IRI: the fragment, else the last path segment.
export function localName(iri: string): string {
  const tail = iri.includes("#") ? iri.slice(iri.lastIndexOf("#") + 1) : iri.replace(/\/+$/, "").split("/").pop() ?? "";
  return decodeURIComponent(tail).replace(/[^A-Za-z0-9._:-]/g, "-");
}

function texts(node: Node, ...keys: string[]): Texts {
  const found: Texts = {};
  for (const item of values(node, ...keys)) {
    const language = item["@language"];
    if (typeof language === "string" && typeof item["@value"] === "string" && !(language in found)) found[language] = item["@value"];
  }
  return found;
}

function lists(node: Node, key: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const item of values(node, key)) {
    const language = item["@language"];
    if (typeof language === "string" && typeof item["@value"] === "string") (found[language] ??= []).push(item["@value"]);
  }
  return found;
}

function types(node: Node): string[] {
  return [...list(node["@type"]).filter((type): type is string => typeof type === "string"), ...refs(node, RDF + "type")];
}

// The atlas data of a document. Throws an error that names the bad record when the result is not valid.
export function fromJsonLd(document: unknown, options: ConceptOptions = {}): Record<string, unknown> {
  const graph = (Array.isArray(document) ? document : list((document as Node)?.["@graph"] ?? document)) as Node[];
  const nodes = new Map<string, Node>();
  for (const node of graph) if (node && typeof node["@id"] === "string") nodes.set(node["@id"], node);
  const conceptNodes = [...nodes.values()].filter((node) => types(node).includes(SKOS + "Concept"));
  const conceptId = new Map(conceptNodes.map((node) => [node["@id"]!, localName(node["@id"]!)]));

  const unitConcepts = new Map<string, Set<string>>();
  const note = (unit: string, concept: string) => {
    if (conceptId.has(unit)) return;
    if (!unitConcepts.has(unit)) unitConcepts.set(unit, new Set());
    unitConcepts.get(unit)!.add(concept);
  };
  for (const node of conceptNodes) for (const unit of refs(node, RDFS + "seeAlso")) if (nodes.has(unit)) note(unit, node["@id"]!);
  for (const node of nodes.values()) {
    for (const concept of refs(node, ...schema("about"), DCT + "subject")) if (conceptId.has(concept)) note(node["@id"]!, concept);
  }
  const unitRecords = [...unitConcepts.keys()].map((iri) => {
    const node = nodes.get(iri)!;
    const identifier = values(node, DCT + "identifier")[0]?.["@value"];
    const position = Number(values(node, ...schema("position"))[0]?.["@value"]);
    return { iri, position, id: identifier == null ? localName(iri) : String(identifier), title: texts(node, DCT + "title", ...schema("name")) };
  });
  unitRecords.sort((a, b) => (Number.isFinite(a.position) && Number.isFinite(b.position) ? a.position - b.position : 0)
    || a.id.localeCompare(b.id, "en", { numeric: true }));

  const concepts = conceptNodes.map((node) => {
    const iri = node["@id"]!;
    const inside = (key: string) => refs(node, SKOS + key).filter((target) => conceptId.has(target)).map((target) => conceptId.get(target)!).sort();
    const units = unitRecords.filter((unit) => unitConcepts.get(unit.iri)!.has(iri)).map((unit) => unit.id);
    const altLabel = lists(node, SKOS + "altLabel"), hiddenLabel = lists(node, SKOS + "hiddenLabel");
    const scopeNote = texts(node, SKOS + "scopeNote");
    return {
      id: conceptId.get(iri)!, prefLabel: texts(node, SKOS + "prefLabel"), definition: texts(node, SKOS + "definition"),
      ...(Object.keys(scopeNote).length ? { scopeNote } : {}),
      ...(Object.keys(altLabel).length ? { altLabel } : {}), ...(Object.keys(hiddenLabel).length ? { hiddenLabel } : {}),
      broader: inside("broader"), related: inside("related"), units,
    };
  }).sort((a, b) => a.id.localeCompare(b.id, "en"));

  const found = [...new Set(concepts.flatMap((concept) => Object.keys(concept.prefLabel)))].sort();
  const result: Record<string, unknown> = {
    schema: atlas.SCHEMA,
    languages: options.languages?.length ? options.languages : found,
    units: unitRecords.map(({ id, title }) => ({ id, title })),
    concepts,
    ...(options.downloads?.length ? { downloads: options.downloads } : {}),
  };
  atlas.normalize(result);
  return result;
}

// The digests of the input and the output, and the counts of what the output holds.
export function conceptManifest(inputs: Record<string, Uint8Array | string>, outputs: Record<string, Uint8Array | string>, data: Record<string, unknown>): ConceptManifest {
  const hashes = (files: Record<string, Uint8Array | string>) => Object.fromEntries(Object.keys(files).sort().map((name) => [name, digest(files[name])]));
  const normal = atlas.normalize(data);
  return {
    schema: "html-tools-concept-manifest/v1",
    inputs: hashes(inputs),
    outputs: hashes(outputs),
    counts: { concepts: Object.keys(normal.concepts).length, units: Object.keys(normal.units).length, relations: normal.relations.length },
  };
}

export const serialize = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
