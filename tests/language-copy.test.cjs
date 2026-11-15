const test = require('node:test');
const assert = require('node:assert/strict');
const {params, match, resolve, parity, lookup, format, href, bind} = require('../runtime/language-copy.js');

const languages = ['cs', 'en', 'de'];

test('the language comes from the hash, then the query, then the document, then the fallback', () => {
  const base = {languages, fallback:'en'};
  assert.equal(resolve({...base, hash:'#lang=de&page=2', search:'?lang=cs', htmlLang:'en'}), 'de');
  assert.equal(resolve({...base, hash:'#page=2', search:'?lang=cs', htmlLang:'en'}), 'cs');
  assert.equal(resolve({...base, hash:'#94', search:'', htmlLang:'de-AT'}), 'de');
  assert.equal(resolve({...base, hash:'#lang=fr', search:'?lang=', htmlLang:'pl'}), 'en');
  assert.equal(resolve({languages}), 'cs');
  assert.equal(resolve({...base, param:'language', hash:'#language=cs'}), 'cs');
  assert.equal(params('#a=1&b=2').get('b'), '2');
});

test('a language matches by its full tag, then by its primary subtag', () => {
  assert.equal(match('EN', languages), 'en');
  assert.equal(match('en-GB', languages), 'en');
  assert.equal(match('pt-BR', ['pt', 'pt-BR']), 'pt-BR');
  assert.equal(match('fr', languages), null);
  assert.equal(match(null, languages), null);
});

test('the parity check lists each key that a language does not have', () => {
  const copy = {cs:{a:'A', b:'B', c:null}, en:{a:'A', c:'C', d:''}};
  assert.deepEqual(parity(copy), [
    {key:'b', missing:['en']},
    {key:'c', missing:['cs']},
    {key:'d', missing:['cs']},
  ]);
  assert.deepEqual(parity(copy, ['cs', 'en', 'de']).find(entry => entry.key === 'a'), {key:'a', missing:['de']});
  assert.deepEqual(parity({cs:{a:'A'}, en:{a:'B'}}), []);
});

test('a missing text uses the fallback language, then shows its key', () => {
  const copy = {cs:{a:'Ahoj'}, en:{a:'Hello', b:'Bye', n:3}};
  assert.equal(lookup(copy, 'cs', 'en', 'a'), 'Ahoj');
  assert.equal(lookup(copy, 'cs', 'en', 'b'), 'Bye');
  assert.equal(lookup(copy, 'cs', 'en', 'n'), '3');
  assert.equal(lookup(copy, 'cs', 'en', 'zzz'), 'zzz');
  assert.equal(lookup(copy, 'cs', 'en', 'constructor'), 'constructor');
});

test('numbers use the decimal mark of the language and a fixed count of places', () => {
  assert.equal(format(1.5, 'cs'), '1,50');
  assert.equal(format(1.5, 'en'), '1.50');
  assert.equal(format(1234.567, 'cs', 1), '1234,6');
  assert.equal(format(2, 'en', 0), '2');
  assert.equal(format(NaN, 'en'), '');
  assert.equal(format(1.5, 'not a tag'), '1.50');
});

test('the remembered address carries the language in the hash or in the query', () => {
  assert.equal(href('https://example.test/figure.html#page=2', 'cs'), 'https://example.test/figure.html#page=2&lang=cs');
  assert.equal(href('https://example.test/figure.html#lang=en', 'cs'), 'https://example.test/figure.html#lang=cs');
  assert.equal(href('https://example.test/figure.html', 'cs'), 'https://example.test/figure.html#lang=cs');
  assert.equal(href('https://example.test/deck.html#94', 'cs'), 'https://example.test/deck.html#94');
  assert.equal(href('https://example.test/figure.html?a=1#x=1', 'cs', {where:'query'}), 'https://example.test/figure.html?a=1&lang=cs#x=1');
});

function node(attributes) {
  return {attributes:{...attributes}, textContent:'', innerHTML:'<b>kept</b>',
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; }};
}

function fakePage(hash = '') {
  const nodes = [node({'data-t':'title'}), node({'data-aria':'label'}), node({'data-alt':'picture'}), node({'data-t':''})];
  const listeners = new Map(), states = [];
  const location = {href:'https://example.test/figure.html' + hash, hash, search:''};
  return {nodes, listeners, states, location,
    document:{documentElement:{lang:'en'},
      querySelectorAll:selector => nodes.filter(item => selector.slice(1, -1) in item.attributes)},
    window:{addEventListener:(type, fn) => listeners.set(type, fn), removeEventListener:type => listeners.delete(type)},
    history:{replaceState(_state, _title, url) { states.push(url); }},
  };
}

const copy = {
  cs:{title:'Nadpis <b>', label:'Popis', picture:'Obrázek'},
  en:{title:'Heading', label:'Label', picture:'Picture'},
};

test('binding writes text, labels, and alternative text, and switches language in place', () => {
  const page = fakePage('#lang=cs');
  const changes = [];
  const bound = bind({copy, fallback:'en', remember:'hash', onChange:language => changes.push(language), ...page});
  assert.equal(bound.language, 'cs');
  assert.equal(page.document.documentElement.lang, 'cs');
  assert.equal(page.nodes[0].textContent, 'Nadpis <b>');
  assert.equal(page.nodes[0].innerHTML, '<b>kept</b>', 'copy is never written as HTML');
  assert.equal(page.nodes[1].attributes['aria-label'], 'Popis');
  assert.equal(page.nodes[2].attributes.alt, 'Obrázek');
  assert.equal(page.nodes[3].textContent, '');
  assert.equal(bound.format(0.5), '0,50');

  const first = page.nodes[0];
  assert.equal(bound.set('en'), true);
  assert.equal(page.nodes[0], first);
  assert.equal(first.textContent, 'Heading');
  assert.equal(page.document.documentElement.lang, 'en');
  assert.equal(bound.format(0.5), '0.50');
  assert.deepEqual(page.states, ['https://example.test/figure.html#lang=en']);
  assert.equal(bound.set('fr'), false);
  assert.equal(bound.set('en'), true);
  assert.deepEqual(changes, ['en']);
});

test('a hash change switches a bound figure and custom attribute names are honoured', () => {
  const page = fakePage();
  page.nodes.push(node({'data-i18n':'title'}));
  const bound = bind({copy, languages:['en', 'cs'], attributes:{text:'data-i18n'}, ...page});
  assert.equal(bound.language, 'en');
  assert.equal(page.nodes.at(-1).textContent, 'Heading');
  assert.equal(page.nodes[0].textContent, '', 'the default text attribute is replaced');
  page.location.hash = '#lang=cs';
  page.listeners.get('hashchange')();
  assert.equal(bound.language, 'cs');
  assert.equal(page.nodes.at(-1).textContent, 'Nadpis <b>');
  assert.deepEqual(page.states, []);
  bound.destroy();
  assert.equal(page.listeners.size, 0);
});
