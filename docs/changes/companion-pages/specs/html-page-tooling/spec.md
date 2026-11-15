# html-page-tooling Specification

## ADDED Requirements

### Requirement: Concept data conversion

The tool MUST convert expanded JSON-LD with SKOS concepts into the data format of the concept atlas.
The tool MUST stop and name the bad record when the result is not valid.
The tool MUST be able to write a manifest with the SHA-256 digests of its input and its output.
The default export MUST include JSON-LD files, so a consumer gets the concept source with the converted data.

#### Scenario: Author converts a concept source

- **WHEN** the conversion reads a JSON-LD file with concepts and units
- **THEN** it writes the atlas data, and the manifest has the digest of each file

#### Scenario: Concept has no definition in one language

- **WHEN** a concept in the source has no definition for a declared language
- **THEN** the conversion stops and names that concept, the field, and the language

### Requirement: Companion example data in the template manifest

The template manifest MUST list the data files of the companion examples with their SHA-256 digests.
The manifest refresh MUST update those digests.

#### Scenario: Author changes the sample library records

- **WHEN** the author edits the sample records and runs the manifest refresh
- **THEN** the manifest has the new digest of that file
