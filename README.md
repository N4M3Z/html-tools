# html-tools

Browser runtime and Python tooling for any HTML page: element annotations, high contrast, a fitted preview
frame, a single-file bundler, and a hash-checked export into consumers.

Plain browser JavaScript and the Python standard library. No package manager, no build step.

## Use

Run from this repository:

```sh
python3 -m unittest discover -s tests -v
node --test tests/
```

Export the runtime and tools into a consumer:

```sh
python3 -m htmltools export /path/to/consumer/vendor/html-tools
```

The export writes `runtime/*.js`, `htmltools/*.py`, and `manifest.json` with a sha256 digest per file.
An update stops if an exported file has local changes. Revert the edit, or keep a copy outside the export.

Bundle one page with every local asset inlined:

```sh
python3 -m htmltools bundle page.html page-share.html
```

The page's directory is the asset root. Assets outside it, cycles, `srcset`, and module scripts stop the build.

## Annotate a page

Load `runtime/annotate.js` after the page's own script. Press `A` (or open the page with `?annotate=1`),
click any element in the unit on view, pick ISSUE, NOTE, SUGGESTION or PRAISE with `Option+1` to `Option+4`,
type the note, press Enter. Paste a screenshot into the note box to attach it. Notes persist in the browser per
page path and show as badges in annotate mode only. Elements inside same-origin figure frames and parts of an
inline SVG can be annotated. Copy puts a tuicr review comment on the clipboard: one numbered `**[KIND]**` line
per note with the unit id and the element's address.

The page is a sequence of units with one on view. The defaults are a slide deck: units match `.slide`, the
one on view matches `.slide.active`, and a unit is reached by the `#N` hash. Another page shape sets this
before the script loads:

```html
<script>window.HTML_ANNOTATE = { unit: "article", active: "article.current", goTo: function (i) { /* show unit i */ } };</script>
```

## High contrast

Load `runtime/contrast.js`. Press `H` or open the page with `?hc=1`. The ground turns pure black, ink white,
muted and line colours brighter, accents brighter. The page's colour variables (`--void`, `--ink`, `--mut`,
`--faint`, `--line`, `--cyan`, `--gold`, `--red`, `--green`) are overridden on `html.hc`, and inline SVG art
with the same literal colours is lifted. The overrides are injected into every same-origin frame, now and as
frames load. The choice persists per page URL. The script also adds a "High contrast" entry to
`window.SLIDE_COMMANDS` for a command palette that reads it.

## Fit a preview frame

Load `runtime/frame-fit.js` before the script that owns the frame. `SlideFrameFit.attach(frame, host, button)`
scales a 1920 × 1080 frame into the host and keeps it there on resize. The button toggles between the fitted
canvas and the window size. `geometry(width, height, fitted)` is the pure calculation.

## Consumers

[slides](https://github.com/N4M3Z/slides) vendors this repository at `vendor/html-tools/` and builds its
decks on it. A consumer never edits the vendored copy: it changes this repository and re-exports.
