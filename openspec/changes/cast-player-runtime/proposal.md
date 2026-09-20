## Why

Recorded proofs are shown as GIFs. A GIF loops, cannot pause, and never says which scene is on screen. The
recording behind every GIF is an asciinema cast that already carries the scene titles, and a page can play it.

## What Changes

- Add `runtime/cast-player.js`: `CastPlayer.attach(host, castText)` plays an asciinema v2 cast with a
  Play/Pause button, a scrubber, the elapsed time, the scene the playhead is in, and a scene list that jumps.
- Export `parse`, `scenes`, `sceneAt`, `render`, `controller`, and `clock` for node, with the controller taking
  the clock as an argument.
- Document the player in README and AGENTS.

## Capabilities

### New Capabilities

- `cast-player`: cast playback with position, testable without a browser.

## Impact

- New file `runtime/cast-player.js`, new test `tests/cast-player.test.cjs`. Consumers receive it on their next
  export. Nothing existing changes.
