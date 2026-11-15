# asset-library Specification

## ADDED Requirements

### Requirement: Asset records

The runtime MUST read asset records from one documented JSON format.
Each record MUST have an id, a file, a SHA-256 digest, and a license status that the data declares.
A record MAY have its units, a title, a source, a license name, and notes.
The runtime MUST check the data before it draws, and each problem MUST name the record and the field.

#### Scenario: Record has a status that the data does not declare

- **WHEN** an asset has a license status that is not in the declared list
- **THEN** the check names the asset, the field, and the status

#### Scenario: Record has a digest of the wrong form

- **WHEN** a digest is not 64 lower-case hex digits
- **THEN** the check names the asset and the digest field

### Requirement: Asset search and filters

The assets view MUST show each record with its file, digest, source, license status, notes, and units.
The view MUST filter by a search text, by a license status, and by a unit, and the filters MUST combine.
Search MUST ignore case and diacritics. The order MUST follow the titles in the active language.
Each unit of a record MUST link back to that unit when the page declares a unit link.

#### Scenario: Reader opens the library from a unit

- **WHEN** the address names a unit
- **THEN** the view shows only the records of that unit, and the unit filter shows that unit

#### Scenario: Reader selects the unresolved status

- **WHEN** the reader selects one license status and types a search text
- **THEN** the view shows only the records that have that status and match the text

### Requirement: Corrections separate from sources

The data MUST hold sources and corrections in two separate lists.
The references view MUST draw the sources and the corrections in two sections with their own headings.
The view MUST mark each correction as a correction. No filter MUST move a record from one list to the other.
A correction MAY name the sources that support it.

#### Scenario: Reader searches the references

- **WHEN** a search text matches one source and one correction
- **THEN** the source stays in the sources section and the correction stays in the corrections section

#### Scenario: Correction names a source that does not exist

- **WHEN** a correction lists a reference id that the data does not declare
- **THEN** the check names the correction and the missing id

### Requirement: Record data as text and safe links

A view MUST write text from the data as text and MUST NOT write it as HTML.
A view MUST make a link or load a preview from the data only when the address is an `http`, `https`, or relative link.

#### Scenario: Source link has another scheme

- **WHEN** a source link in the data has a scheme other than `http` or `https`
- **THEN** the check reports the record, and a view shows the source title as plain text
