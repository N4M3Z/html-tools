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

The export writes `runtime/*.js`, `runtime/*.css`, `htmltools/*.ts`, `templates/*`, and `manifest.json`.
The manifest records a SHA-256 digest for each exported file.
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
page path and show as badges in annotate mode only. A page in a sandboxed frame cannot read its storage: the
notes then stay in memory for the visit, and annotate mode still starts. Elements inside same-origin figure frames and parts of an
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
palette: type to filter, arrows move, Enter runs, Escape closes. `C`, `⌘P` or `Ctrl+P` opens the pane: every
command, grouped by `group` in order of first appearance, always visible while open, with `here: true` entries
marked. The group `slides`, the jump list of a deck, comes last, so the tools are on the first screen of the
pane. `⌘P` and `Ctrl+P` open the pane in place of the print dialog. Print from the browser menu. The pane sets
`--inset-right` while open, like the annotation panel.

One panel has the right edge at a time. A panel that opens there dispatches `html-tools:side-panel` on the
document with its name in `detail.owner`. The pane and the docked concept panel close when another owner opens.

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

## Step a figure from a deck

Load `runtime/frame-steps.js` in a figure page that a deck shows in a frame. The figure has its own reveal steps.

```html
<script>
  const figure = FrameSteps.attach({
    total: 4,
    identity: { figure: 'orbit', lang: 'en' },
    onPage: page => { /* show step `page` */ },
    onActive: active => player.setActive(active),
  });
  figure.markReady();
</script>
```

Every message is an object with a `type`, the identity fields, and the fields below. `P` is the `prefix`
option. The default is `slidekit:figure-`.

| Direction | Type | Fields |
| --- | --- | --- |
| figure to deck | `P + 'ready'` | `total` |
| figure to deck | `P + 'page'` | `page`, `total` |
| figure to deck | `P + 'boundary'` | `delta`, `page`, `total` |
| figure to deck | `P + 'navigate'` | `delta` |
| deck to figure | `P + 'step'` | `delta`, -1 or 1 |
| deck to figure | `P + 'step-to'` | `page` |
| deck to figure | `P + 'playback'` | `active`, a boolean |

A step before `markReady()` is ignored. A `step-to` before it waits. A step past the first or last page sends
`boundary`. The arrow keys, PageUp, PageDown, and Space send `navigate` from an embedded figure and step a
standalone page. Keys in a form field, a slider, or editable text stay with the field, as do Space and Enter on a
button or link. The figure is active when the deck said so and the document is visible. `onActive` receives each
change and `figure.active` holds the current value. The runtime never changes the manual pause intent.

The figure accepts a message only from its parent window, and ignores one with an identity field that differs
from its own. A served figure posts to its own origin and checks the origin of each message. A figure in a share
build is a data URL with an opaque origin, so it posts with `*` and relies on the parent check. Set `origin` when
the deck has another origin. A share build carries no query, so read the identity from the hash:
`new URLSearchParams(location.hash.slice(1))`.

## Bind copy in more than one language

Load `runtime/language-copy.js` and hand it a copy table, one object of key and text for each language:

```html
<h1 data-t="title"></h1>
<img src="orbit.svg" data-alt="orbitAlt">
<button data-aria="playLabel" data-t="play"></button>
<script>
  const copy = LanguageCopy.bind({
    copy: { en: { title: 'Orbit', orbitAlt: 'One orbit', play: 'Play', playLabel: 'Play the model' },
            cs: { title: 'Dráha', orbitAlt: 'Jedna dráha', play: 'Přehrát', playLabel: 'Přehrát model' } },
    fallback: 'en',
  });
  readout.textContent = copy.format(1.5); // "1.50" in English, "1,50" in Czech
</script>
```

`[data-t]` sets the text, `data-aria` sets `aria-label`, and `data-alt` sets `alt`. Text goes in through
`textContent`, never as HTML. The `attributes` option renames the three attributes. The first language comes
from the hash (`#lang=cs`), then the query (`?lang=cs`), then `<html lang>`, then `fallback`. The hash is first
because a share build carries no query. `copy.set('cs')` switches in place: the same elements get new text and
`<html lang>` changes, with no reload, so a page keeps its playback snapshot. A change of the hash does the same,
so a deck can switch a framed figure. `remember: 'hash'` or `'query'` writes the language back to the address.

A key with no text uses the fallback language, and then shows the key itself. `LanguageCopy.parity(copy)` lists
each key that a language does not have, as `{ key, missing }`. Assert that it is empty in a test.

## Companion pages: concepts and library

A page set often has pages beside its units: a dictionary, a concept atlas, and a library of media and sources.
Load `runtime/companion-pages.css`, `runtime/language-copy.js`, `runtime/companion-pages.js`, and then one or both
of `runtime/concept-atlas.js` and `runtime/asset-library.js`.

```html
<main id="content"></main>
<script>
  const fields = CompanionPages.address(location, ['unit', 'concept']);
  const view = ConceptAtlas.mount(document.getElementById('content'), {
    src: 'concepts.json', view: 'atlas', // or 'dictionary'
    unit: fields.unit, selected: fields.concept, fallback: 'en',
    unitHref: '../index.html?lang={lang}#{unit}',
    atlasHref: 'concept-atlas.html', dictionaryHref: 'concept-dictionary.html',
    words: { cs: { search: 'Hledat pojmy' } },
  });
  // After a language switch: view.update({ language: 'cs' });
</script>
```

The atlas shows the concepts on the unit that the reader came from, then the related concepts, then the others.
The selected concept has a graph of its neighbors, its relations, and links to its units. The dictionary lists every
concept with its definition, in the alphabetical order of the active language. `ConceptAtlas.panel(options)` adds a
dialog to another page. The `O` key or the `trigger` button opens it with the concepts of the unit on view.
The `unit` option is a function that returns that unit, and the default reads `unit` from the address.
`panel.select(id)` opens the panel on one concept.

With `dock: 'side'` the panel is not modal. It takes the right edge, sets `--inset-right` on `<html>` to its
width and fires a resize event, so a page that fits itself to the window moves aside. The focus stays on the
page, and the keys of the page keep their work. The panel follows the unit on view: it reads the unit again on
`hashchange` and on the document event that `follow` names, by default `slidekit:slide`. A deck uses the docked
panel as its slide map: the concepts of the slide on view, next to the slide.

```html
<script src="vendor/html-tools/runtime/concept-links.js"></script>
<script>
  const panel = ConceptAtlas.panel({ src: 'concepts.json', dock: 'side', unit: () => SlideShow.slides[SlideShow.at()].id });
  ConceptLinks.attach({ src: 'concepts.json', panel });
</script>
```

`ConceptLinks.attach(options)` reads the same data. In the text of each unit, the first mention of each concept
of that unit becomes a link that opens the panel on that concept. A mention is a whole word in any case: the
preferred label, another name, or a hidden name, in the language of the page. An English name also matches with a
plural ending. A longer name takes its words first, so `tide` gets no link inside `spring tide`. A link stands in
a paragraph, a list item, a table cell or a card, and never in a heading, a control, code or a figure. `unit` is
the selector of a unit (default: the shape in `window.HTML_ANNOTATE`, else `.slide`) and `unitId(element)` gives
its id (default: the element id). `onOpen(id, link)` replaces the panel. Annotate mode keeps its clicks.
A unit can hold alternatives and show one of them, such as the inline versions of a slide. Each element that
matches `part` (default: `[data-version]`) gets its own first mentions, so no link stands only in a hidden part.

`AssetLibrary.mount(host, { src: 'library.json', view: 'assets' })` lists each media record with its file, SHA-256
digest, source, license status, notes, and units. It has a search, a license status filter, and a unit filter.
`view: 'references'` lists the sources, and then the corrections in their own section. A correction is never in the
list of sources.

Each page reads `lang`, `unit`, and the selected `concept` or `asset` from the hash, then from the query:
`concept-atlas.html?lang=cs&unit=12` or `asset-library.html#lang=en&unit=12`. A deck writes these links, for
example in its section bar. `unitHref` is the link template from a companion page back to a unit.

The data formats are `html-tools-concept-atlas/v1` and `html-tools-asset-library/v1`. The concept format uses SKOS
names: `prefLabel` and `definition` for each language, `altLabel`, `broader`, `related`, and `units`.
Two more names are optional. `scopeNote`, a text for each language, says how this page set uses the concept, and
the views show it under the definition. `hiddenLabel`, a list of names for each language, never shows: search
and concept links read it, so a language with inflection lists its other word forms there.
[The design](docs/changes/companion-pages/design.md) has both formats and the address fields.
`validate(raw)` returns each problem with its record, such as `concepts[3] "hill" units: names "7", which does
not exist`. A view with bad data shows those lines. Search ignores case and diacritics and reads every language.
Text from the data goes in as text, and a link from the data must be `http`, `https`, or relative.

Convert expanded JSON-LD with SKOS concepts to the atlas data:

```sh
bun htmltools/cli.ts concepts concepts.jsonld concepts.json --languages en,cs --manifest concepts-manifest.json
```

The manifest has the SHA-256 digest of the input and the output. The tool has no JSON-LD processor, so the input
must be in expanded form, with full IRIs and no `@context`.

## Presentation templates

Open [templates/index.html](templates/index.html) from a server rooted at this repository or an exported directory.
The pack provides a model/readout, dominant evidence, a one-version iteration selector, and a provenance chain.
Each composition supports CS and EN. It uses the existing fitted-stage and annotation runtimes.

`runtime/model-playback.js` provides a pure controller and a browser adapter.
Playback starts by default. Parameter input keeps the clock running. Explicit pause survives language remounts.
Reduced motion defaults to paused. Optional fullscreen hides host chrome and retains model controls.

The provenance example retains an immutable native package and its digest, plus an explicitly partial object index.
Screenshots are previews, not preservation sources. No presentation importer is included.

See [templates/README.md](templates/README.md) for reuse, export, source-preservation fields,
and the browser review checklist.

## Consumers

[html-slides](https://github.com/N4M3Z/html-slides) vendors this repository at `vendor/html-tools/` and
builds its decks on it. A consumer never edits the vendored copy: it changes this repository and re-exports.
