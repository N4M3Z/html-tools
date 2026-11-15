const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const Pages = require('../runtime/companion-pages.js');

test('search folding removes case, diacritics and extra spaces in both languages', () => {
  assert.equal(Pages.fold('  Skočné   DMUTÍ '), 'skocne dmuti');
  assert.equal(Pages.fold('Příliš žluťoučký kůň'), 'prilis zlutoucky kun');
  assert.equal(Pages.fold(null), '');
  assert.equal(Pages.matches(['Skočné dmutí', 'Spring tide'], 'skocne'), true);
  assert.equal(Pages.matches(['Skočné dmutí', 'Spring tide'], 'TIDE dmuti'), true);
  assert.equal(Pages.matches(['Skočné dmutí', null], 'neap'), false);
  assert.equal(Pages.matches(['anything'], '   '), true);
});

test('a language map gives the language, then the fallback, then any text', () => {
  assert.equal(Pages.pick({en: 'Tide', cs: 'Dmutí'}, 'cs', 'en'), 'Dmutí');
  assert.equal(Pages.pick({en: 'Tide'}, 'cs', 'en'), 'Tide');
  assert.equal(Pages.pick({de: 'Gezeiten'}, 'cs', 'en'), 'Gezeiten');
  assert.equal(Pages.pick('Plain', 'cs', 'en'), 'Plain');
  assert.equal(Pages.pick({constructor: 1}, 'constructor', 'en'), '');
  assert.equal(Pages.pick(null, 'cs', 'en'), '');
  assert.deepEqual(Pages.texts({en: ['a', 'b'], cs: ['c']}), ['a', 'b', 'c']);
  assert.deepEqual(Pages.texts({en: 'a', cs: 2}), ['a']);
});

test('the order follows the collation of the language', () => {
  const words = ['hrad', 'chata', 'cihla', 'dům', 'čaj'];
  assert.deepEqual(Pages.sortBy(words, 'cs'), ['cihla', 'čaj', 'dům', 'hrad', 'chata']);
  assert.deepEqual(Pages.sortBy(words, 'en'), ['čaj', 'chata', 'cihla', 'dům', 'hrad']);
  assert.deepEqual(Pages.sortBy([{n: 'b'}, {n: 'a'}], 'en', item => item.n), [{n: 'a'}, {n: 'b'}]);
  assert.deepEqual(words, ['hrad', 'chata', 'cihla', 'dům', 'čaj']);
  assert.deepEqual(Pages.unitOrder(['10', '2', '1', 'appendix']), ['1', '2', '10', 'appendix']);
  assert.deepEqual(Pages.sortBy(['b', 'a'], 'not a tag'), ['a', 'b']);
});

test('an id is short text or a whole number', () => {
  assert.equal(Pages.identifier(12), '12');
  assert.equal(Pages.identifier('unit-3.a'), 'unit-3.a');
  for (const bad of ['', ' 12', 'a b', '<b>', '-x', 1.5, null, undefined, {}, 'x'.repeat(65)]) assert.equal(Pages.identifier(bad), null);
});

test('a link from data is http, https or relative', () => {
  for (const good of ['https://example.org/a?b=1#c', 'http://example.org', 'page.html?lang=cs#unit=2', '../media/a.svg', '/root/a.png', '#unit=2', 'a.html?next=http://example.org']) {
    assert.equal(Pages.safeUrl(good), good);
  }
  assert.equal(Pages.safeUrl('  page.html '), 'page.html');
  for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<p>', 'vbscript:x', 'file:///etc/passwd',
    'mailto:a@example.org', '//example.org/a', '/\\example.org', 'https:example.org', 'https://', '', '   ', null, 12, {}]) {
    assert.equal(Pages.safeUrl(bad), null, String(bad));
  }
});

test('the address gives the language, the unit and the item from the hash, then the query', () => {
  assert.deepEqual(Pages.address({hash: '#lang=cs&unit=12', search: '?lang=en&unit=3'}), {lang: 'cs', unit: '12'});
  assert.deepEqual(Pages.address({hash: '', search: '?lang=en&unit=3'}), {lang: 'en', unit: '3'});
  assert.deepEqual(Pages.address({hash: '#concept=tide', search: '?unit=3'}, ['unit', 'concept', 'view']), {unit: '3', concept: 'tide', view: null});
  assert.deepEqual(Pages.address({hash: '#12', search: ''}), {lang: null, unit: null});
  assert.deepEqual(Pages.address({hash: '#unit=%20', search: '?unit=4'}), {lang: null, unit: '4'});
  assert.deepEqual(Pages.address(), {lang: null, unit: null});
});

test('an address takes fields in its query or its hash', () => {
  assert.equal(Pages.href('atlas.html', {lang: 'cs', unit: 12}), 'atlas.html?lang=cs&unit=12');
  assert.equal(Pages.href('atlas.html?lang=en#concept=tide', {lang: 'cs', unit: null}), 'atlas.html?lang=cs#concept=tide');
  assert.equal(Pages.href('atlas.html?unit=3&x=1', {unit: 4, concept: 'tide'}, 'hash'), 'atlas.html?x=1#unit=4&concept=tide');
  assert.equal(Pages.href('https://example.org/deck.html#12', {lang: 'cs'}, 'hash'), 'https://example.org/deck.html?lang=cs#12');
  assert.equal(Pages.href('atlas.html?unit=3#unit=4', {unit: ''}), 'atlas.html');
  assert.equal(Pages.href('atlas.html', {concept: 'a b&c'}, 'hash'), 'atlas.html#concept=a+b%26c');
});

test('a unit link template encodes its fields and stays a safe link', () => {
  assert.equal(Pages.fill('deck.html?lang={lang}#{unit}', {lang: 'cs', unit: '12'}), 'deck.html?lang=cs#12');
  assert.equal(Pages.fill('deck.html#unit={unit}', {unit: 'a b/c'}), 'deck.html#unit=a%20b%2Fc');
  assert.equal(Pages.fill('{unit}', {unit: 'javascript:alert(1)'}), 'javascript%3Aalert(1)');
  assert.equal(Pages.fill('javascript:go({unit})', {unit: '1'}), null);
  assert.equal(Pages.fill(undefined, {unit: '1'}), null);
  assert.equal(Pages.fill('deck.html#{missing}', {}), 'deck.html#');
});

test('the copy table of a page adds to the defaults of a runtime', () => {
  const merged = Pages.words({en: {a: 'A', b: 'B'}}, {en: {b: 'Bee'}, cs: {a: 'Á'}});
  assert.deepEqual(merged, {en: {a: 'A', b: 'Bee'}, cs: {a: 'Á'}});
  assert.deepEqual(Pages.words({en: {a: 'A'}}), {en: {a: 'A'}});
});

test('the checker names the collection, the index and the id of a bad record', () => {
  const check = Pages.checker(['en', 'cs']);
  const ids = check.records('things', [{id: 'a', label: {en: 'A'}}, {id: 'a'}, 'text', {id: '<b>'}, {id: 7, link: 'javascript:x', refs: ['a', 'zzz', 7]}], (name, record, id) => {
    check.text(name, 'label', record.label);
    check.url(name, 'link', record.link);
    check.refs(name, 'refs', record.refs, new Set(['a', '7']), id);
  });
  assert.deepEqual([...ids], ['a', '7']);
  assert.deepEqual(Pages.describe(check.problems), [
    'things[0] "a" label: has no text for cs',
    'things[1] "a" id: repeats the id of things[0]',
    'things[2]: is not an object',
    'things[3] id: is not a valid id',
    'things[4] "7" link: is not an http, https or relative link',
    'things[4] "7" refs: names "zzz", which does not exist',
    'things[4] "7" refs: names the record itself',
  ]);
  assert.deepEqual([...Pages.checker([]).records('things', null)], []);
  const plain = Pages.checker(['en']);
  plain.text('r', 'title', 'One title', {plain: true});
  plain.text('r', 'title', undefined, {required: true});
  plain.text('r', 'title', ' ', {plain: true});
  plain.refs('r', 'units', 'x', new Set());
  assert.deepEqual(Pages.describe(plain.problems), ['r title: is required', 'r title: is empty', 'r units: is not a list']);
});

test('invalid data throws an error that names the first bad records and keeps all of them', () => {
  assert.doesNotThrow(() => Pages.assertValid([], 'Data'));
  const problems = Array.from({length: 7}, (unused, index) => ({record: 'r[' + index + ']', field: 'f', message: 'is bad'}));
  assert.throws(() => Pages.assertValid(problems, 'Data'), error => {
    assert.match(error.message, /^Data is not valid\. r\[0\] f: is bad; .*r\[4\] f: is bad; and 2 more$/);
    assert.equal(error.problems.length, 7);
    return true;
  });
});

function fakeDocument() {
  return {createElement(tag) {
    const attributes = {};
    return {tag, attributes, textContent: '', className: '', setAttribute(name, value) { attributes[name] = String(value); }};
  }};
}

test('a data link becomes plain text when its address is not safe', () => {
  const doc = fakeDocument();
  const good = Pages.link(doc, '<b>Label</b>', 'https://example.org/a', true);
  assert.equal(good.tag, 'a');
  assert.equal(good.attributes.href, 'https://example.org/a');
  assert.equal(good.textContent, '<b>Label</b>');
  assert.equal(good.rel, 'noopener noreferrer');
  const bad = Pages.link(doc, 'Label', 'javascript:alert(1)', true);
  assert.equal(bad.tag, 'span');
  assert.deepEqual(bad.attributes, {});
  assert.equal(Pages.link(doc, 'Label', undefined).tag, 'span');
});

test('the data comes from the option or from a fetch that reports a failed status', async () => {
  assert.deepEqual(await Pages.load({data: {a: 1}}), {a: 1});
  const scope = status => ({fetch: async () => ({ok: status === 200, status, json: async () => ({b: 2})})});
  assert.deepEqual(await Pages.load({src: 'x.json'}, scope(200)), {b: 2});
  await assert.rejects(Pages.load({src: 'x.json'}, scope(404)), /404/);
});

test('the companion runtimes never write HTML text', () => {
  for (const name of ['companion-pages.js', 'concept-atlas.js', 'asset-library.js']) {
    const source = readFileSync(join(__dirname, '..', 'runtime', name), 'utf8');
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\.href\s*=/, name);
  }
  const wiring = readFileSync(join(__dirname, '..', 'templates', 'companion.js'), 'utf8');
  assert.doesNotMatch(wiring, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});
