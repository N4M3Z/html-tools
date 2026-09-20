## Purpose

Let a page play a terminal recording with pause, resume, a scrubber, and the scene the playhead is in, so a
recorded proof can be read at the reader's pace instead of as a looping image.

## ADDED Requirements

### Requirement: Cast playback with position

The script SHALL parse an asciinema v2 cast from text, render the screen at any time, and offer a Play/Pause
button, a scrubber over the full duration, the elapsed time, and the title of the scene the playhead is in,
where a scene is a line `# Scenario: <title>` in the recording. A click on the screen and Space SHALL pause or
resume, a paused screen SHALL say so, and the arrow keys SHALL move to the previous or next scene.

#### Scenario: Reader pauses inside a scene

- **WHEN** the reader clicks the screen or presses Space during the third scene of a proof
- **THEN** playback stops on the current screen, the screen is marked paused, and the label reads `Scene 3 of N: <title>`

#### Scenario: Reader drags the scrubber

- **WHEN** the reader moves the scrubber to a time inside the first scene
- **THEN** the screen shows that moment and the label names the first scene

### Requirement: Playback is testable without a browser

The parser, scene finder, renderer, and controller SHALL be pure functions exported through `module.exports`,
and the controller SHALL take the clock as an argument.

#### Scenario: Test advances the clock

- **WHEN** a test calls `play(1000)` and then `tick(1500)`
- **THEN** the controller reports 0.5 seconds of playback and no timer was created
