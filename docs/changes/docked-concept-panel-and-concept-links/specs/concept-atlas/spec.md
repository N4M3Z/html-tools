# concept-atlas Specification

## ADDED Requirements

### Requirement: Docked concept panel

The runtime MUST be able to show the concept panel on the right edge of a page while the page stays in use.
The docked panel MUST tell the page its width, so a page that fits itself to the window can move aside.
The docked panel MUST leave the focus on the page, and the page MUST keep the keys that the panel does not need.
The docked panel MUST follow the unit on view.
The runtime MUST be able to open the panel on one named concept.

#### Scenario: Reader moves to the next slide with the panel open

- **WHEN** the docked panel is open and the reader presses the key for the next slide
- **THEN** the deck shows the next slide and the panel shows the concepts of that slide

#### Scenario: Reader types in the search field of the docked panel

- **WHEN** the reader types a letter that is also a key of the page
- **THEN** the letter goes to the search field and the page does nothing

#### Scenario: Second panel opens on the right edge

- **WHEN** the docked panel is open and the command pane opens
- **THEN** the docked panel closes and the page takes the width of the pane

### Requirement: Concept links

The runtime MUST be able to make the first mention of each concept of a unit, in the text of that unit, a link
that opens the concept panel on that concept.
A mention MUST be a whole word. The runtime MUST read the preferred label, the other names and the hidden names
in the language of the page.
A longer name MUST take its words before a shorter name.

#### Scenario: Text names a concept two times

- **WHEN** the text of a unit names one of its concepts two times
- **THEN** the first mention is a link and the second mention is plain text

#### Scenario: Short name stands inside a longer name

- **WHEN** a unit has the concepts `tide` and `spring tide` and its text says `spring tide`
- **THEN** the two words are one link to `spring tide`, and `tide` gets no link there

#### Scenario: Czech text uses another form of the word

- **WHEN** a concept lists the form `skočného dmutí` as a hidden name and the Czech text has that form
- **THEN** that form is a link, and no view shows the hidden name

### Requirement: Concept link places

A concept link MUST NOT stand in a heading, a control, code, a figure, or another link.
In annotate mode a click on a concept link MUST make a note and MUST NOT open the panel.

#### Scenario: Heading names a concept

- **WHEN** the heading of a unit names a concept and the text under it names the same concept
- **THEN** the heading has no link and the mention in the text is the link

#### Scenario: Reviewer clicks a link in annotate mode

- **WHEN** annotate mode is on and the reviewer clicks a concept link
- **THEN** the note box opens for that text and the concept panel stays closed

### Requirement: Scope notes and hidden names

A concept MAY have a scope note, a text for each declared language that says how the page set uses the concept.
The views MUST show a scope note under the definition.
A concept MAY have hidden names for each language. No view MUST show a hidden name.
Search MUST read the scope notes and the hidden names.
The conversion from JSON-LD MUST read both from their SKOS properties.

#### Scenario: Scope note has no text in one language

- **WHEN** a concept has a scope note with no text for a declared language
- **THEN** the check names the concept, the field, and the language

#### Scenario: Reader searches for a hidden name

- **WHEN** the reader types a hidden name of a concept in the search field
- **THEN** the result has that concept, and the page does not show the hidden name
