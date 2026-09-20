## Purpose

Let a reviewer annotate any element of an HTML page in the browser and copy the notes out as tuicr review
comments, without coupling the script to one page shape.

## ADDED Requirements

### Requirement: Element annotations

The script MUST let a reviewer attach a typed note (ISSUE, NOTE, SUGGESTION, PRAISE) to an element of the
unit on view, to an element inside a same-origin frame, or to a part of an inline SVG.
Notes MUST persist per page path in browser storage and MUST show only in annotate mode.

#### Scenario: Reviewer annotates an element inside a figure frame

- **WHEN** the reviewer clicks inside a same-origin frame in annotate mode
- **THEN** the note records the frame file and the element path inside it, and a floating mark follows the element

### Requirement: tuicr export

The script MUST copy all notes as one tuicr review comment: a header, a legend of the used kinds, and one
numbered `**[KIND]**` line per note with the page name, the unit id, the element address, and the text.
The line format MUST NOT change between versions without a note in the change that does it.

#### Scenario: Reviewer copies two notes on different units

- **WHEN** the reviewer presses Copy notes
- **THEN** the clipboard holds the notes in unit order, numbered from one, with a legend of the two kinds used

### Requirement: Page shape configuration

The script MUST read the unit selector, the selector of the unit on view, and the navigation function from
`window.HTML_ANNOTATE` when the page sets it before the script loads.
The defaults MUST be a slide deck: `.slide`, `.slide.active`, and the `#N` hash.

#### Scenario: Deck loads the script without configuration

- **WHEN** a slide deck loads the script with no `window.HTML_ANNOTATE`
- **THEN** annotation, marks, and navigation behave as they did before the script moved out of slides
