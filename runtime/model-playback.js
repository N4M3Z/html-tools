// Model playback keeps explicit pause separate from visibility and preference gates.
(function (root) {
  'use strict';

  function controller(options = {}) {
    const min = options.min ?? 0, max = options.max ?? 1;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw new RangeError('Invalid model bounds');
    const clamp = value => Math.max(min, Math.min(max, value));
    let saved = options.snapshot;
    if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch { saved = null; } }
    if (!saved || saved.version !== 1 || Array.isArray(saved)) saved = {};
    const state = {
      time: Number.isFinite(saved.time) && saved.time >= 0 ? saved.time : 0,
      value: clamp(Number.isFinite(saved.value) ? saved.value : Number.isFinite(options.value) ? options.value : min),
      paused: saved.paused === true,
    };
    const gates = {active: true, visible: true, blocked: false, reduced: options.reducedMotion === true, manual: false};
    const paused = () => state.paused || (gates.reduced && !gates.manual);
    const playing = () => !paused() && gates.active && gates.visible && !gates.blocked;
    return {
      get time() { return state.time; },
      get value() { return state.value; },
      get paused() { return paused(); },
      get playing() { return playing(); },
      play() { state.paused = false; gates.manual = true; },
      pause() { state.paused = true; gates.manual = false; },
      setValue(value) { if (!Number.isFinite(value)) return false; state.value = clamp(value); return true; },
      setActive(value) { gates.active = value === true; },
      setVisible(value) { gates.visible = value === true; },
      setBlocked(value) { gates.blocked = value === true; },
      setReducedMotion(value) { gates.reduced = value === true; gates.manual = false; },
      tick(seconds) {
        if (!playing() || !Number.isFinite(seconds) || seconds <= 0) return false;
        const next = state.time + Math.min(seconds, .1);
        if (!Number.isFinite(next)) return false;
        state.time = next;
        return true;
      },
      snapshot() { return {version: 1, time: state.time, value: state.value, paused: state.paused}; },
    };
  }

  // No controls are assumed. A consumer supplies its draw function and persistence key.
  function attach(options = {}) {
    const doc = root.document;
    const media = root.matchMedia('(prefers-reduced-motion: reduce)');
    let storage, saved = options.snapshot;
    try {
      storage = options.storage ?? root.sessionStorage;
      if (saved === undefined && options.key) saved = storage.getItem(options.key);
    } catch { /* The current mount still works when storage is unavailable. */ }
    const model = controller({...options, snapshot: saved, reducedMotion: media.matches});
    model.setVisible(!doc.hidden);
    if (options.active !== undefined) model.setActive(options.active);
    let last = null, frame = null, stopped = false;
    const draw = () => { if (options.onFrame) options.onFrame(model.snapshot(), model.playing, model.paused); };
    function save() { try { if (storage && options.key) storage.setItem(options.key, JSON.stringify(model.snapshot())); } catch {} }
    function update(action, resetClock = false) { if (stopped) return; action(); if (resetClock) last = null; save(); draw(); }
    function tick(now) {
      if (stopped) return;
      const changed = last !== null && model.tick((now - last) / 1000);
      last = now;
      if (changed) draw();
      frame = root.requestAnimationFrame(tick);
    }
    const visibility = () => update(() => model.setVisible(!doc.hidden), true);
    const preference = () => update(() => model.setReducedMotion(media.matches), true);
    doc.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', preference);
    root.addEventListener('pagehide', save);
    draw();
    frame = root.requestAnimationFrame(tick);
    return {
      get playing() { return model.playing; },
      get paused() { return model.paused; },
      snapshot: () => model.snapshot(),
      play: () => update(() => model.play(), true),
      pause: () => update(() => model.pause(), true),
      toggle: () => update(() => model.paused ? model.play() : model.pause(), true),
      setValue: value => update(() => model.setValue(value)),
      setActive: value => update(() => model.setActive(value), true),
      setBlocked: value => update(() => model.setBlocked(value), true),
      destroy() {
        if (stopped) return;
        stopped = true; save(); root.cancelAnimationFrame(frame);
        doc.removeEventListener('visibilitychange', visibility);
        media.removeEventListener('change', preference);
        root.removeEventListener('pagehide', save);
      },
    };
  }

  const api = {controller, attach};
  root.ModelPlayback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
