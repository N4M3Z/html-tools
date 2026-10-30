# Implementation record

The owner authorized an additive reusable template pack. No commit, push, or consumer update is authorized or performed.

## Delivered behavior

- Five runnable pages: an index, model/readout, evidence composition, iteration selector, and provenance composition.
- Default navy/gold/cyan tokens and strong system sans headings. No external font or package dependency.
- Shared playback with autoplay, immediate range input, explicit pause, language remounts, and reduced-motion gates.
- One mounted iteration at a time. Optional Sources and controls replace inner presentation steps.
- Native fullscreen hides host chrome and retains model controls. Examples load the canonical annotation runtime.
- An illustrative native/master/build/slide manifest with actual digests and a partial object index.
- A preservation contract for original packages and per-slide objects. Screenshots remain preview artifacts.
- Existing Bun CLI export includes templates and retains every consumer-overwrite check.

The adapter keeps its frame anchor during parameter input.
Its attach-level test alternates input and frame ticks forty times.
The model clock advances during that sequence. Explicit pause then freezes time while parameter edits still apply.

## Validation

- Initial `bun test`: 58 pass, 0 fail, 312 expectations across 10 files.
- Final H1 `bun test`: 62 pass, 0 fail, 312 expectations across 11 files.
  These are the earlier recorded runs. No tests ran during this evidence-only finalization.
- `rune spec validate presentation-template-pack`: passed.
- `rune spec doctor` and unscoped `rune spec validate`: report the existing missing delta for `bundle-previews-and-prose`.
  The new change has no remaining specification error. The unrelated change remains untouched.
- CLI tests export only into temporary directories. No real consumer export is updated.
- `runtime/annotate.js` and `tests/annotate.test.cjs` already had changes. Their initial and final digests match.

`validation.json` records exact file digests, demo paths, and the preserved annotation digests.

## Limits

No browser automation or pixel review ran in this authoring task.
The coordinator supplied the bounded browser evidence below. The author did not repeat those checks.
Other browser states remain outside that evidence. The reusable checklist stays in `templates/README.md`.

No real presentation package or large asset was read. No presentation importer is implemented.
The source and layout index contract does not claim that text, tables, or baseline positions form a lossless object graph.
The small SVG object index is hand-authored and explicitly partial.

The existing bundle command keeps its page-directory boundary. This pack exports as a directory tree.
No bundler guard, browser permission, system configuration, or annotation implementation changed.

This change remains under `docs/changes/`. It is not archived as an accepted canonical specification.

## H1 annotation-context correction

Static evidence and provenance units now include `en` or `cs` in their ids before annotation capture.
Language changes end the old selection through the canonical API before changing the unit.
They then repaint marks and restore the previous annotation and edit modes.
The canonical runtime and its existing test file remain byte-identical.

Four regression cases execute the real example script and canonical address/copy functions.
They cover both pages, initial CS loading, EN→CS→EN changes, annotation-off state, and edit-mode restoration.
The example manifest and validation digests are refreshed.

The coordinator reports that the default theme and layout look good.
The coordinator also reports that the actual clock and amplitude advance during a held-slider drag.
These observations do not establish a frame rate. Slow CDP calls do not measure model rendering performance.
The coordinator completed the H1 browser recheck. Astra now returns `APPROVE_CODE_REVIEW`. H1 is closed.
No browser automation ran in this author correction task.

## Coordinator browser evidence

The external evidence receipt is `review-navigation/html-tools-browser-checks.json`.
`validation.json` records its digest and exact supplied contents. Browser actions belong to the coordinator.

| Check | Recorded result and boundary |
| --- | --- |
| Held slider | Clock and amplitude advance; playback remains active. This does not measure FPS. |
| Pause and language | EN and CS retain the same paused time with localized decimal punctuation. |
| Pause and iteration | Time and explicit pause survive language/iteration changes. Exactly one version remains mounted. |
| Native fullscreen | Host navigation disappears and Czech model controls remain. The browser check exits through the button. |
| Model SVG annotation | The model-point QA note retains a visible, fitted stage. The coordinator deletes its own QA note. |
| Provenance context | CS uses `#provenance-example-cs`; EN uses `#provenance-example-en`, each with `figure > img`. |
| Saved provenance note | Highlights read EN=1, CS=0, EN=1 on return. The panel retains the EN identity and layout remains visible. |
| Evidence context | CS and EN annotation popups show their distinct language-qualified unit ids. |
| Annotation mode | Mode remains active across language changes. Only coordinator QA notes are deleted. No user notes change. |

Reduced motion and rejected fullscreen retain code/unit-test evidence only.
Native Escape exit and focus restoration remain unit evidence; the recorded browser exit uses its button.
No browser frame-rate, broad viewport, or unrecorded interaction claim follows from these checks.

The receipt history now distinguishes the initial 58-test run from the final 62-test H1 run.
A shared validation object had incorrectly changed the initial history entry. This metadata error is corrected.
No test result is attributed to a new run during this finalization.
