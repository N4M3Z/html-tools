## Why

The slides repository held browser tooling that is not about slides: element annotations, high contrast, a
fitted preview frame, a single-file bundler, and a hash-checked export. Any HTML page can use them, and a
second consumer would have copied them from slides. This change gives them one home.

## What Changes

- Create this repository with the runtime files and Python modules moved out of slides.
- Make the annotation script take its unit selectors and navigation from `window.HTML_ANNOTATE`, with a
  slide deck as the default shape.
- Make the export take the folder list as a parameter, so a consumer exports its own tree with the same tool.
- Add `python3 -m htmltools export <destination>` and `python3 -m htmltools bundle <page> <output>`.
- Move the tests that cover the moved modules, split from the slides test files.
- Make slides the first consumer: it vendors this repository at `vendor/html-tools/` and deletes its copies.

## Capabilities

### New Capabilities

- `html-annotation`: element annotations on any HTML page, copied out as tuicr review comments.
- `html-tooling`: high contrast, fitted preview frame, single-file bundling, and hash-checked export.

### Modified Capabilities

None. This is the repository's first change.

## Impact

Slides loses `runtime/annotate.js`, `runtime/contrast.js`, `runtime/frame-fit.js`, `slidekit/bundle.py`,
`slidekit/export.py`, and their tests, and gains `vendor/html-tools/` with a manifest. Decks that load the
moved runtime files vendor this repository next to slides. The manifest format and the tuicr line format do
not change. The slide-specific runtime, lint, parity, outline, and stage tools stay in slides.
