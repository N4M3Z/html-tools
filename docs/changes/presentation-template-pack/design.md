# Design

Use navy, gold, and cyan as the default presentation palette.
The tokens are void `#080d16`, surface `#111a2c`, ink `#dbe5f7`, muted `#99aac6`, gold `#f5c769`, and cyan `#55d2e5`.
System sans serif carries every label. Headings use a strong weight. No font download is required.
Inline diagram colors use CSS variables. External SVGs use the same tokens with local fallbacks.

```text
host links and example title                  hidden in fullscreen
+--------------------------------------------------------------+
|                                                              |
|          model or intact evidence       compact explanation   |
|                                        readout                |
|                                                              |
+--------------------------------------------------------------+
model controls, language, Sources, fullscreen                    retained
```

The fixed stage uses the existing `SlideFrameFit.geometry` calculation.
Controls stay outside the scaled stage. They remain usable when the stage becomes small.
No composition requires a reveal sequence or an inner pager.

The iteration selector mounts exactly one version. It does not hide two rendered versions beside each other.
The source chain links a placeholder source, editable SVG master, derived SVG, and example slide through a manifest.
These files illustrate provenance. They do not claim an observed measurement or a physical simulation.

Playback has separate user intent and temporary gates. Only Play or Pause changes explicit intent.
Changing a parameter updates the model immediately. Visibility and Sources gate motion without changing intent.
Reduced motion requires a local Play action for each new mount. The override is never stored.

Fullscreen targets the document element. CSS hides only marked host chrome.
The model controls, Sources dialog, and canonical annotation interface remain inside the fullscreen document.
The native Escape action exits fullscreen. The helper restores focus to the fullscreen button.

The pack uses classic scripts. It adds no framework, dependency, or consumer-specific protocol.
