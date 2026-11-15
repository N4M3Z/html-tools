// Shared parts of the companion pages of a page set: the concept atlas and the library.
//
// Search folding, order per language, address fields, link safety, and data checks that name the bad record.
// Text from data goes in as text. A link from data is http, https or relative, or it is not a link.
// The language itself comes from LanguageCopy. Load language-copy.js before this file.
(function (root) {
  'use strict';

  const Copy = root.LanguageCopy || (typeof require === 'function' ? require('./language-copy.js') : null);
  const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
  const isRecord = value => value != null && typeof value === 'object' && !Array.isArray(value);

  // Lower case, no diacritics, single spaces. "Skočné  Dmutí" and "skocne dmuti" fold to the same text.
  function fold(value) {
    return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // True when every word of the query is in the folded parts. An empty query matches.
  function matches(parts, query) {
    const words = fold(query).split(' ').filter(Boolean);
    if (!words.length) return true;
    const hay = fold(parts.filter(part => part != null).join(' '));
    return words.every(word => hay.includes(word));
  }

  // The text of a language map: the language, then the fallback, then any language. A string is its own text.
  function pick(value, language, fallback) {
    if (typeof value === 'string') return value;
    if (!isRecord(value)) return '';
    for (const name of [language, fallback, ...Object.keys(value)]) {
      if (own(value, name) && typeof value[name] === 'string' && value[name]) return value[name];
    }
    return '';
  }

  // Every string in a text, a language map, or a language map of lists. Search reads all languages.
  function texts(value) {
    if (typeof value === 'string') return [value];
    if (!isRecord(value)) return [];
    return Object.values(value).flat().filter(item => typeof item === 'string');
  }

  const collators = new Map();
  function collator(language) {
    const key = String(language || '');
    if (!collators.has(key)) {
      let made;
      try { made = new Intl.Collator(key || undefined, {numeric: true}); }
      catch { made = new Intl.Collator(undefined, {numeric: true}); }
      collators.set(key, made);
    }
    return collators.get(key);
  }

  // A sorted copy in the order of the language. Czech puts "ch" after "h". Numbers sort by value.
  function sortBy(items, language, key = item => item) {
    const order = collator(language);
    return [...items].sort((a, b) => order.compare(String(key(a)), String(key(b))));
  }
  const unitOrder = ids => sortBy(ids, 'en');

  // An id of a unit, a concept or a record, as text. A whole number is accepted. Anything else is null.
  function identifier(value) {
    const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
    return typeof text === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(text) ? text : null;
  }

  // The link when it is http, https or relative. Null for any other scheme, a control character, or a
  // form that a browser reads as another host ("//host", "/\host").
  function safeUrl(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || /[\u0000-\u001f\u007f\\]/.test(text)) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) return /^https?:\/\/[^/]/i.test(text) ? text : null;
    return text.startsWith('//') ? null : text;
  }

  // The named fields of an address. The hash is first, then the query, as in LanguageCopy.
  function address(place = {}, names = ['lang', 'unit']) {
    const hash = Copy.params(place.hash), query = Copy.params(place.search), found = {};
    for (const name of names) found[name] = (hash.get(name) || '').trim() || (query.get(name) || '').trim() || null;
    return found;
  }

  // The same address with fields set in its query or its hash. An empty field is removed from both.
  // A hash that is not key=value pairs stays, and the fields go to the query.
  function href(target, fields = {}, where = 'query') {
    const text = String(target ?? ''), hashAt = text.indexOf('#');
    const hash = hashAt < 0 ? '' : text.slice(hashAt + 1), head = hashAt < 0 ? text : text.slice(0, hashAt);
    const queryAt = head.indexOf('?'), path = queryAt < 0 ? head : head.slice(0, queryAt);
    const query = new URLSearchParams(queryAt < 0 ? '' : head.slice(queryAt + 1));
    const plain = hash !== '' && !hash.includes('=');
    const pairs = new URLSearchParams(plain ? '' : hash);
    const into = where === 'hash' && !plain ? pairs : query;
    for (const [key, value] of Object.entries(fields)) {
      query.delete(key);
      pairs.delete(key);
      if (value != null && value !== '') into.set(key, String(value));
    }
    const tail = plain ? hash : pairs.toString();
    return path + (query.toString() ? '?' + query : '') + (tail ? '#' + tail : '');
  }

  // "deck.html?lang={lang}#{unit}" with each field encoded. The result is a safe link or null.
  function fill(template, fields = {}) {
    if (typeof template !== 'string') return null;
    return safeUrl(template.replace(/\{(\w+)\}/g, (all, name) => encodeURIComponent(fields[name] ?? '')));
  }

  // One copy table from the defaults of a runtime and the additions of a page.
  function words(defaults, extra = {}) {
    const merged = {};
    for (const language of new Set([...Object.keys(defaults), ...Object.keys(extra || {})])) {
      merged[language] = {...defaults[language], ...(extra || {})[language]};
    }
    return merged;
  }

  function missingLanguages(value, languages) {
    return languages.filter(language => !(isRecord(value) && typeof value[language] === 'string' && value[language].trim()));
  }

  // Collect data problems as {record, field, message}. The record is "concepts[2] "tide"", so a person finds it.
  function checker(languages = []) {
    const problems = [];
    const add = (record, field, message) => { problems.push({record, field, message}); };
    const list = (record, field, value) => {
      if (value == null) return [];
      if (Array.isArray(value)) return value;
      add(record, field, 'is not a list');
      return [];
    };
    return {
      problems, add, list,
      // A text for every language. `plain` also accepts one string for all languages.
      text(record, field, value, rule = {}) {
        if (value == null) { if (rule.required) add(record, field, 'is required'); return; }
        if (rule.plain && typeof value === 'string') { if (!value.trim()) add(record, field, 'is empty'); return; }
        const missing = missingLanguages(value, languages);
        if (missing.length) add(record, field, 'has no text for ' + missing.join(', '));
      },
      url(record, field, value, rule = {}) {
        if (value == null) { if (rule.required) add(record, field, 'is required'); return; }
        if (!safeUrl(value)) add(record, field, 'is not an http, https or relative link');
      },
      // Each entry names a known id. The record does not name itself.
      refs(record, field, value, known, self) {
        for (const entry of list(record, field, value)) {
          const id = identifier(entry);
          if (id === null || !known.has(id)) add(record, field, 'names "' + String(entry) + '", which does not exist');
          else if (self != null && id === self) add(record, field, 'names the record itself');
        }
      },
      // Check each record of a collection for an object and a unique id, then run `each`. Returns the ids.
      records(collection, value, each = () => {}) {
        const ids = new Map();
        if (!Array.isArray(value)) { add('data', collection, 'is not a list'); return new Set(); }
        value.forEach((record, index) => {
          if (!isRecord(record)) { add(collection + '[' + index + ']', '', 'is not an object'); return; }
          const id = identifier(record.id);
          const name = collection + '[' + index + ']' + (id === null ? '' : ' "' + id + '"');
          if (id === null) add(name, 'id', 'is not a valid id');
          else if (ids.has(id)) add(name, 'id', 'repeats the id of ' + collection + '[' + ids.get(id) + ']');
          else ids.set(id, index);
          each(name, record, id);
        });
        return new Set(ids.keys());
      },
    };
  }

  const describe = problems => problems.map(item => item.record + (item.field ? ' ' + item.field : '') + ': ' + item.message);

  // Throw an error that names the first bad records. `error.problems` holds all of them.
  function assertValid(problems, name) {
    if (!problems.length) return;
    const lines = describe(problems);
    const error = new Error(name + ' is not valid. ' + lines.slice(0, 5).join('; ') + (lines.length > 5 ? '; and ' + (lines.length - 5) + ' more' : ''));
    error.problems = problems;
    throw error;
  }

  function element(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // A link when the address is safe, else the same label as plain text.
  function link(doc, label, url, newTab = false) {
    const safe = safeUrl(url), node = element(doc, safe ? 'a' : 'span', '', label);
    if (safe) {
      node.setAttribute('href', safe);
      if (newTab) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    }
    return node;
  }

  // The data of a view: the `data` option, or the JSON at the `src` option.
  function load(options, scope = root) {
    if (options.data) return Promise.resolve(options.data);
    return scope.fetch(options.src, {credentials: 'same-origin'}).then(response => {
      if (!response.ok) throw new Error('The data did not load: ' + response.status);
      return response.json();
    });
  }

  // A list of problem lines for a view that could not load its data.
  function failureList(doc, error) {
    const list = element(doc, 'ul', 'cp-problems');
    const lines = error && error.problems ? describe(error.problems) : [String((error && error.message) || error)];
    for (const line of lines.slice(0, 20)) list.append(element(doc, 'li', '', line));
    return list;
  }

  const api = {
    own, isRecord, fold, matches, pick, texts, collator, sortBy, unitOrder, identifier, safeUrl, address, href, fill,
    words, missingLanguages, checker, describe, assertValid, element, link, load, failureList,
  };
  root.CompanionPages = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
