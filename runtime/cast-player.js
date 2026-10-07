// Play an asciinema v2 cast in the page with pause, resume, a scrubber, and
// the scene the playhead is in. A scene is a line `# Scenario: <title>` in
// the recording, the AcceptanceTesting driver's own marker, or the boxed
// `│ N/T · <title> │` line that `rune proof run` prints, so a proof names
// its own chapters. Pure functions export through module.exports for node;
// `CastPlayer.attach(host, text, options)` builds the controls in a browser:
// `options.onFrame(time, sceneIndex, scenes)` runs on every frame and
// `options.chapters === false` hides the built-in scene list, for a page
// that draws its own, and `options.timers` supplies `setInterval`,
// `clearInterval`, and `now` in a test. The player it returns seeks with
// `seek(time, now)`. The clock is an interval, never an animation frame,
// because a hidden tab stops frames and the playhead would freeze.
(function (root) {
  'use strict';
  const SGR = /\x1b\[([0-9;]*)m/g;
  const CONTROL = /\x1b\[[0-9;?]*[A-Za-z]/g;

  function parse(text) {
    const lines = String(text).split('\n').filter((line) => line.trim() !== '');
    const header = JSON.parse(lines[0]);
    const events = lines.slice(1).map((line) => JSON.parse(line))
      .filter((event) => event[1] === 'o')
      .map((event) => ({time: Number(event[0]), data: String(event[2])}));
    return {width: header.width || 80, height: header.height || 24, events,
      duration: events.length ? events[events.length - 1].time : 0};
  }

  // The scenes of a cast: the time each `# Scenario:` line or boxed
  // `│ N/T · title │` line first appears.
  const SCENE = /# Scenario: ([^\r\n]+)|│ \d+\/\d+ · ([^│\r\n]+) │/;
  function scenes(cast) {
    const found = [];
    for (const event of cast.events) {
      const plain = event.data.replace(CONTROL, '');
      const match = plain.match(SCENE);
      if (match) found.push({time: event.time, title: (match[1] || match[2]).trim()});
    }
    return found;
  }

  function sceneAt(list, time) {
    let index = -1;
    for (let i = 0; i < list.length; i++) if (list[i].time <= time) index = i;
    return index;
  }

  // The screen at `time`: replay every event up to it through a small
  // terminal model. Clear-screen restarts the buffer, a carriage return
  // rewinds the line, and SGR codes become style names on the segments.
  function render(cast, time) {
    const lines = [[]];
    let style = [];
    const line = () => lines[lines.length - 1];
    function text(chunk) {
      chunk.replace(/\r\n/g, '\n').split('\n').forEach((part, i) => {
        if (i > 0) lines.push([]);
        part.split('\r').forEach((piece, j) => {
          if (j > 0) line().length = 0;
          if (piece) line().push({text: piece, style: style.slice()});
        });
      });
    }
    for (const event of cast.events) {
      if (event.time > time) break;
      let data = event.data;
      const clear = data.lastIndexOf('\x1b[2J');
      if (clear >= 0) { data = data.slice(clear + 4); lines.length = 0; lines.push([]); }
      data = data.replace(/\x1b\[H/g, '');
      let last = 0;
      for (const match of data.matchAll(SGR)) {
        text(data.slice(last, match.index));
        last = match.index + match[0].length;
        const codes = match[1] === '' ? ['0'] : match[1].split(';');
        for (const code of codes) style = code === '0' ? [] : style.concat('sgr-' + code);
      }
      text(data.slice(last));
    }
    // Every line stays: the screen scrolls instead of dropping what an
    // early event printed, so a long output remains readable and searchable.
    return lines;
  }

  // The clock-free controller the browser wraps: play, pause, seek, tick.
  function controller(cast, onFrame) {
    const state = {time: 0, playing: false, speed: 1, anchor: null};
    function emit() { onFrame(state.time); }
    return {
      get time() { return state.time; },
      get playing() { return state.playing; },
      play(now) { if (state.time >= cast.duration) state.time = 0; state.playing = true; state.anchor = {now, time: state.time}; emit(); },
      pause() { state.playing = false; state.anchor = null; emit(); },
      toggle(now) { state.playing ? this.pause() : this.play(now); },
      seek(time, now) { state.time = Math.max(0, Math.min(cast.duration, time)); if (state.playing) state.anchor = {now, time: state.time}; emit(); },
      setSpeed(speed, now) { if (state.playing) state.anchor = {now, time: state.time}; state.speed = speed; },
      tick(now) {
        if (!state.playing) return false;
        state.time = Math.min(cast.duration, state.anchor.time + (now - state.anchor.now) / 1000 * state.speed);
        if (state.time >= cast.duration) state.playing = false;
        emit();
        return state.playing;
      },
    };
  }

  function clock(seconds) {
    const whole = Math.floor(seconds);
    return String(Math.floor(whole / 60)) + ':' + String(whole % 60).padStart(2, '0');
  }

  const CSS = '.cast{display:grid;gap:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}' +
    '.cast pre{margin:0;padding:12px 14px;background:#0d1117;color:#e6edf3;border-radius:6px;overflow:auto;white-space:pre;line-height:1.35;min-height:8em;cursor:pointer;position:relative}' +
    '.cast pre.paused::after{content:"paused";position:absolute;top:8px;right:10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b949e}' +
    '.cast .sgr-1{font-weight:700}.cast .sgr-2{opacity:.6}.cast .sgr-31{color:#ff7b72}.cast .sgr-32{color:#3fb950}.cast .sgr-33{color:#d29922}' +
    '.cast .sgr-34{color:#58a6ff}.cast .sgr-35{color:#bc8cff}.cast .sgr-36{color:#39c5cf}.cast .sgr-90{color:#8b949e}' +
    '.cast-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cast-bar button{font:inherit;padding:4px 10px;cursor:pointer}' +
    '.cast-bar input[type=range]{flex:1;min-width:120px}.cast-scene{font-weight:600}.cast-time{font-variant-numeric:tabular-nums;opacity:.75}' +
    '.cast-scenes{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}.cast-scenes[hidden]{display:none}.cast-scenes button{font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}' +
    '.cast-scenes .current button{outline:2px solid currentColor}';

  function attach(host, text, options = {}) {
    const doc = host.ownerDocument;
    if (!doc.getElementById('cast-player-style')) {
      const style = doc.createElement('style'); style.id = 'cast-player-style'; style.textContent = CSS; doc.head.appendChild(style);
    }
    const cast = parse(text);
    const list = scenes(cast);
    host.classList.add('cast');
    host.innerHTML = '<pre tabindex="0" aria-live="off"></pre><div class="cast-bar"><button type="button" class="cast-toggle">Play</button>' +
      '<input type="range" min="0" step="0.05" aria-label="Position"><span class="cast-time">0:00 / ' + clock(cast.duration) + '</span>' +
      '<span class="cast-scene"></span></div><ol class="cast-scenes"></ol>';
    const screen = host.querySelector('pre'), toggle = host.querySelector('.cast-toggle');
    const range = host.querySelector('input'), timeLabel = host.querySelector('.cast-time');
    const sceneLabel = host.querySelector('.cast-scene'), sceneList = host.querySelector('.cast-scenes');
    range.max = String(cast.duration);
    list.forEach((scene, index) => {
      const item = doc.createElement('li'), button = doc.createElement('button');
      button.type = 'button'; button.textContent = (index + 1) + '. ' + scene.title;
      button.addEventListener('click', () => { player.seek(scene.time, now()); if (!player.playing) player.play(now()); loop(); });
      item.appendChild(button); sceneList.appendChild(item);
    });
    const now = () => (options.timers && options.timers.now ? options.timers.now() : (root.performance || Date).now());
    function draw(time) {
      screen.innerHTML = render(cast, time).map((line) => line.map((s) =>
        '<span class="' + s.style.join(' ') + '">' + s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>').join('')).join('\n');
      range.value = String(time);
      range.setAttribute('aria-valuetext', clock(time) + ' of ' + clock(cast.duration));
      timeLabel.textContent = clock(time) + ' / ' + clock(cast.duration);
      if (player.playing) screen.scrollTop = screen.scrollHeight;
      const index = sceneAt(list, time);
      sceneLabel.textContent = index < 0 ? '' : 'Scene ' + (index + 1) + ' of ' + list.length + ': ' + list[index].title;
      Array.from(sceneList.children).forEach((item, i) => item.classList.toggle('current', i === index));
      toggle.textContent = player.playing ? 'Pause' : (time >= cast.duration ? 'Replay' : 'Play');
      screen.classList.toggle('paused', !player.playing && time > 0 && time < cast.duration);
      screen.title = player.playing ? 'Click to pause' : 'Click to play';
      // A page that draws its own chapter list follows the playhead here.
      if (options.onFrame) options.onFrame(time, index, list);
    }
    const player = controller(cast, draw);
    if (options.chapters === false) sceneList.hidden = true;
    // The clock is an interval, not requestAnimationFrame: a browser stops
    // animation frames in a hidden or unfocused tab, and the playhead
    // would freeze there while the controls still said "playing". Forty
    // milliseconds is above a screen frame and well below the eye.
    // `options.timers` replaces the window's interval and clock in a test.
    const timers = options.timers || root;
    let timer = null;
    function loop() {
      if (timer || !player.playing) return;
      timer = timers.setInterval(() => { if (!player.tick(now())) { timers.clearInterval(timer); timer = null; } }, 40);
    }
    toggle.addEventListener('click', () => { player.toggle(now()); loop(); });
    // The screen itself is the biggest control: a click pauses or resumes,
    // the way a video does. A drag to select text is not a click.
    screen.addEventListener('click', () => {
      if (root.getSelection && String(root.getSelection()).length) return;
      player.toggle(now()); loop(); screen.focus();
    });
    range.addEventListener('input', () => player.seek(Number(range.value), now()));
    host.addEventListener('keydown', (event) => {
      // The slider keeps its own arrow keys; the shortcuts belong to the screen.
      if (event.target === range) return;
      if (event.key === ' ') { event.preventDefault(); player.toggle(now()); loop(); }
      const index = sceneAt(list, player.time);
      if (event.key === 'ArrowRight' && list[index + 1]) player.seek(list[index + 1].time, now());
      if (event.key === 'ArrowLeft' && index > 0) player.seek(list[index - 1].time, now());
    });
    draw(0);
    if (options.autoplay) { player.play(now()); loop(); }
    return player;
  }

  const api = {parse, scenes, sceneAt, render, controller, clock, attach};
  root.CastPlayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
