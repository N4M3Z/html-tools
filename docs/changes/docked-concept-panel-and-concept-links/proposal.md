# Docked concept panel and concept links

## Why

A deck showed the concepts of the slide on view in a pane beside the slide, and made each concept in the slide
text a link to that pane. Both parts were scripts of one deck, with a data format of their own.
The concept panel of this repository does the same work as a modal dialog, so the reader cannot see the slide
and its concepts together.

A second deck loaded the runtime without the deck shell and wrote its own copies of the missing tools.
Three faults showed there. Annotate mode did not start in a sandboxed frame, where the browser blocks storage.
The command pane had no key with a modifier, and the owner opens it with `⌘P`.
The pane listed one jump for each slide before the tools, so its first screen showed no tool.

## What Changes

- Add `dock: 'side'` to `ConceptAtlas.panel`: a panel on the right edge that leaves the page in use.
- Add `panel.select(id)`, which opens the panel on one concept, and the `follow` option.
- Add `runtime/concept-links.js`, global `ConceptLinks`: the first mention of a concept becomes a link to the panel.
- Add two optional names to the concept data: `scopeNote` and `hiddenLabel`. The conversion reads both from SKOS.
- Let the command pane open with `⌘P` and `Ctrl+P`, and put the jump list of a deck last.
- Add the `html-tools:side-panel` event, so one panel has the right edge at a time.
- Let `annotate.js` start when the page cannot read its storage.
- Give the view inside the panel the width of the panel.

## Impact

The default export takes every script under `runtime/`, so `concept-links.js` reaches consumers with no export change.
Data without the two new names stays valid. The format name stays `html-tools-concept-atlas/v1`.
`⌘P` and `Ctrl+P` no longer open the print dialog on a page that loads the pane. Print from the browser menu.
The pane lists the group `slides` last. A page that needs another order registers its jumps under another group.
The sample page `templates/concept-panel.html` loads one more script, and three of its texts name a concept.
A deck that has a pane of its own for concepts can move to the docked panel when its data is in the atlas format.
