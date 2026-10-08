## Why

A bundled page turns every local link into a data URL, and a browser refuses to open a data URL in a new tab.
The workshop deck worked around it in its own build script by rewriting such links into its preview modal.
The same deck's prose was linted by extracting its text with a one-off script. Both belong here.

## What Changes

- The tools move from Python to TypeScript on bun: `htmltools/bundle.ts`, `export.ts`, `prose.ts`,
  `cli.ts`, with `tests/tools.test.ts` under `bun test`. One language for the runtime and the tools, and the
  consumers' tools, which are TypeScript too, import the vendored modules directly.

- `htmltools/bundle.ts`: an `<a href>` to a local `.html` page becomes `data-modal="<data URL>"
  data-modal-kind="iframe" href="#preview"`, the shape the html-slides shell opens in place. Links that already
  carry `data-modal`, and external links, are unchanged.
- `htmltools/prose.ts` and the `prose` command: the visible prose of pages as markdown, one block per line,
  one `## id` per section, scripts, styles and code dropped, SVG labels kept, for Vale and the ai-tells style.

## Capabilities

### New Capabilities

- `page-prose`: a page's text in a shape a prose linter can read, with line numbers that map to blocks.

### Modified Capabilities

- `single-file-bundle`: local page links open as previews instead of dead data-URL tabs.

## Impact

- `tests/tools.test.ts` covers both, and the export now ships `.ts` files, so a consumer refreshes its
  vendored copy in one step. Consumers receive the change on their next export. A consumer that relied
  on local page links staying `href` links sees previews instead.
