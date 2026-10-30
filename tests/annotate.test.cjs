const test = require('node:test');
const assert = require('node:assert/strict');
const {formatTuicr, TYPES} = require('../runtime/annotate.js');

test('an animated SVG target retains its selected address after DOM replacement', () => {
  const {targetAddress} = require('../runtime/annotate.js');
  const root = {id:'slide-28-en-p3', matches:() => true};
  const figure = {id:'figure-28', parentNode:root, textContent:'Model', matches:() => false, getAttribute:() => null};
  const body = {children:[]};
  const svg = {id:'plot', tagName:'svg', parentNode:body, children:[]};
  const label = {id:'', tagName:'text', parentNode:svg, textContent:'Apparent longitude', getAttribute:() => null};
  body.children.push(svg); svg.children.push(label);
  const frame = {dataset:{}, contentDocument:{body}, getAttribute:() => 'model.html?lang=en'};
  const address = targetAddress({el:figure, frame, inner:label, pin:{x:50,y:30}});
  label.parentNode = null;
  svg.children = [];
  root.id = 'slide-28-cs-p1';
  frame.contentDocument = {body:{children:[]}};
  assert.equal(address.slide, 'slide-28-en-p3');
  assert.equal(address.path, '#figure-28');
  assert.deepEqual(address.inner, {src:'model.html', path:'#plot › text', snippet:'Apparent longitude'});
  assert.match(formatTuicr([{...address, kind:'note', text:'Keep this label', ts:'1'}]), /Apparent longitude/);
});

test('tuicr export lists numbered typed comments with a legend of used types', () => {
  const text = formatTuicr([
    {slide: 'one-prompt', path: 'h2', kind: 'issue', text: 'heading wraps to three lines', snippet: 'One prompt', ts: '1'},
    {slide: 'fan-out', path: 'ul › li[2]', kind: 'praise', text: 'clear', snippet: '', ts: '2'},
  ]);
  const lines = text.split('\n');
  assert.equal(lines[0], 'I reviewed your slides and have the following comments. Please address them.');
  assert.equal(lines[2], 'Comment types: ISSUE (problems to fix), PRAISE (positive feedback)');
  assert.equal(lines[4], '## Local tuicr Comments');
  assert.match(lines[6], /^1\. \*\*\[ISSUE\]\*\* `deck\.html#one-prompt › h2` - heading wraps to three lines \(on: “One prompt”\)$/);
  assert.match(lines[7], /^2\. \*\*\[PRAISE\]\*\* `deck\.html#fan-out › ul › li\[2\]` - clear$/);
});

test('the four tuicr kinds are the only kinds', () => {
  assert.deepEqual(TYPES.map((t) => t.label), ['ISSUE', 'NOTE', 'SUGGESTION', 'PRAISE']);
});

test('a note inside a figure frame names the frame file and the element path, and quotes the inner text', () => {
  const text = formatTuicr([
    {slide: 'a-model', path: 'div[2]', kind: 'issue', text: 'stamp clipped', snippet: 'whole figure', pin: {x: 90, y: 20},
     inner: {src: 'graphics/llm-file-figure.html', path: '#stamp', snippet: 'NO PROGRAM INSIDE FROZEN SINCE TRAINING'}, ts: '1'},
  ]);
  const line = text.split('\n')[6];
  assert.match(line, /`deck\.html#a-model › div\[2\] › graphics\/llm-file-figure\.html › #stamp` - stamp clipped \(on: “NO PROGRAM INSIDE FROZEN SINCE TRAINING”\)$/);
  assert.doesNotMatch(line, /of the figure/);
});
