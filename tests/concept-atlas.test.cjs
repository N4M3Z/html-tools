const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const Pages = require('../runtime/companion-pages.js');
const Atlas = require('../runtime/concept-atlas.js');

const both = (en, cs) => ({en, cs});
function sample() {
  return {
    schema: Atlas.SCHEMA,
    languages: ['en', 'cs'],
    units: [{id: 1, title: both('First', 'První')}, {id: 2, title: both('Second', 'Druhá'), focus: 'hill'}, {id: 10, title: both('Tenth', 'Desátá')}],
    concepts: [
      {id: 'castle', prefLabel: both('Castle', 'Hrad'), definition: both('A strong house.', 'Pevný dům.'), broader: ['building'], related: ['hill'], units: [2, 1]},
      {id: 'hut', prefLabel: both('Hut', 'Chata'), definition: both('A small house.', 'Malý dům.'), altLabel: {cs: ['Chýše']}, broader: ['building'], units: [10]},
      {id: 'building', prefLabel: both('Building', 'Budova'), definition: both('A made shelter.', 'Postavený přístřešek.'), units: []},
      {id: 'hill', prefLabel: both('Hill', 'Kopec'), definition: both('A raised place.', 'Vyvýšené místo.'), related: ['castle'],
        relations: [{type: 'supports', target: 'castle'}], units: [2]},
      {id: 'brick', prefLabel: both('Brick', 'Cihla'), definition: both('A baked block.', 'Pálený blok.'), units: []},
    ],
    relationTypes: {supports: both('supports', 'nese')},
    downloads: [{label: 'JSON-LD', href: 'concepts.jsonld'}],
  };
}

test('valid data has no problems and the sample of the templates is valid', () => {
  assert.deepEqual(Atlas.validate(sample()), []);
  const shipped = JSON.parse(readFileSync(join(__dirname, '..', 'templates', 'concepts.json'), 'utf8'));
  assert.deepEqual(Atlas.validate(shipped), []);
});

test('validation names the bad record and its field', () => {
  const data = sample();
  delete data.concepts[0].prefLabel.cs;
  data.concepts[1].definition = 'A small house.';
  data.concepts[1].altLabel = {cs: 'Chýše'};
  data.concepts[2].broader = ['building', 'tower'];
  data.concepts[3].units = [2, 7];
  data.concepts[3].relations = [{target: 'castle'}, {type: 'supports', target: 'nothing'}];
  data.concepts.push({id: 'castle', prefLabel: both('Again', 'Znovu'), definition: both('x', 'y')});
  data.units[1].focus = 'missing';
  data.units.push({id: 'bad id', title: both('a', 'b')});
  data.downloads.push({label: 'Bad', href: 'javascript:alert(1)'});
  data.relationTypes.supports = {en: 'supports'};
  assert.deepEqual(Pages.describe(Atlas.validate(data)), [
    'units[1] "2" focus: names "missing", which does not exist',
    'units[3] id: is not a valid id',
    'concepts[0] "castle" prefLabel: has no text for cs',
    'concepts[1] "hut" definition: has no text for en, cs',
    'concepts[1] "hut" altLabel: is not a list of names for each language',
    'concepts[2] "building" broader: names the record itself',
    'concepts[2] "building" broader: names "tower", which does not exist',
    'concepts[3] "hill" units: names "7", which does not exist',
    'concepts[3] "hill" relations[0]: has no type',
    'concepts[3] "hill" relations[1]: names "nothing", which does not exist',
    'concepts[5] "castle" id: repeats the id of concepts[0]',
    'relationTypes "supports" label: has no text for cs',
    'downloads[1] href: is not an http, https or relative link',
  ]);
});

test('validation rejects a wrong document shape', () => {
  assert.deepEqual(Pages.describe(Atlas.validate(null)), ['data: is not an object']);
  assert.deepEqual(Pages.describe(Atlas.validate({schema: 'other', languages: ['en', 3]})), [
    'data schema: is not "html-tools-concept-atlas/v1"',
    'data languages: is not a list of language tags',
    'data units: is not a list',
    'data concepts: is not a list',
  ]);
  assert.throws(() => Atlas.normalize({schema: Atlas.SCHEMA, languages: ['en'], units: [], concepts: [{id: 'a'}]}),
    /Concept atlas data is not valid\. concepts\[0\] "a" prefLabel: is required/);
});

test('normal data lists units per concept, concepts per unit, and each relation one time', () => {
  const data = Atlas.normalize(sample());
  assert.deepEqual(data.concepts.castle.units, ['1', '2']);
  assert.deepEqual(data.units['2'].concepts, ['castle', 'hill']);
  assert.deepEqual(data.units['10'].concepts, ['hut']);
  assert.equal(data.units['2'].focus, 'hill');
  assert.deepEqual(data.relations, [
    {source: 'castle', type: 'broader', target: 'building'},
    {source: 'castle', type: 'related', target: 'hill'},
    {source: 'hill', type: 'supports', target: 'castle'},
    {source: 'hut', type: 'broader', target: 'building'},
  ]);
  assert.equal(Object.getPrototypeOf(data.concepts), null);
});

test('the unit context has the concepts on the unit and the concepts one relation away', () => {
  const data = Atlas.normalize(sample());
  const second = Atlas.context(data, 2);
  assert.deepEqual([...second.on], ['castle', 'hill']);
  assert.deepEqual([...second.near], ['building']);
  assert.equal(Atlas.category(second, 'castle'), 'on');
  assert.equal(Atlas.category(second, 'building'), 'near');
  assert.equal(Atlas.category(second, 'brick'), 'elsewhere');
  const tenth = Atlas.context(data, '10');
  assert.deepEqual([[...tenth.on], [...tenth.near]], [['hut'], ['building']]);
  for (const none of [null, '99', 'constructor', '<x>']) {
    const empty = Atlas.context(data, none);
    assert.deepEqual([empty.unit, empty.on.size, empty.near.size], [null, 0, 0]);
  }
});

test('search folds diacritics, reads both languages, and sorts per language', () => {
  const data = Atlas.normalize(sample());
  assert.deepEqual(Atlas.search(data, '', 'en'), ['brick', 'building', 'castle', 'hill', 'hut']);
  assert.deepEqual(Atlas.search(data, '', 'cs'), ['building', 'brick', 'castle', 'hut', 'hill']);
  assert.deepEqual(Atlas.search(data, 'chyse', 'en'), ['hut']);
  assert.deepEqual(Atlas.search(data, 'DŮM', 'cs'), ['castle', 'hut']);
  assert.deepEqual(Atlas.search(data, 'house small', 'cs'), ['hut']);
  assert.deepEqual(Atlas.search(data, 'no such text', 'en'), []);
  assert.equal(Atlas.label(data, 'hut', 'cs'), 'Chata');
  assert.equal(Atlas.label(data, 'hut', 'de'), 'Hut');
});

test('the neighborhood has every relation and a limited count of neighbors', () => {
  const data = Atlas.normalize(sample());
  const castle = Atlas.neighborhood(data, 'castle', 'en');
  assert.deepEqual(castle.ids, ['castle', 'building', 'hill']);
  assert.equal(castle.edges.length, 3);
  assert.equal(castle.omitted, 0);
  const building = Atlas.neighborhood(data, 'building', 'cs', 1);
  assert.deepEqual([building.ids, building.omitted, building.edges.length], [['building', 'castle'], 1, 2]);
  assert.deepEqual(Atlas.neighborhood(data, 'missing', 'en'), {ids: [], edges: [], omitted: 0});
});

test('the panel key toggles, Escape closes, and a field keeps its keys', () => {
  const field = {matches: selector => selector.includes('input')}, plain = {matches: () => false};
  const key = (name, target = plain, extra = {}) => ({key: name, target, ...extra});
  assert.equal(Atlas.shortcut(key('o'), false), 'toggle');
  assert.equal(Atlas.shortcut(key('O'), true), 'toggle');
  assert.equal(Atlas.shortcut(key('o', field), false), null);
  assert.equal(Atlas.shortcut(key('o', plain, {metaKey: true}), false), null);
  assert.equal(Atlas.shortcut(key('o', plain, {repeat: true}), false), null);
  assert.equal(Atlas.shortcut(key('o', plain, {defaultPrevented: true}), false), null);
  assert.equal(Atlas.shortcut(key('Escape'), true), 'close');
  assert.equal(Atlas.shortcut(key('Escape'), false), null);
  assert.equal(Atlas.shortcut(key('Escape', field), true), null);
  assert.equal(Atlas.shortcut(key('Escape', field), true, true), 'close');
  assert.equal(Atlas.shortcut(key('k'), false, false, 'k'), 'toggle');
  assert.equal(Atlas.shortcut(key('o'), false, false, null), null);
  assert.equal(Atlas.shortcut({key: 'o', target: plain, composedPath: () => [{isContentEditable: true}]}, false), null);
});

test('a page address carries the language, the unit and the concept', () => {
  assert.equal(Atlas.pageHref('atlas.html', {language: 'cs', unit: '12', concept: 'tide'}), 'atlas.html?lang=cs&unit=12&concept=tide');
  assert.equal(Atlas.pageHref('atlas.html?view=dictionary', {language: 'en'}), 'atlas.html?view=dictionary&lang=en');
  assert.equal(Atlas.pageHref('javascript:alert(1)', {language: 'en'}), null);
  assert.deepEqual(Pages.address({hash: '', search: '?lang=cs&unit=12&concept=tide'}, ['lang', 'unit', 'concept']), {lang: 'cs', unit: '12', concept: 'tide'});
});

test('the default words are complete for the keys the views read', () => {
  const source = readFileSync(join(__dirname, '..', 'runtime', 'concept-atlas.js'), 'utf8');
  const keys = new Set([...source.matchAll(/\bt\('([A-Za-z]+)'\)/g)].map(match => match[1]));
  for (const key of [...keys, 'on', 'near', 'elsewhere', 'broader', 'related']) assert.equal(typeof Atlas.WORDS.en[key], 'string', key);
});
