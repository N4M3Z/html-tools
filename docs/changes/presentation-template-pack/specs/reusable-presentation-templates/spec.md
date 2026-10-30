# reusable-presentation-templates Specification

## ADDED Requirements

### Requirement: Complete portable compositions

The pack MUST provide runnable model/readout, dominant-evidence, iteration-selection, and provenance examples.
Each example MUST show one complete 16:9 composition with CS and EN labels.
Sources and model controls MUST be optional. Examples MUST NOT require nested presentation steps.

#### Scenario: Reader changes the iteration

- **WHEN** the reader chooses another iteration
- **THEN** exactly one version is mounted and its model remains independently controllable

### Requirement: Playback intent survives remounts

The shared controller MUST autoplay by default. Range input MUST update its parameter immediately without changing playback intent.
Snapshots MUST retain explicit pause, time, and parameter values independently of language.
Hidden, inactive, and blocked states MUST gate motion without changing explicit intent.

#### Scenario: Reader changes language while paused

- **WHEN** a paused model remounts in another language from its snapshot
- **THEN** time, parameter value, and explicit pause remain unchanged

#### Scenario: Reader changes a parameter during playback

- **WHEN** range input supplies a valid parameter value
- **THEN** the next draw uses that value and the clock continues

### Requirement: Reduced motion needs local intent

Reduced motion MUST default to paused on every mount, including restored playing snapshots.
A local Play action MAY permit motion for the current mount. Host activation MUST NOT grant this override.

#### Scenario: A playing snapshot mounts with reduced motion

- **WHEN** the controller restores the snapshot and its host becomes active
- **THEN** motion remains stopped until the reader chooses Play

### Requirement: Fullscreen retains model controls

Fullscreen MUST hide marked host chrome while retaining model controls and Sources.
It MUST use a labeled native button and restore focus when fullscreen ends.
An unsupported or rejected request MUST report the failure without hiding host chrome.

#### Scenario: Browser rejects fullscreen

- **WHEN** the native fullscreen request rejects
- **THEN** the page remains in normal view and reports that fullscreen is unavailable

### Requirement: Canonical annotation integration

Examples MUST configure and load `runtime/annotate.js` after their own script.
They MUST NOT carry a copied annotation implementation.

#### Scenario: Reader enables annotations

- **WHEN** an example opens with `?annotate=1`
- **THEN** the canonical runtime targets the active template unit

#### Scenario: Reader changes the static composition language

- **WHEN** the evidence or provenance example changes between CS and EN
- **THEN** its unit id identifies the new language before capture
  and canonical annotation marks repaint for that context

### Requirement: Traceable placeholder provenance

A manifest MUST link source, editable master, derived build, and slide paths with actual file digests.
Placeholder data MUST be identified as illustrative.

#### Scenario: A provenance asset changes

- **WHEN** a contributor changes a file named in the example manifest without updating its digest
- **THEN** the template tests fail
