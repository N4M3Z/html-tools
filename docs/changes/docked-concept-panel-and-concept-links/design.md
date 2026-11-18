# Design

## Parts

| File | Global | Change |
| --- | --- | --- |
| `runtime/concept-atlas.js` | `ConceptAtlas` | `dock`, `follow`, `select`, `scopeNote`, `hiddenLabel` |
| `runtime/concept-links.js` | `ConceptLinks` | New: links from unit text to the panel |
| `runtime/pane.js` | `HtmlPane` | `⌘P`, `Ctrl+P`, the group `slides` last, the right-edge event |
| `runtime/annotate.js` | `SlideAnnotate` | Starts when storage is blocked |
| `runtime/companion-pages.css` | none | The docked panel, the scope note |
| `htmltools/concepts.ts` | none | `skos:scopeNote` and `skos:hiddenLabel` |

## The docked panel

The modal panel and the docked panel are one `<dialog>` element. The modal panel opens with `showModal()` and
takes the focus. The docked panel opens with `show()` and gives the focus back to the page.
The page then keeps its keys: the arrows still move a deck while the panel is open.

The docked panel stops a key on its way to the page in two cases only: the key is typed in a field, or the key
is Enter or Space, which press the button that has the focus. A click in the panel never reaches the page.

The panel measures its width when it opens and writes it to `--inset-right` on `<html>`, then fires a resize
event. This is the contract that the command pane and the annotation panel already use.

## One panel on the right edge

The command pane, the annotation panel and the docked concept panel take the same edge.
A panel that opens there dispatches `html-tools:side-panel` on the document. `detail.owner` is its name:
`pane` for the command pane, the element id for a concept panel.
The pane and the docked concept panel close when they hear another owner. The annotation panel does not
listen: it belongs to a mode, and a mode does not end because a panel opens.

## The unit on view

The panel asks the page for the unit on view through the `unit` option. It asks again on `hashchange`, on a
change of `<html lang>`, and on the document event that `follow` names. The default is `slidekit:slide`, the
event of the html-slides shell, which changes the address without a `hashchange` event.

## Concept links

| Step | Rule |
| --- | --- |
| Concepts | The concepts that the data lists on the unit |
| Names | Preferred label, other names, hidden names, in the language of the page |
| Match | A whole word, any case, any white space between the words of a name |
| Plural | An English name also matches with `s` or `es` |
| Order | The concept with the longest name takes its words first |
| Link | The first mention of each concept in reading order |
| Places | `p, li, td, th, dd, figcaption, blockquote, .card` |
| Never | A heading, a link, a control, code, a figure, an editable element |

Every mention of a concept keeps its words, also a mention that gets no link.
So the concept `tide` gets no link inside a later `spring tide`.

A word boundary is a place with no letter and no digit on the other side, in any script.
A language with inflection has many forms of one word. The data lists them as `hiddenLabel`, which no view shows.

A unit can hold alternatives and show one of them. Each element that matches `part`, by default
`[data-version]`, gets its own first mentions, so a link never stands only in a part that is hidden.

A link is a `<span class="concept-link" role="button" tabindex="0">` with the definition as its title.
A click, Enter or Space opens the panel through `panel.select(id)`. In annotate mode the link does nothing,
so the click makes a note.

## Data

| Name | Form | Shown | Read by |
| --- | --- | --- | --- |
| `scopeNote` | A text for each declared language | Under the definition | Search |
| `hiddenLabel` | A list of names for each language | Never | Search, concept links |

Both are optional. `scopeNote` follows the rule of `definition`: when a concept has one, it has a text for each
declared language.

## The pane keys

| Key | Outside a field | In a field |
| --- | --- | --- |
| `C` | Toggle | Stays with the field |
| `⌘P` | Toggle | Toggle |
| `Ctrl+P` | Toggle | Stays with the field |
| `Escape` | Close when open | Stays with the field |

`Ctrl+P` moves the cursor in a field on macOS, so the field keeps it.
