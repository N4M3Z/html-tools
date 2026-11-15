# html-tools

> Brief: the reusable browser runtime and Python tooling for the owner's HTML pages. Element annotations that
> copy out as tuicr comments, high contrast, a fitted preview frame, a single-file bundler, and a hash-checked
> export. Consumers vendor this repository; they do not copy files from each other.

## Glossary

- **runtime**: one browser script under `runtime/`, loaded by a page after its own script.
- **unit**: one section of a page that can be on view, a slide by default; annotations record the unit id.
- **consumer**: a repository that runs `python3 -m htmltools export` into its own `vendor/html-tools/`.
- **manifest**: `manifest.json` in an export, one sha256 digest per exported file.
- **tuicr comment**: the `**[KIND]** path - text` line format the annotation copy produces.

## Architecture

- `runtime/annotate.js`: annotates elements, frame contents and SVG parts, stores notes per page URL and copies
  them as tuicr. `E` edits text in place and records a SUGGESTION. `window.HTML_ANNOTATE` sets the unit selectors and
  navigation for a page that is not a deck. The open panel sets `--inset-right` on `<html>`.
- `runtime/palette.js` and `runtime/pane.js`: the command palette (⌘K, /) and the command pane (C), both
  over `window.HTML_COMMANDS` through `HtmlCommands.all()`. Pure: `score`, `filter`, `groupCommands`.
- `runtime/contrast.js`: `H` toggles `html.hc`, overrides the colour variables, injects the same into frames.
  The set comes from `SlideTheme.contrast()` when a theme brings one, else the black constants.
- `runtime/theme.js`: `T` cycles Night, Day and Dusk on `html[data-theme]`, injects the variables into frames,
  repaints Night-palette SVG literals. Pure: `parse`, `paint`, `deckCss`, `frameCss`, `contrastSet`, `pick`, `next`.
  Load it before `contrast.js`.
- `runtime/frame-fit.js`: `SlideFrameFit.geometry` and `attach`, a 1920 × 1080 canvas fitted into a host.
- `runtime/cast-player.js`: `CastPlayer.attach(host, castText)` plays an asciinema v2 cast with pause, a
  scrubber, and the `# Scenario:` scene the playhead is in. `parse`, `scenes`, `render`, `controller` are pure.
- `runtime/frame-steps.js`: `FrameSteps.attach(options)`, the figure side of the step protocol between a framed
  figure and its deck. The type prefix (default `slidekit:figure-`) and the identity fields are options.
  Pure: `types`, `matches`, `keyDelta`, `targetOrigin`, `trusted`, `controller`.
- `runtime/language-copy.js`: `LanguageCopy.bind(options)` fills `[data-t]`, `data-aria` and `data-alt` from a copy
  table, sets `<html lang>`, formats numbers, and switches language in place. The first language comes from the
  hash, then the query, then `<html lang>`. Pure: `resolve`, `match`, `parity`, `lookup`, `format`, `href`.
- `runtime/companion-pages.js`: `CompanionPages`, the shared parts of the companion pages. Load it after
  `language-copy.js`. Pure: `fold`, `matches`, `pick`, `sortBy`, `identifier`, `safeUrl`, `address`, `href`, `fill`,
  `checker`, `assertValid`. `runtime/companion-pages.css` styles every view with the class prefix `cp-`.
- `runtime/concept-atlas.js`: `ConceptAtlas.mount(host, options)` draws the atlas or the dictionary of a page set
  from `html-tools-concept-atlas/v1` data with SKOS names, and `ConceptAtlas.panel(options)` opens the concepts of
  the unit on view over another page. Pure: `validate`, `normalize`, `context`, `search`, `neighborhood`, `shortcut`.
- `runtime/asset-library.js`: `AssetLibrary.mount(host, options)` draws asset records or references from
  `html-tools-asset-library/v1` data. Corrections are a list apart from the sources.
  Pure: `validate`, `normalize`, `filterAssets`, `filterReferences`, `statusCounts`, `mediaKind`.
- `htmltools/concepts.ts`: `fromJsonLd(document, options)`, expanded JSON-LD with SKOS as atlas data, and
  `conceptManifest`, the digests of the input and the output.
- `htmltools/bundle.ts`: `new Bundler(root).write(source, output)` inlines local assets as data URIs, turns a
  link to a local page into a `data-modal` preview, and adds the focus bridge that frames use to hand Escape
  and Tab back to the parent.
- `htmltools/export.ts`: `exportInto(source, destination, folders)` with the manifest check.
- `htmltools/prose.ts`: `extract(text, title)`, the visible prose as markdown, one block per line, for Vale.
- `htmltools/cast.ts`: `convert(streamText, options)`, a Claude Code `stream-json` log as asciicast v2 text with
  one coloured `track N` prefix per agent and `# Scenario:` chapters, plus `retime` for gap and speed changes.
- `htmltools/cli.ts`: the `export`, `bundle`, `prose`, `cast` and `concepts` commands, run with `bun htmltools/cli.ts`.
- `docs/changes/` and `docs/specs/`: the spec-driven change tree (HTML-0001 rule: the native `docs/` root, no `openspec/`).
  `extract-html-tools-runtime` records the split from slides, `cast-player-runtime` the recording player.
  `stepped-figures-and-language-copy` records the step protocol and the copy binding.
  `companion-pages` records the concept atlas, the library, their data formats, and the address format.

Plain browser JavaScript for the runtime, TypeScript on bun for the tools. No package manager, no build
step. Every runtime file exports its pure functions through `module.exports` when loaded by node, so the
tests need no browser.

## Validation

- `bun test`: bundling, export and prose in `tests/tools.test.ts`, the stream converter in `tests/cast.test.ts`,
  and the node files, the tuicr format, the frame geometry, the cast player, the step protocol, and the copy
  binding. The companion pages have `tests/companion-pages.test.cjs`, `tests/concept-atlas.test.cjs`,
  `tests/asset-library.test.cjs`, and `tests/concepts.test.ts` for the conversion, the sample data, and the export.
- `rune spec doctor` and `rune spec validate`: the change tree.
- `prek run --all-files`: the same command, from `.pre-commit-config.yaml`.

## Operations

- Export into a consumer: `bun htmltools/cli.ts export <consumer>/vendor/html-tools`. Commit the export
  with its manifest in the consumer.
- Change a runtime file here, run the tests, then re-export into each consumer. Never edit a vendored copy.
- jj owns writes; git is a read-only view. Commit with the model identity and a `Co-Authored-By` trailer for
  the owner. The owner seals with `rune sign submit main` and `rune sign next`.

## Hazards

1. **Editing a vendored copy.** The export refuses the next update and the fix is lost on re-export. Edit
   here, re-export.
2. **Changing the tuicr line format or the storage keys.** `formatTuicr` output is consumed by review tools,
   and the `slides.annotations:`, `slides.contrast:` and `slides.theme:` keys hold state already saved in browsers.
3. **Renaming the frame bridge messages.** `slidekit:escape` and `slidekit:focus-parent` are the protocol a
   consumer's deck script listens for. So are `--inset-right` and `window.HTML_COMMANDS`.
   The `slidekit:figure-` message types and their fields in `frame-steps.js` are the same kind of contract.
4. **Testing selectors without a browser.** The node tests cover pure functions only. A change to the DOM
   code needs a page opened with `?annotate=1`, `?hc=1` or `?theme=day`.
