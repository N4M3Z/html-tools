// Stepped figures, the figure side. A figure in a frame has its own reveal steps and a deck drives them.
//
// Every message is an object: a type, then the identity fields the page declares, then the fields below.
// P is the type prefix.
//   figure to deck: P+'ready' {total}, P+'page' {page, total}, P+'boundary' {delta, page, total},
//                   P+'navigate' {delta}
//   deck to figure: P+'step' {delta}, P+'step-to' {page}, P+'playback' {active}
(function (root) {
  'use strict';

  const DEFAULT_PREFIX = 'slidekit:figure-';
  const FORWARD = ['ArrowRight', 'PageDown', ' '];
  const BACK = ['ArrowLeft', 'PageUp'];
  const FIELDS = 'input,textarea,select,[role="slider"],[contenteditable]:not([contenteditable="false"])';

  function types(prefix = DEFAULT_PREFIX) {
    return {
      ready: prefix + 'ready', page: prefix + 'page', boundary: prefix + 'boundary', navigate: prefix + 'navigate',
      step: prefix + 'step', stepTo: prefix + 'step-to', playback: prefix + 'playback',
    };
  }

  // A field the message leaves out agrees. A field it carries must equal the figure's.
  function matches(identity, data) {
    return Object.keys(identity).every(key => data[key] == null || data[key] === identity[key]);
  }

  // 1 for a forward key, -1 for a back key, 0 for a key the figure must leave alone.
  function keyDelta(event) {
    if (!event || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return 0;
    const target = event.target;
    const inside = selector => Boolean(target && typeof target.closest === 'function' && target.closest(selector));
    if (inside(FIELDS)) return 0;
    if ([' ', 'Enter'].includes(event.key) && inside('button,a')) return 0;
    return FORWARD.includes(event.key) ? 1 : BACK.includes(event.key) ? -1 : 0;
  }

  // A data URL or a file page has an opaque origin, which serializes as "null" and cannot be a target.
  function opaque(origin) { return !origin || origin === 'null'; }
  function targetOrigin(own, configured) { return configured || (opaque(own) ? '*' : own); }
  function trusted(target, incoming) { return target === '*' || incoming === target; }

  const count = value => Number.isInteger(value) && value > 0;

  // The pure state of one figure. `send` receives each outgoing message. No DOM is used.
  function controller(options = {}) {
    const prefix = options.prefix ?? DEFAULT_PREFIX, names = types(prefix);
    const embedded = options.embedded === true;
    let identity = {...options.identity};
    let total = count(options.total) ? options.total : 1;
    let page = Number.isInteger(options.page) && options.page >= 0 ? options.page : 0;
    let pending = null, ready = false;
    let requested = !embedded, visible = options.visible !== false, active = requested && visible;

    function emit(name, fields) {
      if (embedded && options.send) options.send({type: prefix + name, ...identity, ...fields});
    }
    function sync() {
      const next = requested && visible;
      if (next === active) return;
      active = next;
      if (options.onActive) options.onActive(active);
    }
    function show(next) {
      const previous = page;
      page = next;
      if (options.onPage) options.onPage(page, {previous, total});
      emit('page', {page, total});
    }
    function step(delta) {
      if (!ready || ![-1, 1].includes(delta)) return false;
      const next = page + delta;
      if (next < 0 || next >= total) { emit('boundary', {delta, page, total}); return false; }
      show(next);
      return true;
    }
    function stepTo(next) {
      if (!Number.isInteger(next) || next < 0) return false;
      if (!ready) { pending = next; return true; }
      if (next >= total) return false;
      show(next);
      return true;
    }
    return {
      get page() { return page; },
      get total() { return total; },
      get ready() { return ready; },
      get active() { return active; },
      get embedded() { return embedded; },
      get identity() { return {...identity}; },
      // Call when the figure can draw. Call again when the number of steps changes.
      markReady(steps) {
        if (steps !== undefined) {
          if (!count(steps)) throw new RangeError('Invalid step total');
          total = steps;
        }
        ready = true;
        const start = pending !== null && pending < total ? pending : Math.min(page, total - 1);
        pending = null;
        emit('ready', {total});
        show(start);
      },
      step, stepTo, emit,
      setIdentity(fields) { identity = {...identity, ...fields}; },
      setVisible(value) { visible = value === true; sync(); },
      receive(data) {
        if (!data || typeof data !== 'object' || !matches(identity, data)) return false;
        if (data.type === names.playback) {
          if (typeof data.active !== 'boolean') return false;
          requested = data.active;
          sync();
        } else if (data.type === names.step) step(data.delta);
        else if (data.type === names.stepTo) stepTo(data.page);
        else return false;
        return true;
      },
      // An embedded figure hands the key to its deck. A standalone page steps itself.
      key(event) {
        const delta = keyDelta(event);
        if (!delta) return 0;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (embedded) emit('navigate', {delta}); else step(delta);
        return delta;
      },
    };
  }

  // The browser adapter. It never reads or writes the manual pause intent of the page.
  function attach(options = {}) {
    const win = options.window || root, doc = win.document;
    const embedded = win.parent !== win;
    const target = targetOrigin(win.location.origin, options.origin);
    const figure = controller({
      ...options, embedded, visible: doc.visibilityState === 'visible',
      send: message => win.parent.postMessage(message, target),
    });
    const message = event => {
      if (embedded && event.source === win.parent && trusted(target, event.origin)) figure.receive(event.data);
    };
    const visibility = () => figure.setVisible(doc.visibilityState === 'visible');
    const key = event => figure.key(event);
    win.addEventListener('message', message);
    doc.addEventListener('visibilitychange', visibility);
    if (options.keys !== false) doc.addEventListener('keydown', key);
    figure.destroy = () => {
      win.removeEventListener('message', message);
      doc.removeEventListener('visibilitychange', visibility);
      doc.removeEventListener('keydown', key);
    };
    return figure;
  }

  const api = {DEFAULT_PREFIX, types, matches, keyDelta, opaque, targetOrigin, trusted, controller, attach};
  root.FrameSteps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
