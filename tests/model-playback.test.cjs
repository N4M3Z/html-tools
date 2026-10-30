const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {controller} = require('../runtime/model-playback.js');

test('model autoplays and parameter edits do not alter pause or clock', () => {
  const model = controller({min:0, max:10, value:2});
  assert.equal(model.playing, true);
  model.tick(.05); model.setValue(8);
  assert.equal(model.value, 8); assert.equal(model.time, .05);
  model.tick(.05); assert.equal(model.time, .1);
  model.pause(); model.setValue(4); model.tick(.1);
  assert.equal(model.time, .1); assert.equal(model.playing, false);
});

test('explicit pause, time, and value survive a language-independent snapshot remount', () => {
  const model = controller({min:0, max:10}); model.tick(.08); model.setValue(7); model.pause();
  const snapshot = JSON.stringify(model.snapshot());
  const remount = controller({min:0, max:10, snapshot});
  assert.deepEqual(remount.snapshot(), model.snapshot());
  assert.equal(remount.playing, false);
  const detached = remount.snapshot(); detached.paused = false;
  assert.equal(remount.paused, true);
});

test('reduced motion gates restored play and requires local Play on each mount', () => {
  const snapshot = {version:1, time:2, value:.5, paused:false};
  const model = controller({snapshot, reducedMotion:true});
  model.setActive(false); model.setActive(true);
  assert.equal(model.playing, false);
  model.play(); assert.equal(model.playing, true);
  const remount = controller({snapshot:model.snapshot(), reducedMotion:true});
  assert.equal(remount.playing, false);
  model.setReducedMotion(true); assert.equal(model.playing, false);
  model.setReducedMotion(false); assert.equal(model.playing, true);
  model.pause(); model.setReducedMotion(true); model.setReducedMotion(false);
  assert.equal(model.playing, false);
});

test('temporary gates preserve explicit intent and freeze the model clock', () => {
  for (const gate of ['setActive','setVisible','setBlocked']) {
    const model = controller(); model.tick(.05);
    model[gate](gate === 'setBlocked'); model.tick(.1);
    assert.equal(model.time, .05); assert.equal(model.snapshot().paused, false);
    model[gate](gate !== 'setBlocked'); model.tick(.05);
    assert.equal(model.time, .1);
    model.pause(); model[gate](gate === 'setBlocked'); model[gate](gate !== 'setBlocked');
    assert.equal(model.playing, false);
  }
});

test('malformed snapshots and invalid inputs remain finite and bounded', () => {
  for (const snapshot of ['{', 'null', '[]', {version:9,time:99,value:9}, {version:1,time:Infinity,value:NaN}]) {
    const model = controller({min:1,max:4,value:2,snapshot});
    assert.equal(model.time, 0); assert.equal(model.value, 2); assert.equal(model.playing, true);
    for (const value of [NaN, Infinity, '3']) assert.equal(model.setValue(value), false);
    for (const seconds of [NaN, Infinity, -1, 0]) assert.equal(model.tick(seconds), false);
    assert.equal(model.time, 0);
    model.setValue(100); assert.equal(model.value, 4);
    model.setValue(-100); assert.equal(model.value, 1);
  }
  assert.throws(() => controller({min:2,max:1}), RangeError);
});

test('model time is continuous across cycle boundaries and limits late frames', () => {
  const model = controller({snapshot:{version:1,time:.99,value:.5,paused:false}});
  model.tick(.02); assert.equal(model.time, 1.01);
  model.tick(20); assert.equal(model.time, 1.11);
});

function events(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) { for (const fn of listeners.get(type) || []) fn(); },
    count() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
  });
}

function browser(options = {}) {
  const document = events({hidden:false}), media = events({matches:options.reduced === true});
  const stored = new Map(options.snapshot ? [['demo', JSON.stringify(options.snapshot)]] : []);
  const frames = new Map(); let id = 0;
  const window = events({document, matchMedia:() => media,
    sessionStorage:{getItem:key => stored.get(key) || null, setItem:(key,value) => stored.set(key,value)},
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(key) { frames.delete(key); },
  });
  vm.runInNewContext(fs.readFileSync(require.resolve('../runtime/model-playback.js'), 'utf8'), {window});
  return {window, document, media, stored,
    attach:onFrame => window.ModelPlayback.attach({key:'demo', min:0, max:10, value:1, onFrame}),
    frame(now) { const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(now); },
    pending:() => frames.size,
  };
}

test('attach keeps ticking when every animation frame follows a held-slider input', () => {
  const env = browser(); const draws = [];
  const player = env.attach(state => draws.push({time:state.time,value:state.value}));
  env.frame(0);
  for (let n=1; n<=40; n++) {
    player.setValue(n/10);
    assert.equal(draws.at(-1).value, n/10, 'input must draw synchronously');
    const before = player.snapshot().time;
    env.frame(n*16);
    assert.ok(player.snapshot().time > before, 'held input must not reset the frame clock');
  }
  assert.ok(player.snapshot().time > .63);
  player.pause(); const time = player.snapshot().time;
  for (let n=41; n<=50; n++) { player.setValue(n/10); env.frame(n*16); }
  assert.equal(player.snapshot().time, time);
  assert.equal(player.snapshot().paused, true);
  player.destroy();
});

test('attach resets after a visibility gap, preserves remount state, and cleans up', () => {
  const env = browser(); const player = env.attach();
  env.frame(0); env.frame(20);
  env.document.hidden = true; env.document.emit('visibilitychange'); env.frame(10000);
  env.document.hidden = false; env.document.emit('visibilitychange'); env.frame(20000);
  assert.equal(player.snapshot().time, .02);
  env.frame(20020); assert.equal(player.snapshot().time, .04);
  player.setValue(6); player.pause(); player.destroy();
  assert.equal(env.pending(), 0); assert.equal(env.document.count(), 0); assert.equal(env.media.count(), 0); assert.equal(env.window.count(), 0);
  const remount = env.attach();
  assert.equal(remount.snapshot().time, .04); assert.equal(remount.snapshot().value, 6); assert.equal(remount.paused, true);
  remount.destroy();
});

test('attach cannot resume a reduced-motion snapshot through host activation', () => {
  const env = browser({reduced:true,snapshot:{version:1,time:3,value:4,paused:false}});
  const player = env.attach(); player.setActive(false); player.setActive(true);
  env.frame(0); env.frame(16); assert.equal(player.snapshot().time, 3);
  player.play(); env.frame(32); env.frame(48); assert.ok(player.snapshot().time > 3);
  player.destroy();
  const remount = env.attach(); assert.equal(remount.playing, false); remount.destroy();
});
