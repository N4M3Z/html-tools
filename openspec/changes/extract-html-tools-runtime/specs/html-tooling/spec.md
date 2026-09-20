## Purpose

Keep the page-generic browser aids and the Python build tools in one repository that consumers vendor with a
verifiable manifest.

## ADDED Requirements

### Requirement: High contrast

The script SHALL toggle a high-contrast mode with `H` or `?hc=1`, override the page's colour variables and
literal SVG colours, inject the same overrides into every same-origin frame, and persist the choice per page
URL.

#### Scenario: Frame loads after the mode is on

- **WHEN** a same-origin frame finishes loading while high contrast is on
- **THEN** the frame document receives the overrides without a reload

### Requirement: Fitted preview frame

The script SHALL fit a 1920 × 1080 frame into a host element, keep it fitted on resize, and offer a toggle to
the window size. The fitted geometry SHALL stay finite for a hidden or invalid host.

#### Scenario: Host is hidden

- **WHEN** the host reports zero width and height
- **THEN** every geometry value is a finite number and the frame keeps its loaded document

### Requirement: Portable asset bundling

The builder SHALL include referenced local assets within the allowed root and preserve preview fragments.
It SHALL reject missing files, cycles, and references that escape the root.
External references SHALL remain external.

#### Scenario: Page references a file outside the root

- **WHEN** the builder meets a reference that resolves above the root
- **THEN** it stops with an error that names the file instead of writing a partial build

### Requirement: Traceable consumer export

The tool SHALL export the runtime and the Python modules into a chosen directory with a `manifest.json` that
records a sha256 digest per file. It SHALL stop before writing when a previously exported file has local
changes, when an unmanaged file would be overwritten, or when a source file was removed.
A consumer SHALL be able to pass its own folder list to export its own tree with the same manifest format.

#### Scenario: Consumer changes an exported file

- **WHEN** the export runs again
- **THEN** it names the changed file, stops, and leaves the manifest as it was

### Requirement: Reproducible verification

The repository SHALL include tests for the tuicr format, the frame geometry, bundling boundaries, and export
refusals, runnable with the Python standard library and node alone.

#### Scenario: Contributor runs the checks

- **WHEN** the contributor runs the unittest discovery and the node test runner
- **THEN** both pass without a package manager or a browser
