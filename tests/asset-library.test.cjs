const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {createHash} = require('node:crypto');
const {join} = require('node:path');
const Pages = require('../runtime/companion-pages.js');
const Library = require('../runtime/asset-library.js');

const both = (en, cs) => ({en, cs});
const hash = letter => letter.repeat(64);
function sample() {
  return {
    schema: Library.SCHEMA,
    languages: ['en', 'cs'],
    licenseStatuses: [{id: 'cleared', label: both('Cleared', 'Vyřešeno')}, {id: 'unresolved', label: both('Unresolved', 'Nevyřešeno')}],
    assets: [
      {id: 'map', units: [2, 10, 2], file: 'media/map.png', sha256: hash('a'), title: both('Hill map', 'Mapa kopce'),
        source: {title: 'Sample archive', url: 'https://example.org/map', author: 'Sample author'}, license: {status: 'cleared', name: 'Sample licence'},
        notes: both('Cropped.', 'Oříznuto.')},
      {id: 'clip', units: [1], file: 'media/clip.mp4', sha256: hash('b'), license: {status: 'unresolved'}},
      {id: 'chart', units: [], file: 'media/chart.svg', sha256: hash('c'), title: both('Chart', 'Čára'), license: {status: 'cleared'}},
    ],
    references: [
      {id: 'book', title: both('Sample book', 'Ukázková kniha'), url: 'https://example.org/book', units: [1, 2]},
      {id: 'atlas', title: 'A sample atlas', units: [10], note: both('Maps only.', 'Jen mapy.')},
    ],
    corrections: [{id: 'height', units: [2], text: both('The hill is lower.', 'Kopec je nižší.'), references: ['book']}],
  };
}

test('valid data has no problems and the sample of the templates matches its files', () => {
  assert.deepEqual(Library.validate(sample()), []);
  const directory = join(__dirname, '..', 'templates');
  const shipped = JSON.parse(readFileSync(join(directory, 'library.json'), 'utf8'));
  assert.deepEqual(Library.validate(shipped), []);
  for (const asset of shipped.assets) {
    assert.equal(asset.sha256, createHash('sha256').update(readFileSync(join(directory, asset.file))).digest('hex'), asset.id);
  }
});

test('validation names the bad asset, reference or correction', () => {
  const data = sample();
  data.assets[0].sha256 = 'ABC';
  data.assets[0].source.url = 'javascript:alert(1)';
  data.assets[1].license.status = 'pending';
  data.assets[1].file = 'data:text/html,x';
  data.assets[2].units = ['ok', 'not ok'];
  data.assets[2].notes = {en: 'Only English.'};
  data.assets.push({id: 'bare', file: 'a.png', sha256: hash('d')});
  data.references[1].title = '';
  data.corrections[0].references = ['book', 'paper'];
  data.corrections.push({id: 'empty', units: [1]});
  assert.deepEqual(Pages.describe(Library.validate(data)), [
    'assets[0] "map" sha256: is not 64 lower-case hex digits',
    'assets[0] "map" source.url: is not an http, https or relative link',
    'assets[1] "clip" file: is not an http, https or relative link',
    'assets[1] "clip" license.status: names "pending", which is not a declared status',
    'assets[2] "chart" units: names "not ok", which is not a valid unit id',
    'assets[2] "chart" notes: has no text for cs',
    'assets[3] "bare" license: is required',
    'references[1] "atlas" title: is empty',
    'corrections[0] "height" references: names "paper", which does not exist',
    'corrections[1] "empty" text: is required',
  ]);
  assert.deepEqual(Pages.describe(Library.validate({schema: Library.SCHEMA, languages: ['en']})), [
    'data licenseStatuses: is not a list', 'data assets: is not a list',
  ]);
  assert.throws(() => Library.normalize(data), /Asset library data is not valid\. assets\[0\] "map" sha256/);
});

test('normal data has unique units in unit order', () => {
  const data = Library.normalize(sample());
  assert.deepEqual(data.assets[0].units, ['2', '10']);
  assert.deepEqual(data.statusOrder, ['cleared', 'unresolved']);
  assert.deepEqual(Library.unitsOf(data.assets), ['1', '2', '10']);
  assert.deepEqual({...Library.statusCounts(data)}, {cleared: 2, unresolved: 1});
  assert.equal(data.referenceById.book.url, 'https://example.org/book');
});

test('assets filter by search, license status and unit, and sort by title per language', () => {
  const data = Library.normalize(sample());
  const ids = (filter, language = 'en') => Library.filterAssets(data, filter, language).map(asset => asset.id);
  assert.deepEqual(ids({}), ['chart', 'clip', 'map']);
  assert.deepEqual(ids({}, 'cs'), ['clip', 'chart', 'map']);
  assert.deepEqual(ids({status: 'cleared'}), ['chart', 'map']);
  assert.deepEqual(ids({status: 'all', unit: '2'}), ['map']);
  assert.deepEqual(ids({unit: 10, status: 'unresolved'}), []);
  assert.deepEqual(ids({query: 'oriznuto'}), ['map']);
  assert.deepEqual(ids({query: 'SAMPLE author'}), ['map']);
  assert.deepEqual(ids({query: 'bbbb'}), ['clip']);
  assert.deepEqual(ids({query: 'media'}, 'en'), ['chart', 'clip', 'map']);
  assert.equal(Library.title(data.assets[1], 'cs', 'en'), 'clip.mp4');
});

test('the preview kind comes from the file extension', () => {
  assert.equal(Library.mediaKind('media/Map.PNG?v=2'), 'image');
  assert.equal(Library.mediaKind('a/b.svg#layer'), 'image');
  assert.equal(Library.mediaKind('clip.mp4'), 'video');
  assert.equal(Library.mediaKind('voice.mp3'), 'audio');
  assert.equal(Library.mediaKind('paper.pdf'), 'file');
});

test('sources and corrections stay in two lists under every filter', () => {
  const data = Library.normalize(sample());
  const all = Library.filterReferences(data, {}, 'en');
  assert.deepEqual(all.references.map(item => item.id), ['atlas', 'book']);
  assert.deepEqual(all.corrections.map(item => item.id), ['height']);
  const second = Library.filterReferences(data, {unit: 2}, 'cs');
  assert.deepEqual([second.references.map(item => item.id), second.corrections.map(item => item.id)], [['book'], ['height']]);
  const lower = Library.filterReferences(data, {query: 'nizsi'}, 'cs');
  assert.deepEqual([lower.references.length, lower.corrections.length], [0, 1]);
  const book = Library.filterReferences(data, {query: 'kniha'}, 'cs');
  assert.deepEqual([book.references.map(item => item.id), book.corrections.length], [['book'], 0]);
  const ids = new Set(all.references.map(item => item.id));
  assert.equal(all.corrections.some(item => ids.has(item.id)), false);
});

test('the default words are complete for the keys the views read', () => {
  const source = readFileSync(join(__dirname, '..', 'runtime', 'asset-library.js'), 'utf8');
  const keys = new Set([...source.matchAll(/\bt\('([A-Za-z]+)'\)/g)].map(match => match[1]));
  assert.ok(keys.size > 10);
  for (const key of keys) assert.equal(typeof Library.WORDS.en[key], 'string', key);
});
