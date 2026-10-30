# Presentation template pack

## Why

Consumers repeat presentation layouts and playback fixes. They need small examples with shared, testable behavior.

## What Changes

- Add plain HTML, CSS, JavaScript, SVG, and provenance examples under `templates/`.
- Add a reusable playback controller and a small presentation-view helper.
- Keep one complete composition on view. Make model controls and Sources optional.
- Preserve explicit pause across language remounts. Parameter input must not pause motion.
- Respect reduced motion and temporary visibility gates.
- Load the canonical annotation runtime after each example's script.
- Include templates in the existing hash-checked export. Preserve every existing refusal before writing.

## Impact

The default export adds the template folder and its asset types. No consumer export runs during this change.
The existing annotation implementation and its working-copy changes remain untouched.
Browser checks remain separate from controller and export tests.
