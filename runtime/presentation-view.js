// Small DOM helpers for one-version comparison and native fullscreen.
(function (root) {
  'use strict';
  function showVersion(slot, selected, factories) {
    const keys = Object.keys(factories);
    if (!keys.length) throw new Error('A version factory is required');
    const id = Object.prototype.hasOwnProperty.call(factories, selected) ? selected : keys[0];
    const node = factories[id]();
    slot.replaceChildren(node);
    slot.dataset.version = id;
    return id;
  }

  function fullscreen(button, options = {}) {
    const doc = button.ownerDocument, target = doc.documentElement;
    const labels = Object.assign({enter: 'Fullscreen', exit: 'Exit fullscreen', unavailable: 'Fullscreen is unavailable.'}, options.labels);
    let wasActive = doc.fullscreenElement === target;
    function report(text) { if (options.status) options.status.textContent = text; }
    function sync() {
      const active = doc.fullscreenElement === target;
      target.toggleAttribute('data-presentation-fullscreen', active);
      button.textContent = active ? labels.exit : labels.enter;
      button.setAttribute('aria-pressed', String(active));
      if (wasActive && !active && button.isConnected) button.focus();
      wasActive = active;
    }
    async function toggle() {
      report('');
      try {
        if (doc.fullscreenElement === target) await doc.exitFullscreen();
        else if (typeof target.requestFullscreen === 'function') await target.requestFullscreen();
        else report(labels.unavailable);
      } catch { report(labels.unavailable); }
      sync();
    }
    button.addEventListener('click', toggle);
    doc.addEventListener('fullscreenchange', sync);
    sync();
    return {destroy() { button.removeEventListener('click', toggle); doc.removeEventListener('fullscreenchange', sync); }};
  }

  const api = {showVersion, fullscreen};
  root.PresentationView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
