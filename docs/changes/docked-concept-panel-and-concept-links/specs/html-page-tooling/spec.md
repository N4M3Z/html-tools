# html-page-tooling Specification

## ADDED Requirements

### Requirement: Command pane keys and order

The command pane MUST open and close with its letter key and with the command key or the control key and `P`.
A letter key typed in a form field MUST stay with the field.
The pane MUST list the jump list of a deck after every other group, so the tools are on its first screen.
The pane MUST close when another panel takes the right edge of the page.

#### Scenario: Presenter presses the command key and P on a deck

- **WHEN** the presenter presses the command key and `P` on a deck with thirty slides
- **THEN** the pane opens, and its first screen shows the tools before the first slide jump

#### Scenario: Reviewer types the letter in a note

- **WHEN** the reviewer types the letter of the pane in the note field of annotate mode
- **THEN** the letter goes into the note and the pane does not open
