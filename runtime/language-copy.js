// Language copy binding: fill a page from a copy table, one object of key and text per language.
//
// [data-t] sets the text, [data-aria] sets aria-label, [data-alt] sets alt. Text goes in as text, never as HTML.
// The first language comes from the hash, then the query, then <html lang>, then the fallback.
(function (root) {
  'use strict';

  const ATTRIBUTES = {text: 'data-t', aria: 'data-aria', alt: 'data-alt'};
  const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);

  // Read "#lang=en&page=2" or "?lang=en" as key and value pairs.
  function params(text) { return new URLSearchParams(String(text ?? '').replace(/^[#?]/, '')); }

  // The supported language a value names, by the full tag first and then by its primary subtag.
  function match(value, languages) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const wanted = value.trim().toLowerCase(), primary = wanted.split('-')[0];
    return languages.find(language => language.toLowerCase() === wanted)
      || languages.find(language => language.toLowerCase() === primary) || null;
  }

  function resolve(options = {}) {
    const languages = options.languages || [], param = options.param || 'lang';
    const candidates = [params(options.hash).get(param), params(options.search).get(param), options.htmlLang];
    for (const candidate of candidates) {
      const found = match(candidate, languages);
      if (found) return found;
    }
    return options.fallback ?? languages[0];
  }

  // Every key that one or more languages do not have, with the languages that miss it.
  function parity(copy, languages = Object.keys(copy || {})) {
    const keys = new Set();
    for (const language of languages) for (const key of Object.keys((copy || {})[language] || {})) keys.add(key);
    const has = (language, key) => own((copy || {})[language], key) && copy[language][key] != null;
    return [...keys].sort()
      .map(key => ({key, missing: languages.filter(language => !has(language, key))}))
      .filter(entry => entry.missing.length);
  }

  // The text of a key: the language, then the fallback language, then the key itself so a gap is visible.
  function lookup(copy, language, fallback, key) {
    for (const name of [language, fallback]) {
      if (own(copy, name) && own(copy[name], key) && copy[name][key] != null) return String(copy[name][key]);
    }
    return String(key);
  }

  // A number with a fixed count of decimal places and the decimal mark of the language. No grouping.
  function format(value, language, places = 2) {
    if (!Number.isFinite(value)) return '';
    try {
      return new Intl.NumberFormat(language, {minimumFractionDigits: places, maximumFractionDigits: places, useGrouping: false}).format(value);
    } catch { return value.toFixed(places); }
  }

  // The same address with the language in its hash or its query. A hash that is not key=value pairs stays.
  function href(address, language, options = {}) {
    const url = new URL(address), param = options.param || 'lang';
    if (options.where === 'query') url.searchParams.set(param, language);
    else if (!url.hash || url.hash.includes('=')) {
      const pairs = params(url.hash);
      pairs.set(param, language);
      url.hash = pairs.toString();
    }
    return url.href;
  }

  function bind(options = {}) {
    const copy = options.copy || {};
    const languages = options.languages || Object.keys(copy);
    const fallback = options.fallback ?? languages[0];
    const param = options.param || 'lang';
    const names = {...ATTRIBUTES, ...options.attributes};
    const doc = options.document || document;
    const scope = options.root || doc;
    const place = options.location || (typeof location !== 'undefined' ? location : {});
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    let language = resolve({hash: place.hash, search: place.search, htmlLang: doc.documentElement.lang, languages, fallback, param});

    const t = key => lookup(copy, language, fallback, key);
    function each(target, name, write) {
      for (const node of target.querySelectorAll('[' + name + ']')) {
        const key = node.getAttribute(name);
        if (key) write(node, t(key));
      }
    }
    function apply(target = scope) {
      doc.documentElement.lang = language;
      each(target, names.text, (node, text) => { node.textContent = text; });
      each(target, names.aria, (node, text) => node.setAttribute('aria-label', text));
      each(target, names.alt, (node, text) => node.setAttribute('alt', text));
    }
    function remember() {
      if (!options.remember) return;
      try {
        const past = options.history || history;
        past.replaceState(null, '', href(place.href, language, {param, where: options.remember}));
      } catch { /* The language still applies when the address cannot change. */ }
    }
    // Switch in place. The page keeps its nodes, so it keeps its playback state.
    function set(next) {
      const found = match(next, languages);
      if (!found) return false;
      const changed = found !== language;
      language = found;
      apply();
      remember();
      if (changed && options.onChange) options.onChange(language);
      return true;
    }
    // A host can switch a framed figure by a change of the hash alone.
    const follow = () => { set(params(place.hash).get(param)); };
    if (win && typeof win.addEventListener === 'function') win.addEventListener('hashchange', follow);
    apply();
    return {
      get language() { return language; },
      languages: [...languages],
      t, apply, set,
      format: (value, places) => format(value, language, places),
      destroy() { if (win && typeof win.removeEventListener === 'function') win.removeEventListener('hashchange', follow); },
    };
  }

  const api = {params, match, resolve, parity, lookup, format, href, bind};
  root.LanguageCopy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
