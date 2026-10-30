# Presentation templates

These examples use plain HTML, CSS, and classic JavaScript. They add no package dependency or build step.
The default tokens use navy, gold, cyan, and bold system sans serif.

Serve the repository root, or serve an exported directory. Open these paths:

- `templates/index.html?lang=en`
- `templates/model-readout.html?lang=cs`
- `templates/evidence.html?lang=en`
- `templates/iterations.html?lang=en&version=current`
- `templates/provenance.html?lang=cs`

Each page also accepts `?annotate=1`. Preserve the other query parameters when adding this flag.
The pages also work without a server where browser policy permits local scripts and storage.
Clipboard access and fullscreen depend on browser policy.

## Reuse a composition

Copy an example outside the managed export before changing it.
Keep the exported runtime as the canonical dependency. Do not edit a consumer's managed files.
Keep `templates/` and `runtime/` as sibling folders when running these examples unchanged.

- Model/readout: replace `modelNode` and `draw` in your own copy of `demo.js`.
- Evidence: replace the complete image and compact explanation. Keep `object-fit: contain` when the entire image matters.
- Iterations: provide one factory for each version. `PresentationView.showVersion` mounts only the selected factory's node.
- Provenance: replace the sample asset chain with your own retained native package and coverage record.

Every composition has a 1920 × 1080 stage. It uses `SlideFrameFit.geometry` to fit the available space.
Controls remain outside the scaled artwork and inside the presentation view.
Small viewports scale the whole composition. Check audience readability separately.
No example has a mandatory reveal sequence, inner pager, or teaching tab.

## Playback

Load `runtime/model-playback.js`, then create the adapter:

```js
const player = ModelPlayback.attach({
  key: 'my-model:v1', // Keep this key independent of language.
  min: 0, max: 10, value: 2,
  onFrame(state, playing, paused) {
    draw(state.time, state.value);
    playButton.textContent = paused ? 'Play' : 'Pause';
  },
});
range.addEventListener('input', () => player.setValue(Number(range.value)));
playButton.addEventListener('click', () => player.toggle());
```

Playback starts by default. `setValue` draws synchronously and keeps the clock anchor.
A held range control does not pause or restart time.
Use `pause()` or `play()` for explicit local intent. Use `setActive()` for host activation.
Host activation does not grant the reduced-motion override.

Reduced motion starts paused on every mount, including a restored playing snapshot.
Local Play permits motion for that mount. A preference change clears the override.
Hidden documents and `setBlocked(true)` gate motion without changing explicit pause.
The clock uses seconds. It advances continuously and caps one late frame at 0.1 seconds.
Only the drawing applies a periodic angle. The saved clock never wraps at a cycle boundary.

`snapshot()` returns version, time, value, and explicit pause. It contains no language or version-selector field.
For a language remount, retain that snapshot, destroy the old adapter, and pass `snapshot` to the new adapter.
The example does this even if browser storage is unavailable.
Without storage, a full page reload cannot recover the prior session.
Call `destroy()` to save state and remove the adapter's animation frame and listeners.

`ModelPlayback.controller` exposes the same state without timers or browser objects.
Use it for deterministic model tests. `tick(seconds)` takes elapsed time as input.

## Fullscreen and annotation

Load `runtime/presentation-view.js`. Use a native button with `aria-pressed`:

```js
const view = PresentationView.fullscreen(button, {status: liveStatus, labels: {
  enter: 'Fullscreen', exit: 'Exit fullscreen', unavailable: 'Fullscreen is unavailable.',
}});
```

The helper requests native fullscreen on the document element.
The stylesheet hides only `.host-chrome` while `data-presentation-fullscreen` is present.
Model controls, language, Sources, and the annotation runtime remain in the fullscreen document.
Native Escape exits fullscreen. Focus returns to the fullscreen button.
A rejected request reports the failure and leaves host chrome visible.
Destroy the helper before replacing its button during a remount.

Configure `window.HTML_ANNOTATE` before loading the canonical `runtime/annotate.js`.
The examples select `.template-unit.active`. They do not copy or modify the annotation runtime.
The model unit id includes language and iteration so copied comments retain that context.
Static evidence and provenance unit ids also include the language before annotation capture.
A static-page language change ends the current annotation selection before changing the unit.
It then repaints through the canonical API and restores annotation and edit modes.
An annotation panel reserves space through the existing `--inset-right` contract.

## Source preservation

The immutable native package is the preservation source. Retain its original bytes and SHA-256 digest.
For a presentation import, retain the original presentation package even when it is large.
Never replace it with screenshots, rendered slides, or extracted text.
Create a new source revision instead of overwriting the preserved package.

An extracted per-slide object index must record:

- Stable native slide and object ids, slide order, reading order, and stacking order.
- Object and group transforms, coordinate units, bounds, rotation, flips, and inherited transforms.
- Exact text runs and paragraph structure, including language, fonts, sizes, emphasis, baseline, superscript, and subscript.
- Media references and relationship ids, with links to retained bytes and any declared display replacements.
- Tables, grouped shapes, links, and supported native properties, with explicit coverage for unsupported objects.
- Raw package part and relationship references for slides, masters, layouts, themes, and embedded resources.

Keep unknown native parts through the original package. An index must disclose what it omits.
A text/group/media extract is partial. A layout extract can add positions, tables, superscripts, and subscripts.
Those extracts alone do not establish a full lossless object graph or prove reassembly fidelity.
Do not set a lossless flag without a separate coverage audit and a reassembly comparison.

Screenshots and raster slide captures are preview artifacts only. They are not preservation sources.
The manifest links native package → editable master → derived build → consuming slide.
It also links the object index and preview, with separate roles and actual digests.

This pack uses a tiny authored SVG as its sample native package. Its hand-authored object index is explicitly partial.
It demonstrates field names and coverage disclosure. It does not implement a presentation importer.
The curve is illustrative. It contains no observed data or physical simulation output.

After changing an editable or derived example artifact, refresh its hashes:

```sh
bun templates/hash-manifest.ts
```

The helper verifies the native package first. It refuses to replace its preserved digest after a native edit.
Review a real import's native-package identity and object coverage before writing its initial manifest.

## Export and verification

Use the existing command:

```sh
bun htmltools/cli.ts export /path/to/consumer/vendor/html-tools
bun test
```

The exporter includes templates, local assets, helpers, and canonical annotation.
It refuses modified managed files and unmanaged collisions before writing.
This change does not update any existing consumer export.

The single-file bundler keeps its existing page-directory boundary.
These examples reference sibling runtime files. They are directory exports, not ready-made single-file bundles.
Do not weaken the bundler's root check to bundle them.

Tests cover pure playback, repeated input before every animation frame, remounts, preference gates,
one-version mounting, static annotation context, and export refusals.
DOM doubles do not prove browser layout, pointer behavior, focus, native fullscreen, or annotation fit.

Parent browser validation remains required:

1. Inspect all compositions in CS and EN at presentation and narrow sizes.
2. Hold the range control during autoplay. Confirm both the parameter and clock continue changing.
3. Pause, change language and iteration, and confirm the exact time and value remain.
4. Test reduced motion with fresh and restored sessions, then local Play.
5. Open Sources during playback. Close it and confirm the prior intent resumes.
6. Enter fullscreen with the keyboard. Confirm host links disappear and model controls remain usable.
7. Exit with Escape. Confirm focus returns and a rejected request leaves normal view intact.
8. Open `?annotate=1`, annotate an SVG part, and inspect copied language/iteration context and panel fit.
