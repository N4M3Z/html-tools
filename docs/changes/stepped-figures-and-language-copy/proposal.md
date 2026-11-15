# Stepped figures and language copy

## Why

A deck shows a figure in a frame, and the figure has its own reveal steps.
Each figure page rewrites the same message code, key rules, and activity rules by hand.
Each page also fills its text from a copy table by hand, and each copy differs a little.
One talk carries about 600 such files. A fix in one file does not reach the others.

## What Changes

- Add `runtime/frame-steps.js`, global `FrameSteps`: the figure side of a small step protocol.
- Add `runtime/language-copy.js`, global `LanguageCopy`: text, labels, and number formats from a copy table.
- Make the type prefix and the identity fields of the protocol options. The default prefix is `slidekit:figure-`.
- Let a figure work from a data URL, where the bundler puts it in a share build.
- Read the first language from the hash, then the query, then `<html lang>`, then the fallback.
- Add a pure parity check that lists the keys a language does not have.
- Change `templates/demo.js` to read its copy through `LanguageCopy`.

## Impact

The default export already takes every script under `runtime/`, so both files reach consumers with no export change.
The five template pages load one more script. The digest of `templates/evidence.html` in the template manifest changes.
The deck side of the protocol is not part of this repository. A consumer writes it against the table in the design.
A talk that uses the prefix `uro-tool-` and the identity `tool`, `model`, `lang`, `slide` can move to this runtime
without a change on its deck side.
Browser checks stay separate from the node tests.
