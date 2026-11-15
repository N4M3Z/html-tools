# stepped-figures Specification

## ADDED Requirements

### Requirement: Figure step protocol

The figure runtime MUST announce its step total when it is ready and MUST report its page after each step.
It MUST report a step past the first or last page as a boundary and MUST NOT move.
It MUST ignore a step before it is ready. It MUST hold a requested page until it is ready.
The type prefix and the identity fields MUST be options of the page.

#### Scenario: Deck steps past the last page

- **WHEN** the deck sends a forward step to a figure on its last page
- **THEN** the figure stays on that page and sends a boundary message with the delta, page, and total

#### Scenario: Deck names a page before the figure is ready

- **WHEN** the deck sends a page number and the figure becomes ready later
- **THEN** the figure opens on that page and reports it

#### Scenario: Page declares the compatibility prefix and identity

- **WHEN** a figure declares the prefix `uro-tool-` and the identity fields tool, model, lang, and slide
- **THEN** each message carries that type prefix and those fields before its own fields

### Requirement: Trusted message source

The figure runtime MUST accept a message only from its parent window.
It MUST ignore a message that carries an identity field with a value other than its own.
A figure with an opaque origin MUST still exchange messages with its parent.

#### Scenario: Another window posts a step

- **WHEN** a window that is not the parent posts a step message
- **THEN** the figure does not move

#### Scenario: Figure runs from a data URL

- **WHEN** a share build loads the figure from a data URL
- **THEN** the figure posts to any origin and accepts steps from its parent

### Requirement: Navigation keys

An embedded figure MUST hand a navigation key to its deck. A standalone page MUST step itself.
The runtime MUST leave a key alone when a modifier key is down, in a form field, a slider, or editable text,
and for Space or Enter on a button or link.

#### Scenario: Reader presses Space on a button

- **WHEN** focus is on a button in the figure and the reader presses Space
- **THEN** the button receives the key and the figure sends no navigation message

### Requirement: Activity without pause intent

The figure MUST be active only when its deck said so and its document is visible.
The runtime MUST hand each activity change to the page through a callback.
The runtime MUST NOT change the manual pause intent of the page.

#### Scenario: Deck hides an active figure

- **WHEN** the deck sends a playback message with active set to false
- **THEN** the page callback receives false and the manual pause intent stays as it was
