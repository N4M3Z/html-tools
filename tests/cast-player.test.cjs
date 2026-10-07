const test = require('node:test');
const assert = require('node:assert/strict');
const {parse, scenes, sceneAt, render, controller, clock} = require('../runtime/cast-player.js');

const CAST = [
  '{"version": 2, "width": 60, "height": 4}',
  '[0.0, "o", "\\u001b[2J\\u001b[H"]',
  '[0.5, "o", "\\u001b[2m# Scenario: Head already pushed\\u001b[0m\\r\\n"]',
  '[1.0, "o", "\\u001b[1;32m❯\\u001b[0m rune sign queue\\r\\n"]',
  '[1.5, "o", "progress 1\\rprogress 2\\r\\n"]',
  '[2.0, "o", "\\u001b[2m# Scenario: Head signed\\u001b[0m\\r\\n"]',
  '[2.5, "o", "signed change/x <ok>\\r\\n"]',
  '[3.0, "x", "ignored input"]',
].join('\n');

test('parse keeps output events and the terminal size', () => {
  const cast = parse(CAST);
  assert.equal(cast.width, 60);
  assert.equal(cast.height, 4);
  assert.equal(cast.events.length, 6);
  assert.equal(cast.duration, 2.5);
});

test('scenes come from the driver marker and sceneAt finds the current one', () => {
  const list = scenes(parse(CAST));
  assert.deepEqual(list.map((s) => s.title), ['Head already pushed', 'Head signed']);
  assert.equal(sceneAt(list, 0.2), -1);
  assert.equal(sceneAt(list, 1.9), 0);
  assert.equal(sceneAt(list, 2.0), 1);
});

test('scenes also come from the boxed title rune proof run prints', () => {
  const boxed = [
    '{"version": 2, "width": 60, "height": 4}',
    '[0.0, "o", "\\u001b[2m┌──────────┐\\u001b[0m\\r\\n\\u001b[2m│\\u001b[0m \\u001b[1m1/2 · Head pushed\\u001b[0m \\u001b[2m│\\u001b[0m\\r\\n"]',
    '[4.0, "o", "\\u001b[2m│\\u001b[0m \\u001b[1m2/2 · Head signed\\u001b[0m \\u001b[2m│\\u001b[0m\\r\\n"]',
  ].join('\n');
  const list = scenes(parse(boxed));
  assert.deepEqual(list.map((s) => [s.time, s.title]), [[0, 'Head pushed'], [4, 'Head signed']]);
});

test('render replays clear, styles, carriage return, and keeps every line', () => {
  const cast = parse(CAST);
  const early = render(cast, 1.0);
  assert.equal(early.length, 3, 'two lines and the open one');
  assert.deepEqual(early[0].map((s) => s.style), [['sgr-2']], 'the reset before the newline adds no segment');
  assert.equal(early[1][0].text, '❯');
  assert.deepEqual(early[1][0].style, ['sgr-1', 'sgr-32']);
  assert.equal(early[1][1].text, ' rune sign queue');
  const mid = render(cast, 1.5);
  assert.equal(mid[2].map((s) => s.text).join(''), 'progress 2', 'a carriage return rewinds the line');
  const late = render(cast, 9);
  assert.equal(late.length, 6, 'every line stays, plus the open one; the screen scrolls');
  assert.equal(late[late.length - 2].map((s) => s.text).join(''), 'signed change/x <ok>');
});

test('the controller advances with the clock, pauses, seeks, and stops at the end', () => {
  const cast = parse(CAST);
  const seen = [];
  const player = controller(cast, (time) => seen.push(time));
  player.play(1000);
  assert.equal(player.playing, true);
  assert.equal(player.tick(1500), true);
  assert.ok(Math.abs(player.time - 0.5) < 1e-9);
  player.pause();
  assert.equal(player.tick(9000), false, 'a paused player ignores the clock');
  assert.ok(Math.abs(player.time - 0.5) < 1e-9);
  player.seek(2.0, 9000);
  assert.equal(player.time, 2.0);
  player.play(10000);
  assert.equal(player.tick(11000), false, 'reaching the end stops playback');
  assert.equal(player.time, cast.duration);
  player.play(12000);
  assert.equal(player.time, 0, 'play at the end restarts');
  assert.ok(seen.length >= 6);
});

test('clock formats minutes and seconds', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(65.9), '1:05');
});

test('attach keeps the playhead moving with no animation frames', () => {
  // A hidden tab never fires requestAnimationFrame; the clock must not
  // depend on it. These timers tick by hand and offer no frame at all.
  const {attach} = require('../runtime/cast-player.js');
  let clock = 0;
  const intervals = [];
  const timers = {now: () => clock, setInterval: (fn) => intervals.push(fn), clearInterval: () => { intervals.length = 0; }};
  const made = {};
  const element = (tag) => ({
    tag, children: [], attributes: {}, listeners: {}, classList: {add() {}, toggle() {}},
    style: {}, appendChild(child) { this.children.push(child); return child; },
    addEventListener(name, fn) { this.listeners[name] = fn; }, setAttribute(k, v) { this.attributes[k] = v; }, focus() {},
    querySelector(sel) { return made[sel] || (made[sel] = element(sel)); },
    get innerHTML() { return this.html || ''; }, set innerHTML(v) { this.html = v; },
    get textContent() { return this.text || ''; }, set textContent(v) { this.text = v; },
  });
  const doc = {getElementById: () => null, createElement: element, head: element('head')};
  const host = element('div'); host.ownerDocument = doc;
  const framed = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => { throw new Error('animation frame requested'); };
  try {
    const player = attach(host, CAST, {timers});
    made['.cast-toggle'].listeners.click();
    assert.equal(player.playing, true);
    assert.equal(intervals.length, 1, 'one interval drives the clock');
    clock = 1200;
    intervals[0]();
    assert.ok(player.time > 1.1 && player.time < 1.3, 'the playhead followed the clock: ' + player.time);
    clock = 9000;
    intervals[0]();
    assert.equal(player.playing, false, 'playback stops at the end');
    assert.equal(intervals.length, 0, 'the interval is cleared at the end');
  } finally {
    if (framed) globalThis.requestAnimationFrame = framed; else delete globalThis.requestAnimationFrame;
  }
});
