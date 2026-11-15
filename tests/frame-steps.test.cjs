const test = require('node:test');
const assert = require('node:assert/strict');
const {DEFAULT_PREFIX, types, matches, keyDelta, targetOrigin, trusted, controller, attach} = require('../runtime/frame-steps.js');

function figure(options = {}) {
  const sent = [], pages = [], activity = [];
  const model = controller({embedded:true, total:4, send:message => sent.push(message),
    onPage:(page, detail) => pages.push([page, detail.previous, detail.total]), onActive:value => activity.push(value), ...options});
  return {model, sent, pages, activity};
}

test('the default prefix and a custom prefix name the same seven messages', () => {
  assert.equal(DEFAULT_PREFIX, 'slidekit:figure-');
  assert.deepEqual(types(), {
    ready:'slidekit:figure-ready', page:'slidekit:figure-page', boundary:'slidekit:figure-boundary',
    navigate:'slidekit:figure-navigate', step:'slidekit:figure-step', stepTo:'slidekit:figure-step-to',
    playback:'slidekit:figure-playback',
  });
  assert.equal(types('uro-tool-').stepTo, 'uro-tool-step-to');
});

test('the compatibility prefix and identity produce the existing talk messages', () => {
  const identity = {tool:'blender', model:'cortex-94-r2', lang:'cs', slide:94};
  const {model, sent} = figure({prefix:'uro-tool-', identity});
  model.markReady();
  model.receive({type:'uro-tool-step', delta:1});
  model.receive({type:'uro-tool-step', delta:-1});
  model.receive({type:'uro-tool-step', delta:-1});
  model.key({key:'ArrowRight', preventDefault() {}});
  assert.deepEqual(sent, [
    {type:'uro-tool-ready', ...identity, total:4},
    {type:'uro-tool-page', ...identity, page:0, total:4},
    {type:'uro-tool-page', ...identity, page:1, total:4},
    {type:'uro-tool-page', ...identity, page:0, total:4},
    {type:'uro-tool-boundary', ...identity, delta:-1, page:0, total:4},
    {type:'uro-tool-navigate', ...identity, delta:1},
  ]);
  assert.deepEqual(Object.keys(sent[0]), ['type', 'tool', 'model', 'lang', 'slide', 'total']);
});

test('a step before ready is ignored and a step-to before ready waits', () => {
  const {model, sent, pages} = figure();
  assert.equal(model.receive({type:'slidekit:figure-step', delta:1}), true);
  assert.equal(model.page, 0);
  model.receive({type:'slidekit:figure-step-to', page:2});
  assert.deepEqual(sent, []);
  assert.deepEqual(pages, []);
  model.markReady();
  assert.equal(model.page, 2);
  assert.deepEqual(sent.map(message => message.type), ['slidekit:figure-ready', 'slidekit:figure-page']);
  assert.deepEqual(pages, [[2, 0, 4]]);
});

test('a waiting page outside the final total is dropped and ready can change the total', () => {
  const {model, sent} = figure({total:undefined});
  model.stepTo(9);
  model.markReady(3);
  assert.equal(model.page, 0);
  assert.equal(model.stepTo(3), false);
  assert.equal(model.stepTo(2), true);
  model.markReady(2);
  assert.equal(model.page, 1);
  assert.deepEqual(sent.at(-1), {type:'slidekit:figure-page', page:1, total:2});
  assert.throws(() => model.markReady(0), /Invalid step total/);
});

test('steps move one page, reject other deltas, and report a boundary without moving', () => {
  const {model, sent} = figure({total:2});
  model.markReady();
  for (const delta of [0, 2, '1', null]) assert.equal(model.step(delta), false);
  assert.equal(model.step(1), true);
  assert.equal(model.step(1), false);
  assert.equal(model.page, 1);
  assert.deepEqual(sent.at(-1), {type:'slidekit:figure-boundary', delta:1, page:1, total:2});
  model.receive({type:'slidekit:figure-step-to', page:1});
  assert.deepEqual(sent.at(-1), {type:'slidekit:figure-page', page:1, total:2}, 'a step-to the same page is confirmed');
  for (const page of [-1, 2, 1.5, '1']) assert.equal(model.stepTo(page), false);
});

test('a message with a disagreeing identity field is ignored', () => {
  assert.equal(matches({tool:'a', lang:'cs'}, {type:'x'}), true);
  assert.equal(matches({tool:'a', lang:'cs'}, {tool:'a', lang:'en'}), false);
  const {model} = figure({identity:{tool:'a', lang:'cs'}});
  model.markReady();
  assert.equal(model.receive({type:'slidekit:figure-step', delta:1, lang:'en'}), false);
  assert.equal(model.page, 0);
  model.setIdentity({lang:'en'});
  assert.equal(model.receive({type:'slidekit:figure-step', delta:1, lang:'en'}), true);
  assert.equal(model.page, 1);
  for (const data of [null, 'slidekit:escape', {type:'other'}, {type:'slidekit:figure-playback', active:'yes'}]) {
    assert.equal(model.receive(data), false);
  }
});

test('an embedded figure is active only when the deck says so and the document is visible', () => {
  const {model, activity} = figure();
  assert.equal(model.active, false);
  model.receive({type:'slidekit:figure-playback', active:true});
  model.setVisible(false);
  model.receive({type:'slidekit:figure-playback', active:false});
  model.setVisible(true);
  model.receive({type:'slidekit:figure-playback', active:true});
  model.receive({type:'slidekit:figure-playback', active:true});
  assert.deepEqual(activity, [true, false, true]);
  const alone = figure({embedded:false, visible:false});
  assert.equal(alone.model.active, false);
  alone.model.setVisible(true);
  assert.deepEqual(alone.activity, [true]);
});

test('navigation keys skip modifiers, form fields, sliders, and activation keys on controls', () => {
  const on = selector => ({closest:query => query.split(',').some(part => part.startsWith(selector)) ? {} : null});
  assert.equal(keyDelta({key:'ArrowRight'}), 1);
  assert.equal(keyDelta({key:'PageDown'}), 1);
  assert.equal(keyDelta({key:' '}), 1);
  assert.equal(keyDelta({key:'ArrowLeft'}), -1);
  assert.equal(keyDelta({key:'PageUp'}), -1);
  assert.equal(keyDelta({key:'Enter'}), 0);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'defaultPrevented']) assert.equal(keyDelta({key:'ArrowRight', [modifier]:true}), 0);
  for (const field of ['input', 'textarea', 'select', '[role="slider"]', '[contenteditable]']) assert.equal(keyDelta({key:'ArrowRight', target:on(field)}), 0);
  assert.equal(keyDelta({key:' ', target:on('button')}), 0);
  assert.equal(keyDelta({key:' ', target:on('a')}), 0);
  assert.equal(keyDelta({key:'ArrowRight', target:on('button')}), 1);
});

test('a standalone page steps itself and sends nothing', () => {
  const {model, sent} = figure({embedded:false});
  let prevented = 0;
  model.markReady();
  assert.equal(model.key({key:'ArrowRight', preventDefault() { prevented++; }}), 1);
  assert.equal(model.key({key:'a', preventDefault() { prevented++; }}), 0);
  assert.equal(model.page, 1);
  assert.equal(prevented, 1);
  assert.deepEqual(sent, []);
});

test('an opaque origin posts to any origin and a real origin posts to itself', () => {
  assert.equal(targetOrigin('https://example.test'), 'https://example.test');
  assert.equal(targetOrigin('null'), '*');
  assert.equal(targetOrigin(''), '*');
  assert.equal(targetOrigin('null', 'https://deck.test'), 'https://deck.test');
  assert.equal(trusted('*', 'null'), true);
  assert.equal(trusted('https://example.test', 'https://example.test'), true);
  assert.equal(trusted('https://example.test', 'https://other.test'), false);
});

function page(origin) {
  const listeners = new Map(), posted = [];
  const target = () => ({addEventListener:(type, fn) => listeners.set(type, fn), removeEventListener:type => listeners.delete(type)});
  const parent = {postMessage:(message, to) => posted.push([message.type, to])};
  const win = {...target(), parent, location:{origin}, document:{...target(), visibilityState:'visible'}};
  return {win, parent, posted, listeners};
}

test('the adapter accepts only its parent and works from a data URL frame', () => {
  const share = page('null');
  const model = attach({window:share.win, total:2});
  model.markReady();
  assert.deepEqual(share.posted, [['slidekit:figure-ready', '*'], ['slidekit:figure-page', '*']]);
  const message = share.listeners.get('message');
  message({source:{}, origin:'null', data:{type:'slidekit:figure-step', delta:1}});
  assert.equal(model.page, 0);
  message({source:share.parent, origin:'https://deck.test', data:{type:'slidekit:figure-step', delta:1}});
  assert.equal(model.page, 1);
  model.destroy();
  assert.equal(share.listeners.size, 0);

  const served = page('https://example.test');
  const strict = attach({window:served.win, total:2});
  strict.markReady();
  assert.equal(served.posted[0][1], 'https://example.test');
  const receive = served.listeners.get('message');
  receive({source:served.parent, origin:'https://other.test', data:{type:'slidekit:figure-step', delta:1}});
  assert.equal(strict.page, 0);
  receive({source:served.parent, origin:'https://example.test', data:{type:'slidekit:figure-step', delta:1}});
  assert.equal(strict.page, 1);
});
