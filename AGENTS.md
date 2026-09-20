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

- `runtime/annotate.js`: annotate elements, frame contents, and SVG parts; store per page URL; copy as tuicr.
  `window.HTML_ANNOTATE` sets the unit selectors and navigation for a page that is not a deck.
- `runtime/contrast.js`: `H` toggles `html.hc`, overrides the colour variables, injects the same into frames.
- `runtime/frame-fit.js`: `SlideFrameFit.geometry` and `attach`, a 1920 × 1080 canvas fitted into a host.
- `htmltools/bundle.py`: `Bundler(root).write(source, output)` inlines local assets as data URIs and adds the
  focus bridge that frames use to hand Escape and Tab back to the parent.
- `htmltools/export.py`: `export(source, destination, folders)` with the manifest check.
- `htmltools/__main__.py`: the `export` and `bundle` commands.
- `openspec/`: spec-driven changes. `extract-html-tools-runtime` records the split from slides.

Plain browser JavaScript and the Python standard library. No package manager, no build step. Every runtime
file exports its pure functions through `module.exports` when loaded by node, so the tests need no browser.

## Validation

- `python3 -m unittest discover -s tests -v`: bundling and export.
- `node --test tests/`: the tuicr format and the frame geometry.
- `openspec validate --all --strict`: the change tree.
- `prek run --all-files`: the same two test commands, from `.pre-commit-config.yaml`.

## Operations

- Export into a consumer: `python3 -m htmltools export <consumer>/vendor/html-tools`. Commit the export
  with its manifest in the consumer.
- Change a runtime file here, run the tests, then re-export into each consumer. Never edit a vendored copy.
- jj owns writes; git is a read-only view. Commit with the model identity and a `Co-Authored-By` trailer for
  the owner. The owner seals with `rune sign submit main` and `rune sign next`.

## Hazards

1. **Editing a vendored copy.** The export refuses the next update and the fix is lost on re-export. Edit
   here, re-export.
2. **Changing the tuicr line format or the storage keys.** `formatTuicr` output is consumed by review tools,
   and the `slides.annotations:` and `slides.contrast:` keys hold notes already saved in browsers.
3. **Renaming the frame bridge messages.** `slidekit:escape` and `slidekit:focus-parent` are the protocol a
   consumer's deck script listens for.
4. **Testing selectors without a browser.** The node tests cover pure functions only. A change to the DOM
   code needs a page opened with `?annotate=1` or `?hc=1`.
