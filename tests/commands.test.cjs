const test = require('node:test');
const assert = require('node:assert/strict');
const palette = require('../runtime/palette.js');
const pane = require('../runtime/pane.js');

const commands = [
  {label: 'Overview grid', hint: 'G', group: 'navigate', run() {}},
  {label: 'High contrast', hint: 'H', group: 'modes', run() {}},
  {label: 'LIVE · the loop', hint: 'file', group: 'live', run() {}},
  {label: 'Something else', hint: '', run() {}},
  {label: 'Agents', hint: 'slide 2', group: 'slides', here: true, run() {}},
  {label: 'Context window', hint: 'slide 3', group: 'slides', run() {}},
];

test('the palette ranks prefix over substring over scattered words, and drops non-matches', () => {
  assert.equal(palette.score('Overview grid', 'over'), 3);
  assert.equal(palette.score('Overview grid', 'grid'), 2);
  assert.equal(palette.score('Overview grid', 'grid over'), 1);
  assert.equal(palette.score('Overview grid', 'blank'), 0);
  assert.deepEqual(palette.filter(commands, 'con').map((c) => c.label), ['Context window', 'High contrast']);
  assert.equal(palette.filter(commands, '').length, commands.length);
  assert.equal(palette.filter(commands, '', 2).length, 2);
});

test('the pane groups commands by their group, in order of first appearance, unnamed ones last-named "commands"', () => {
  const groups = pane.groupCommands(commands);
  assert.deepEqual(groups.map((g) => [g.name, g.commands.length]), [['navigate', 1], ['modes', 1], ['live', 1], ['commands', 1], ['slides', 2]]);
  assert.equal(groups[4].commands[0].here, true);
});

test('the jump list of a deck goes last in the pane, whenever it was registered', () => {
  const tool = {label: 'Annotate', hint: 'A', group: 'review', run() {}};
  const groups = pane.groupCommands([commands[4], commands[0], commands[5], tool]);
  assert.deepEqual(groups.map((g) => [g.name, g.commands.length]), [['navigate', 1], ['review', 1], ['slides', 2]]);
  assert.deepEqual(pane.groupCommands([commands[4], tool], []).map((g) => g.name), ['slides', 'review']);
});

test('C, ⌘P and Ctrl+P toggle the pane, Escape closes it, and a field keeps its keys', () => {
  const key = (name, extra = {}) => ({key: name, ...extra});
  assert.equal(pane.paneKey(key('c'), false, false), 'toggle');
  assert.equal(pane.paneKey(key('C'), true, false), 'toggle');
  assert.equal(pane.paneKey(key('c'), false, true), null);
  assert.equal(pane.paneKey(key('p', {metaKey: true}), false, false), 'toggle');
  assert.equal(pane.paneKey(key('P', {ctrlKey: true}), true, false), 'toggle');
  assert.equal(pane.paneKey(key('p', {metaKey: true}), false, true), 'toggle');
  assert.equal(pane.paneKey(key('p', {ctrlKey: true}), false, true), null);
  assert.equal(pane.paneKey(key('p', {metaKey: true, shiftKey: true}), false, false), null);
  assert.equal(pane.paneKey(key('p', {metaKey: true, repeat: true}), false, false), null);
  assert.equal(pane.paneKey(key('p'), false, false), null);
  assert.equal(pane.paneKey(key('c', {metaKey: true}), false, false), null);
  assert.equal(pane.paneKey(key('Escape'), true, false), 'close');
  assert.equal(pane.paneKey(key('Escape'), false, false), null);
  assert.equal(pane.paneKey(key('Escape'), true, true), null);
});
