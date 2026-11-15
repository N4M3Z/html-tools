# language-copy-binding Specification

## ADDED Requirements

### Requirement: Copy table binding

The runtime MUST fill marked elements from a copy table for the active language.
It MUST set text as text and MUST NOT write copy as HTML.
It MUST set the accessible label and the alternative text of marked elements, and the language of the document.
The languages and the fallback language MUST be options of the page.

#### Scenario: Copy contains markup characters

- **WHEN** a text in the copy table contains an angle bracket
- **THEN** the page shows the characters and creates no element

#### Scenario: Language has no text for a key

- **WHEN** the active language has no text for a key and the fallback language has one
- **THEN** the element shows the fallback text

### Requirement: Language source order

The runtime MUST take the first language from the hash, then the query, then the document language,
then the fallback. It MUST ignore a language that the page does not support.

#### Scenario: Share build carries no query

- **WHEN** a figure opens from a data URL with the language in its hash
- **THEN** the figure uses that language

#### Scenario: Hash and query name different languages

- **WHEN** both the hash and the query name a supported language
- **THEN** the language from the hash applies

### Requirement: Language switch in place

A language switch MUST rewrite the existing elements without a reload, so the page keeps its state.
Numbers MUST use the decimal mark of the active language.

#### Scenario: Reader switches language during playback

- **WHEN** the page switches from English to Czech
- **THEN** the same elements carry Czech text, numbers use a decimal comma, and playback state is unchanged

### Requirement: Parity check

The runtime MUST provide a pure check that lists each key that one or more languages do not have.

#### Scenario: One language misses a key

- **WHEN** a key exists in Czech and not in English
- **THEN** the check lists that key with English as the language that misses it
