# concept-atlas Specification

## ADDED Requirements

### Requirement: Concept data format

The runtime MUST read concepts from one documented JSON format that uses SKOS names.
Each concept MUST have a preferred label and a definition for each declared language.
A concept MAY name broader concepts, related concepts, other names, and the units where it appears.
The runtime MUST check the data before it draws, and each problem MUST name the record and the field.

#### Scenario: Concept has no label in one language

- **WHEN** a concept has no preferred label for a declared language
- **THEN** the check names the collection, the index, the concept id, the field, and the language

#### Scenario: Concept names a unit that does not exist

- **WHEN** a concept lists a unit id that the data does not declare
- **THEN** the check names the concept and the unit id, and the view shows that line

### Requirement: Atlas and dictionary views

The runtime MUST draw an atlas view and a dictionary view from the same data.
The atlas view MUST show the concepts on the unit that the reader came from, the concepts one relation away,
and the other concepts. It MUST show the relations and the units of the selected concept.
The dictionary view MUST list every concept with its definition in the alphabetical order of the active language.
Each unit of a concept MUST link back to that unit when the page declares a unit link.

#### Scenario: Reader opens the atlas from a unit

- **WHEN** the address names a unit
- **THEN** the concepts on that unit come first and one of them is selected

#### Scenario: Reader switches the dictionary to Czech

- **WHEN** the language changes to Czech
- **THEN** the same concepts show Czech labels in Czech order, where `ch` follows `h`

### Requirement: Concept panel

The runtime MUST provide a panel that opens over another page and shows the concepts of the unit on view.
The page MUST be able to state the unit on view. The default MUST be the unit in the address.
A key MUST open the panel and Escape MUST close it. A key in a form field MUST stay with the field.
The panel MUST follow a change of the unit and a change of the document language.

#### Scenario: Reader presses the key on a unit

- **WHEN** the reader presses the panel key outside a form field
- **THEN** the panel opens with the concepts of the unit on view

#### Scenario: Reader types the key in a search field

- **WHEN** the reader types the same letter in a form field
- **THEN** the panel does not open or close

### Requirement: Search across languages

Search MUST ignore case, diacritics, and repeated spaces.
Search MUST read the labels, the other names, and the definitions in every language of the data.

#### Scenario: Reader types a Czech word without diacritics

- **WHEN** the reader types `skocne` and a concept has the Czech label `Skočné dmutí`
- **THEN** the result has that concept, in each active language

### Requirement: Companion page address

Each companion page MUST accept the language, the unit id, and the selected record in the query or in the hash.
The hash MUST apply first. A unit id that is not valid MUST count as no unit.

#### Scenario: Deck links to the atlas with a unit and a language

- **WHEN** a deck opens the atlas with `lang=cs` and `unit=12` in the query or in the hash
- **THEN** the atlas shows Czech text and the concepts of unit 12

### Requirement: Data as text and safe links

A view MUST write text from the data as text and MUST NOT write it as HTML.
A view MUST make a link from the data only when it is an `http`, `https`, or relative link.

#### Scenario: Label contains markup characters

- **WHEN** a label in the data contains an angle bracket
- **THEN** the page shows the characters and creates no element

#### Scenario: Download link has a script scheme

- **WHEN** a link in the data starts with `javascript:`
- **THEN** the check reports the record, and a view shows the label as plain text with no link
