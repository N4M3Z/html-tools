# Companion pages

## Why

A talk or a page set has pages beside its units: a dictionary, a concept atlas, and a library of media and sources.
One talk wrote these pages by hand, with its own data loader, search, and link code in each script.
That code names the talk, builds HTML from strings, and supports two fixed languages.
Another page set cannot use it without a copy, and a fix in one copy does not reach the others.

## What Changes

- Add `runtime/companion-pages.js`, global `CompanionPages`: search folding, order per language, address fields,
  link safety, and data checks that name the bad record.
- Add `runtime/concept-atlas.js`, global `ConceptAtlas`: an atlas view, a dictionary view, and a panel over another page.
- Add `runtime/asset-library.js`, global `AssetLibrary`: an assets view and a references view.
  The references view keeps corrections in a list that is separate from the sources.
- Add `runtime/companion-pages.css` with the styles of all views.
- Define two JSON formats, `html-tools-concept-atlas/v1` and `html-tools-asset-library/v1`. The concept format uses SKOS names.
- Add `htmltools/concepts.ts` and the `concepts` command: expanded JSON-LD with SKOS to the atlas data, with a hash manifest.
- Add the `.jsonld` suffix to the default export, so a consumer gets the concept source with the atlas data.
- Add five template pages with sample data, and a `companionData` list in the template manifest.

## Impact

Each view reads its language through `LanguageCopy`. This change adds no second language helper.
The default export takes every script and stylesheet under `runtime/`, so the three scripts reach consumers with no other change.
A consumer that has a `.jsonld` file in an exported folder gets that file in its next export.
The template order test now applies its `demo.js` rule only to a page that loads `demo.js`.
The panel does not follow keys from inside a frame. A deck that needs this forwards the key to its own window.
The node tests cover the pure functions. A browser review of the views stays a separate task.
