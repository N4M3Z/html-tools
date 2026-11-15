# Design

## Parts

| File | Global | Role |
| --- | --- | --- |
| `runtime/companion-pages.js` | `CompanionPages` | Shared pure functions and two DOM helpers |
| `runtime/concept-atlas.js` | `ConceptAtlas` | Atlas view, dictionary view, panel |
| `runtime/asset-library.js` | `AssetLibrary` | Assets view, references view |
| `runtime/companion-pages.css` | none | Styles of all views, class prefix `cp-` |
| `htmltools/concepts.ts` | none | JSON-LD to atlas data, hash manifest |

A page loads `language-copy.js`, then `companion-pages.js`, then one or both view scripts.
A unit is one section of a page set, a slide by default. This is the meaning in `AGENTS.md`.

## Address format

Every companion page reads the same fields. A deck writes them into a link, for example in its section bar.

| Field | Meaning | Pages |
| --- | --- | --- |
| `lang` | Language tag | all |
| `unit` | Id of the unit that the reader came from | all |
| `concept` | Id of the selected concept | atlas, dictionary |
| `asset` | Id of the selected asset record | asset library |
| `view` | `atlas` or `dictionary`, when one page serves both views | atlas, dictionary |

Each field is in the query or in the hash. The hash is first, as in `LanguageCopy`.
A share build has no query, so it uses the hash.

```text
concept-atlas.html?lang=cs&unit=12
concept-dictionary.html#lang=cs&unit=12
concept-atlas.html?lang=en&unit=12#concept=tidal-range
asset-library.html?lang=en&unit=12
references.html#lang=en&unit=12
```

A unit id has 1 to 64 characters: letters, digits, `.`, `_`, `:`, and `-`. It starts with a letter or a digit.
A whole number in the data is the same id as its text. An id that does not fit this rule counts as no unit.
A hash without `=`, such as `#12`, is not a field. The deck converts its own unit hash to `unit=12`.

The link from a companion page back to a unit comes from the `unitHref` option of the page.
It is a template with `{unit}` and `{lang}`, for example `../index.html?lang={lang}#{unit}`.
The runtime encodes each value and drops a result that is not a safe link.
`CompanionPages.href(page, fields, where)` writes the fields, and `CompanionPages.address(location, names)` reads them.

## Concept atlas data

The format is `html-tools-concept-atlas/v1`. The names follow SKOS, so a JSON-LD export maps onto it.

```json
{
  "schema": "html-tools-concept-atlas/v1",
  "languages": ["en", "cs"],
  "units": [{ "id": "2", "title": { "en": "Two bodies pull", "cs": "Působí dvě tělesa" }, "focus": "tide" }],
  "concepts": [{
    "id": "spring-tide",
    "prefLabel": { "en": "Spring tide", "cs": "Skočné dmutí" },
    "definition": { "en": "A tide with the largest range.", "cs": "Dmutí s největší výškou." },
    "altLabel": { "cs": ["Skočný příliv"] },
    "broader": ["tide"], "related": ["neap-tide"], "units": ["2"],
    "relations": [{ "type": "measured-by", "target": "tide-gauge" }]
  }],
  "relationTypes": { "measured-by": { "en": "is measured by", "cs": "měří se pomocí" } },
  "downloads": [{ "label": "JSON-LD", "href": "concepts.jsonld" }]
}
```

- `prefLabel`, `definition`, and a unit `title` need a text for each language in `languages`.
- `broader`, `related`, `relations[].target`, and `focus` name concept ids. `units` names unit ids.
- `related` has no direction. One pair is one relation, whichever concept names it.
- `relations` holds any other relation type. Its label comes from `relationTypes`, else the type shows as it is.
- `focus` is the concept that a view selects first for that unit.
- `downloads` lists files such as the RDF, JSON-LD, or SHACL source. Each `href` is a safe link.
- `altLabel`, `focus`, `relations`, `relationTypes`, and `downloads` are optional.

## Asset library data

The format is `html-tools-asset-library/v1`.

```json
{
  "schema": "html-tools-asset-library/v1",
  "languages": ["en", "cs"],
  "licenseStatuses": [{ "id": "cleared", "label": { "en": "Cleared", "cs": "Vyřešeno" } }],
  "assets": [{
    "id": "curve-build", "units": ["1", "3"], "file": "derived-build.svg", "sha256": "<64 hex digits>",
    "title": { "en": "Curve", "cs": "Křivka" },
    "source": { "title": "Sample collection", "url": "https://example.org/curve", "author": "Sample author" },
    "license": { "status": "cleared", "name": "Sample licence", "url": "https://example.org/licence" },
    "notes": { "en": "Cropped.", "cs": "Oříznuto." }
  }],
  "references": [{ "id": "tables", "title": "Sample tables", "url": "https://example.org/tables", "units": ["3"] }],
  "corrections": [{ "id": "range", "units": ["3"], "text": { "en": "…", "cs": "…" }, "references": ["tables"] }]
}
```

- An asset needs `id`, `file`, `sha256`, and `license.status`. The status is one of the declared `licenseStatuses`.
- `sha256` is 64 lower-case hex digits. `file`, `source.url`, `license.url`, and a reference `url` are safe links.
- `title` and `notes` are optional. When present, they need a text for each language.
- A `source.title` and a reference `title` are one text or a text for each language.
- An asset with no `source` shows that no source is recorded. An asset with no units shows that no unit uses it.
- `references` and `corrections` are separate lists. A correction names the references that support it.

A correction is never an entry of `references`, and a reference is never an entry of `corrections`.
`filterReferences` returns two lists, and the view draws them in two sections with their own headings.
The corrections section has its own border, mark, and a note that a correction is a later change.

## Validation

`validate(raw)` returns every problem as `{record, field, message}`. An empty list means valid data.
The record names the collection, the index, and the id: `concepts[3] "hill" units: names "7", which does not exist`.
`normalize(raw)` throws an error with the first five problems in its message and all of them in `error.problems`.
A view that cannot load its data shows the problem lines, so the author sees which record is wrong.

## Search and order

`fold` makes text lower case, removes diacritics, and joins spaces. A query matches when the folded text has every word.
Search reads the id, the labels, the other names, and the definitions in all languages.
The order of a list comes from `Intl.Collator` for the active language, with numbers compared by value.
Czech then puts `ch` after `h`, and unit `2` comes before unit `10`.

## Language

`LanguageCopy` selects the language and gives each view its words through `lookup`.
Each runtime has English words. A page adds other languages with the `words` option, as a copy table.
A view changes language in place through `update({language})`. The panel follows `<html lang>`.
`CompanionPages.pick` reads a text for a language from the data: the language, then the first language of the data.
It reads data, where each record has its own language map. It does not select a language.

## Views

`ConceptAtlas.mount(host, options)` draws the `atlas` or `dictionary` view and returns `{update, select, ready}`.
The atlas lists the concepts on the unit, the related concepts, and the others. It shows one concept with a graph
of up to eight neighbors, the complete relation list, and its units.
The dictionary lists every concept in alphabetical order with its definition.

`ConceptAtlas.panel(options)` adds a modal dialog to the page and returns `{open, close, toggle, sync}`.
The `unit` option is a function that returns the unit on view. The default reads `unit` from the address.
The `O` key opens the panel, Escape closes it, and a key in a form field stays with the field.
The `key` option changes the key, and `trigger` names a button. The panel adds one entry to `window.HTML_COMMANDS`.

`AssetLibrary.mount(host, options)` draws the `assets` or `references` view.
The assets view has a search, a license status filter, a unit filter, and a link to each unit.

## Safety

A view writes data through `textContent` and `setAttribute`. No runtime uses `innerHTML`. A test checks this.
`CompanionPages.safeUrl` accepts `http`, `https`, and relative links. It rejects each other scheme, a control
character, a backslash, and a link that starts with `//`. A rejected link shows as plain text.

## Concept conversion

`bun htmltools/cli.ts concepts <in.jsonld> <out.json>` reads expanded JSON-LD and writes the atlas data.
`--languages en,cs` sets the languages, `--download <file>` adds one download, and `--manifest <file>` writes the manifest.
A concept is a node with the type `skos:Concept`. Its id is the last part of its IRI.
A unit is a node that a concept names with `rdfs:seeAlso`, or a node that names a concept with `schema:about` or `dct:subject`.
The unit id is `dct:identifier`, else the last part of the IRI. The unit order is `schema:position`.
The tool has no JSON-LD processor. It does not read a `@context`, and it maps only `broader` and `related`.
The manifest has the format `html-tools-concept-manifest/v1`: the digests of the input and the output, and the counts.

## Templates

| Page | View |
| --- | --- |
| `templates/concept-atlas.html` | Atlas |
| `templates/concept-dictionary.html` | Dictionary |
| `templates/concept-panel.html` | Four sample units with the panel |
| `templates/asset-library.html` | Assets |
| `templates/references.html` | Sources and corrections |

`templates/companion.js` connects the pages. `concepts.jsonld` is the sample source, and `concepts.json` is its conversion.
`library.json` describes the SVG files of the provenance example with their real digests.
`bun templates/hash-manifest.ts` refreshes the digest of each entry in `companionData` of `templates/manifest.json`.
The sample is about tides. Its sources, authors, and licences are invented.

## Limits

- The pages load their data with `fetch`, so they need a server. A page can pass the `data` option instead.
- The sample has no RDF or SHACL file. The `downloads` list accepts them.
- The panel does not listen inside frames.
- `fold` removes combining marks only. It does not change letters such as `ł` or `ß`.
