## Context

See proposal.md for motivation. Slides extracted this code from a workshop in `extract-shared-workshop-runtime`
and already offers consumers an export with a hash manifest. This change applies the same move one level up:
the page-generic part leaves slides, and slides consumes it through the export it already ships.

## Goals / Non-Goals

Goals: one source for page-generic annotation, contrast, frame fitting, bundling, and export. No file exists in
two repositories.
Non-goals: a package on a registry, a TypeScript port, or a change to the tuicr line format, the manifest
format, or the storage keys that hold notes already saved in browsers.

## Decisions

- Decide each file by reading it. A file that references slides, tracks, presenter notes, lessons, stages, or
  the deck's DOM stays in slides. `theme.css`, `variants.css`, `palette.js`, `lint.py`, `lint.ts`, and
  `parity.py` stay for that reason.
- `annotate.js` moves. Its purpose is page-generic and its only deck coupling is the pair of selectors for the
  units and the unit on view, plus the hash navigation. Those become `window.HTML_ANNOTATE` with the deck
  shape as the default, so slides sees no behaviour change.
- `contrast.js` moves. It overrides colour variables by name and lifts literal colours; it needs no deck DOM.
- Keep `window.SlideAnnotate`, `window.SlideContrast`, `window.SLIDE_COMMANDS`, and `SlideFrameFit`. The
  slides palette and picker call them.
- Keep the `slidekit:escape` and `slidekit:focus-parent` bridge messages. The slides deck script listens for
  them.
- The Python package is `htmltools`. The export folder list defaults to `runtime` and `htmltools` and a
  consumer passes its own.
- A consumer vendors this repository into `vendor/html-tools/` and imports the Python modules from there. It
  does not re-export them to its own consumers; those vendor this repository too.

## Risks / Trade-offs

- The selector change in `annotate.js` is covered by node tests for the pure functions only. The DOM code
  needs one browser check with `?annotate=1` on a deck.
- Two vendor directories per deck (slides and html-tools) instead of one. The alternative, slides re-exporting
  files it does not own, would put one file in two manifests.

## Migration Plan

Create this repository, move the files, run the tests. In slides: delete the moved files, export from here
into `vendor/html-tools/`, point imports and script tags at the vendored copy, run the tests, record the
dependency in an openspec change. Push both `main` bookmarks; the owner seals.
