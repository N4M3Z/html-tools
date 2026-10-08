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
