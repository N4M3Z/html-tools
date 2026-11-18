# html-element-annotation Specification

## ADDED Requirements

### Requirement: Annotations without storage

The annotation script MUST start when the page cannot read its storage.
The notes MUST then stay in memory for the visit, and the copy of the notes MUST work.

#### Scenario: Page opens in a sandboxed frame

- **WHEN** a viewer shows the page in a sandboxed frame that blocks storage
- **THEN** annotate mode starts with its key, and a note that the reviewer makes shows in the copied text
