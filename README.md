# html-tools

Browser runtime and tooling for any HTML page: element annotations with an edit mode, a command palette and
a command pane, high contrast, a fitted preview frame, a terminal-recording player, a single-file bundler, a
prose extractor for Vale, and a hash-checked export into consumers.

Plain browser JavaScript for the runtime, TypeScript on bun for the tools. No package manager, no build step.

## Use

Run from this repository:

```sh
bun test
```

Export the runtime and tools into a consumer:

```sh
bun htmltools/cli.ts export /path/to/consumer/vendor/html-tools
```

The export writes `runtime/*.js`, `htmltools/*.ts`, and `manifest.json` with a sha256 digest per file.
An update stops if an exported file has local changes. Revert the edit, or keep a copy outside the export.

Bundle one page with every local asset inlined:

```sh
bun htmltools/cli.ts bundle page.html page-share.html
```

The page's directory is the asset root. Assets outside it, cycles, `srcset`, and module scripts stop the build.
A link to a local page becomes a preview, `data-modal="<data URL>" href="#preview"`, because a browser refuses
to open a data URL in a new tab. The page's own modal, such as the html-slides shell, opens it in place.

Extract a page's visible prose for a linter:

```sh
bun htmltools/cli.ts prose page.html figures/*.html > prose.md
vale prose.md
```

One block per line, one `## id` per section, scripts, styles and code dropped, SVG labels kept, so a Vale
finding's line maps back to one block.

Turn a Claude Code event stream into a recording for the cast player:

```sh
claude -p --verbose --output-format stream-json --allowedTools Agent WebFetch < prompt.txt > stream.jsonl
bun htmltools/cli.ts cast stream.jsonl run.cast --prompt prompt.txt --max-gap 2 --speed 2
```

The cast keeps the real order and timing of the run. Each subagent prints in its own colour behind a `track N`
prefix, a Workflow run's agents come from its progress events, and `# Scenario:` lines name the chapters.
`--max-gap` shortens silent gaps, `--speed` plays the whole cast faster, and `--trim last-workflow` drops a
failed first attempt. A sandbox without a pseudo-terminal can still make this recording, where `asciinema rec`
cannot.

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

Press `E` while annotating, or the Edit button, and a click makes an element's text editable in place. Leaving
it records the change as a SUGGESTION, `replace “before” with “after”`, so the copied notes carry the exact
words and an agent applies them to the source. The page itself is not saved. While the panel is open the
script sets `--inset-right` on `<html>` to the panel's width and fires a resize event, so a page that fits
itself to the window can move aside.

## Commands, palette and pane

Load `runtime/palette.js`, then `runtime/pane.js`. Commands come from `window.HTML_COMMANDS`: an array of
`{ label, hint, run, group, here, state }` entries, or functions that return such arrays when a list opens. `state`
is optional: a function that returns whether the command's mode is on, for a host that shows it. Any
script pushes onto it, before or after these load, and `HtmlCommands.all()` flattens it. The annotation and
contrast scripts register their own commands under the group `modes`. `⌘K`, `Ctrl+K` or `/` opens the
palette: type to filter, arrows move, Enter runs, Escape closes. `C` opens the pane: every command, grouped
by `group` in order of first appearance, always visible while open, with `here: true` entries marked. The
pane sets `--inset-right` while open, like the annotation panel.

## High contrast

Load `runtime/contrast.js`. Press `H` or open the page with `?hc=1`. The ground turns pure black, ink white,
muted and line colours brighter, accents brighter. The page's colour variables (`--void`, `--ink`, `--mut`,
`--faint`, `--line`, `--cyan`, `--gold`, `--red`, `--green`) are overridden on `html.hc`, and inline SVG art
with the same literal colours is lifted. The overrides are injected into every same-origin frame, now and as
frames load, and the frame's root gets the `hc` class. The choice persists per page URL. The script also adds a
"High contrast" entry to `window.HTML_COMMANDS` for a command palette that reads it. With `theme.js` loaded, the
active theme supplies the set, so high contrast on a light theme stays light.

## Themes

Load `runtime/theme.js` before `contrast.js`. Three themes: Night, the page's own dark palette and the default,
Day, a light ground, and Dusk, a slate ground. Press `T` to cycle them, open the page with `?theme=day`, or
run "Theme · Day" from the palette, which shows the active theme as on. The choice persists per page URL under
`slides.theme:<path>`. With nothing saved, Night applies, whatever the system's `prefers-color-scheme` says.

A theme overrides the colour variables on `html[data-theme="…"]` and injects them into every same-origin frame.
Night injects nothing, so a page on Night renders as it did without the script. Literal colours of the Night
palette in SVG `fill`, `stroke` and `stop-color` attributes repaint as the matching variable at the same alpha,
with zero specificity, so a stylesheet rule that paints the element still wins. Brand colours stay. Each theme
names its own high-contrast set, which `contrast.js` reads through `SlideTheme.contrast()`: Day turns white with
black ink, and Dusk keeps the black set. The two toggles compose in any order. Floating panels such as the
palette read `--surface` for their ground, with `#0b1220` as the fallback.

## Fit a preview frame

Load `runtime/frame-fit.js` before the script that owns the frame. `SlideFrameFit.attach(frame, host, button)`
scales a 1920 × 1080 frame into the host and keeps it there on resize. The button toggles between the fitted
canvas and the window size. `geometry(width, height, fitted)` is the pure calculation.

## Play a terminal recording

Load `runtime/cast-player.js` and hand it an asciinema v2 cast as text:

```html
<div id="proof"></div>
<script type="text/plain" id="proof-cast">{"version": 2, "width": 100, "height": 30}
[0.0, "o", "..."]</script>
<script>CastPlayer.attach(document.getElementById('proof'), document.getElementById('proof-cast').textContent);</script>
```

The player renders the screen at the playhead, with a Play/Pause button, a scrubber, the elapsed time, and the
scene the playhead is in. A scene is a line `# Scenario: <title>` in the recording, which is what the
AcceptanceTesting driver prints at the start of each scene, so a proof names its own chapters. The scene list
under the screen jumps to a scene. A click on the screen pauses or resumes, as does Space, and a paused
screen says so in its corner. The arrow keys move between scenes.
`parse`, `scenes`, `sceneAt`, `render`, and `controller` are the pure parts. The controller takes the clock as
an argument, so playback is testable without a browser. A GIF cannot pause with position, so a page that shows a
proof plays the cast and keeps the GIF for places that render images only.

## Consumers

[html-slides](https://github.com/N4M3Z/html-slides) vendors this repository at `vendor/html-tools/` and
builds its decks on it. A consumer never edits the vendored copy: it changes this repository and re-exports.
