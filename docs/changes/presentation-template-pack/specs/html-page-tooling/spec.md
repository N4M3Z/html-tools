# html-page-tooling Specification

## MODIFIED Requirements

### Requirement: Traceable consumer export

The tool MUST export runtime scripts, TypeScript tools, and the portable template folder through the existing Bun CLI.
The manifest MUST record a SHA-256 digest for each exported file.
Export MUST stop before writing if managed files changed locally, unmanaged files collide, or source files were removed.
Callers MUST retain the ability to supply their own folder and suffix lists.

#### Scenario: Consumer exports the template pack

- **WHEN** the existing export command targets an empty consumer directory
- **THEN** the examples, local assets, shared helpers, and canonical annotation runtime are included

#### Scenario: Consumer modifies an exported template

- **WHEN** export runs again
- **THEN** it refuses the update and leaves every consumer file and the manifest unchanged

#### Scenario: Consumer changes an exported file

- **WHEN** the export runs again
- **THEN** it names the changed file, stops, and leaves the manifest as it was
