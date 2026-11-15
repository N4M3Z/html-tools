# Design

## Stepped figures

A figure page calls `FrameSteps.attach(options)` and calls `markReady()` when it can draw.
The page draws a step in its `onPage` callback. It starts and stops motion in its `onActive` callback.

Every message is an object. It has a `type`, then the identity fields the page declares, then the fields below.
`P` is the type prefix. The default is `slidekit:figure-`.

| Direction | Type | Fields |
| --- | --- | --- |
| figure to deck | `P + 'ready'` | `total` |
| figure to deck | `P + 'page'` | `page`, `total` |
| figure to deck | `P + 'boundary'` | `delta`, `page`, `total` |
| figure to deck | `P + 'navigate'` | `delta` |
| deck to figure | `P + 'step'` | `delta`, -1 or 1 |
| deck to figure | `P + 'step-to'` | `page` |
| deck to figure | `P + 'playback'` | `active`, a boolean |

The figure sends `ready`, then `page` for its first page. It sends `page` after each step, also for a `step-to`
that names the current page, so the deck can confirm the page it asked for.
A step past the first or last page sends `boundary` and does not move.
A `step` before ready is ignored. A `step-to` before ready waits, and the figure opens on that page.
`emit(name, fields)` sends any other message with the same prefix and identity, such as an error report.

The prefix and the identity are options, so one runtime serves any deck.
The compatibility example is the Uroboros talk: prefix `uro-tool-` and identity `{tool, model, lang, slide}`.
A test fixes the exact messages for that case.
A message that carries an identity field with another value is ignored. A message that leaves a field out agrees.
`setIdentity` changes a field in place, for a figure that switches language without a reload.

## Origin

The figure accepts a message only when `event.source` is its parent window.
This check is the authentication. Only the parent can pass it, whatever origin the parent has.

The figure then picks one target origin, used for posts and for the check of `event.origin`:

| Figure origin | Target | Incoming origin check |
| --- | --- | --- |
| a real origin, such as `https://example.test` | the figure's own origin | must equal the target |
| opaque (`data:` URL, some `file:` pages) | `*` | none, the parent check decides |
| any, with the `origin` option set | the option value | must equal the target |

A share build turns each figure into a data URL. Its origin is opaque and serializes as `null`.
`postMessage` rejects `null` as a target, and the figure cannot name the origin of its parent.
So the figure posts with `*`, as the bundler's focus bridge already does for `slidekit:escape`.
The messages carry step counts, page numbers, and the declared identity. They carry no secret.
A deck in a share build must accept a message by its frame window, because the origin it sees is `null`.

## Keys and activity

ArrowRight, PageDown, and Space step forward. ArrowLeft and PageUp step back.
The figure leaves a key alone when Ctrl, Meta, or Alt is down, or when another handler prevented it.
It also leaves keys in a form field, a slider, or editable text, and Space or Enter on a button or link.
An embedded figure sends `navigate` and lets the deck decide. A standalone page steps itself.

The figure is active when the deck said so and the document is visible. A standalone page needs only visibility.
`onActive` receives each change, and `active` holds the current value.
A page passes that value to `ModelPlayback.attach` and calls `setActive` from the callback.
`FrameSteps` never reads or writes the manual pause intent.

## Language copy

`LanguageCopy.bind({copy, languages, fallback})` fills the page and returns `t`, `format`, `set`, and `apply`.
`[data-t]` sets text, `[data-aria]` sets `aria-label`, and `[data-alt]` sets `alt`. The names are options.
Text goes in through `textContent`. The runtime never writes HTML, so copy cannot inject markup.
A key with no text in the language uses the fallback language. With no text there, the page shows the key.
`parity(copy)` lists each such key with the languages that miss it, for a test in the consumer.

The first language comes from these places, in order:

1. the hash, `#lang=en`, read as `key=value` pairs
2. the query, `?lang=en`
3. `<html lang>`, by its full tag and then by its primary subtag
4. the fallback option

The hash comes first because the bundler refuses a query on a local reference, so a share build has none.
The query stays for served pages that already use it.

`set(language)` switches in place. It rewrites the same nodes and sets `<html lang>`, with no reload.
A page keeps its playback snapshot and its step. The runtime also follows a `hashchange` event,
so a deck can switch a framed figure with a change of the hash alone.
The `remember` option writes the language back to the hash or the query with `history.replaceState`.
It is off by default. A hash that is not `key=value` pairs, such as a deck's `#94`, stays as it is.

`format(value, places)` uses `Intl.NumberFormat` for the language with a fixed count of places and no grouping.
Czech then prints a decimal comma. An unknown language tag prints the plain fixed form.

## Template demo

`templates/demo.js` keeps its words and its remount. It reads text and number formats through `LanguageCopy`.
It keeps `data-i18n` as the text attribute and remembers the language in the query, as before.
