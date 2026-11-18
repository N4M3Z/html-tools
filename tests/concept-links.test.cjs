const test = require('node:test');
const assert = require('node:assert/strict');
const Atlas = require('../runtime/concept-atlas.js');
const Links = require('../runtime/concept-links.js');

const both = (en, cs) => ({en, cs});
function sample() {
  return Atlas.normalize({
    schema: Atlas.SCHEMA,
    languages: ['en', 'cs'],
    units: [{id: 'tides', title: both('Tides', 'Dmutí')}, {id: 'empty', title: both('Empty', 'Prázdná')}],
    concepts: [
      {id: 'tide', prefLabel: both('Tide', 'Dmutí'), definition: both('The rise and fall of the sea.', 'Stoupání a klesání moře.'), units: ['tides']},
      {id: 'spring-tide', prefLabel: both('Spring tide', 'Skočné dmutí'), definition: both('The largest tide.', 'Největší dmutí.'),
        altLabel: {en: ['king tide']}, hiddenLabel: {cs: ['skočného dmutí', 'skočným dmutím']}, broader: ['tide'], units: ['tides']},
      {id: 'moon', prefLabel: both('Moon', 'Měsíc'), definition: both('The body that pulls the sea.', 'Těleso, které táhne moře.'), units: []},
    ],
  });
}

test('the names of a concept are its label, other names and hidden names in one language, the longest first', () => {
  const data = sample();
  assert.deepEqual(Links.names(data.concepts['spring-tide'], 'en'), ['Spring tide', 'king tide']);
  assert.deepEqual(Links.names(data.concepts['spring-tide'], 'cs'), ['skočného dmutí', 'skočným dmutím', 'Skočné dmutí']);
  assert.deepEqual(Links.names(data.concepts.moon, 'de'), []);
});

test('a name matches as a whole word in any case, and an English name takes a plural ending', () => {
  const found = (name, language, text) => { const match = Links.pattern(name, language).exec(text); return match ? match[0] : null; };
  assert.equal(found('tide', 'en', 'Two Tides a day.'), 'Tides');
  assert.equal(found('tide', 'en', 'The tideline moved.'), null);
  assert.equal(found('box', 'en-GB', 'Three boxes.'), 'boxes');
  assert.equal(found('Dmutí', 'cs', 'Výška dmutí roste.'), 'dmutí');
  assert.equal(found('měsíc', 'cs', 'Půlměsíc svítí.'), null);
  assert.equal(found('dmutí', 'cs', 'Dvě dmutís denně.'), null);
  assert.equal(found('spring tide', 'en', 'A spring\n  tide comes.'), 'spring\n  tide');
  assert.equal(found('C++ (old)', 'en', 'Written in c++ (old).'), 'c++ (old)');
});

test('each concept of a unit gets its first mention, and a longer name takes its words first', () => {
  const data = sample(), list = Links.entries(data, 'tides', 'en');
  assert.deepEqual(list.map(entry => entry.id), ['spring-tide', 'tide']);
  const texts = ['A spring tide is high.', 'Each tide follows the Moon. A king tide is rare, and tides repeat.'];
  assert.deepEqual(Links.plan(texts, list), [
    {text: 0, start: 2, end: 13, concept: 'spring-tide'},
    {text: 1, start: 5, end: 9, concept: 'tide'},
  ]);
  assert.deepEqual(Links.plan(['A spring tide.'], list), [{text: 0, start: 2, end: 13, concept: 'spring-tide'}]);
  assert.deepEqual(Links.plan(['King tide first, then a spring tide.'], list), [{text: 0, start: 0, end: 9, concept: 'spring-tide'}]);
  assert.deepEqual(Links.plan(texts, Links.entries(data, 'empty', 'en')), []);
  assert.deepEqual(Links.plan(texts, Links.entries(data, 'no-such-unit', 'en')), []);
});

test('a language with inflection links its other word forms through hidden names', () => {
  const data = sample(), list = Links.entries(data, 'tides', 'cs');
  assert.deepEqual(Links.plan(['Při skočném dmutí ne, ale u skočného dmutí ano.'], list), [
    {text: 0, start: 12, end: 17, concept: 'tide'},
    {text: 0, start: 28, end: 42, concept: 'spring-tide'},
  ]);
});
