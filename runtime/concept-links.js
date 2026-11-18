// Concept links: the first mention of each concept of a unit, in the text of that unit, becomes a link that
// opens the concept panel on that concept.
//
// The data is the data of the concept atlas. A concept is matched by its preferred label, its other names
// and its hidden names in the language of the page, as a whole word and in any case. An English name also
// matches with a plural ending. A language with inflection gives its other word forms as `hiddenLabel`.
// Load language-copy.js, companion-pages.js and concept-atlas.js before this file.
(function (root) {
  'use strict';

  const need = (name, file) => root[name] || (typeof require === 'function' ? require(file) : null);
  const Pages = need('CompanionPages', './companion-pages.js');
  const Atlas = need('ConceptAtlas', './concept-atlas.js');

  // A unit can hold alternatives, such as the inline versions of a slide, and shows one of them. Each
  // element that matches PART gets its own first mentions, so a link never stands only in a hidden part.
  const PART = '[data-version]';
  // Where a link can stand, and where it never stands: a heading, a control, code, a figure, another link.
  const WITHIN = 'p, li, td, th, dd, figcaption, blockquote, .card';
  const SKIP = 'h1, h2, a, button, summary, label, code, pre, kbd, svg, iframe, script, style, textarea, select, input, [contenteditable], .concept-link';
  const CSS = [
    '.concept-link{cursor:help;text-decoration:underline dotted;text-decoration-color:var(--cyan,#5CD6EC);text-underline-offset:.18em}',
    '.concept-link:hover,.concept-link:focus-visible{text-decoration-style:solid;color:var(--cyan,#5CD6EC);outline:none}',
    'body.annot-on .concept-link{cursor:inherit}',
    '@media print{.concept-link{text-decoration:none}}',
  ].join('\n');

  // The names of a concept in a language, the longest first.
  function names(concept, language) {
    const list = field => (Array.isArray((concept[field] || {})[language]) ? concept[field][language] : []);
    const label = typeof concept.prefLabel === 'string' ? concept.prefLabel : (concept.prefLabel || {})[language];
    const all = [label, ...list('altLabel'), ...list('hiddenLabel')].filter(name => typeof name === 'string' && name.trim());
    return [...new Set(all.map(name => name.trim()))].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  }

  // One name as a pattern: the whole word, any case, any white space between its words.
  function pattern(name, language) {
    const body = name.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const plural = /^en(-|$)/i.test(language || '') ? '(?:e?s)?' : '';
    return new RegExp('(?<![\\p{L}\\p{N}])' + body + plural + '(?![\\p{L}\\p{N}])', 'giu');
  }

  // The concepts of a unit as {id, patterns}. The concept with the longest name is first, so that
  // "context window" takes its words before "context" does.
  function entries(data, unit, language) {
    return [...Atlas.context(data, unit).on].map(id => ({id, names: names(data.concepts[id], language)}))
      .filter(entry => entry.names.length)
      .sort((a, b) => b.names[0].length - a.names[0].length || (a.id < b.id ? -1 : 1))
      .map(entry => ({id: entry.id, patterns: entry.names.map(name => pattern(name, language))}));
  }

  // Where the links go. `texts` is the text of a unit as a list of strings in reading order. Each concept
  // gets a link on its first mention. Every mention of a concept keeps its words, so "tide" gets no link
  // inside a later "spring tide". Returns [{text, start, end, concept}] in reading order.
  function plan(texts, list) {
    const taken = texts.map(() => []), marks = [];
    const free = (index, start, end) => taken[index].every(([from, to]) => end <= from || start >= to);
    for (const entry of list) {
      let first = null;
      texts.forEach((text, index) => {
        const found = [];
        for (const each of entry.patterns) {
          each.lastIndex = 0;
          for (let match = each.exec(text); match; match = each.exec(text)) {
            const start = match.index, end = start + match[0].length;
            if (free(index, start, end) && found.every(([from, to]) => end <= from || start >= to)) found.push([start, end]);
          }
        }
        found.sort((a, b) => a[0] - b[0]);
        if (found.length && !first) first = {text: index, start: found[0][0], end: found[0][1], concept: entry.id};
        taken[index].push(...found);
      });
      if (first) marks.push(first);
    }
    return marks.sort((a, b) => a.text - b.text || a.start - b.start);
  }

  // Draw the links of every unit. `options`: `data` or `src` (the concept data), `panel` (a concept panel, its
  // `select` opens a concept) or `onOpen(id, link)`, `unit` (the selector of a unit, default: the shape in
  // `window.HTML_ANNOTATE`, else ".slide"), `unitId(element)` (default: the element id), `within`, `skip`,
  // `part`, `language`. Returns {ready, refresh, clear, links}.
  function attach(options = {}) {
    const doc = options.document || root.document, shape = root.HTML_ANNOTATE || {};
    const unitSelector = options.unit || shape.unit || '.slide', idOf = options.unitId || (node => node.id);
    const within = options.within || WITHIN, skip = options.skip || SKIP, part = options.part || PART;
    const language = () => options.language || doc.documentElement.lang || 'en';
    let data = null, links = [];

    if (!doc.getElementById('concept-links-style')) {
      const style = doc.createElement('style');
      style.id = 'concept-links-style'; style.textContent = CSS;
      doc.head.append(style);
    }
    function textNodes(unit) {
      const walker = doc.createTreeWalker(unit, 4), nodes = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (parent && node.nodeValue.trim() && parent.closest(within) && !parent.closest(skip)) nodes.push(node);
      }
      return nodes;
    }
    function wrap(node, mark) {
      const range = doc.createRange(), link = doc.createElement('span'), concept = data.concepts[mark.concept];
      range.setStart(node, mark.start); range.setEnd(node, mark.end);
      link.className = 'concept-link'; link.dataset.concept = mark.concept; link.tabIndex = 0;
      link.setAttribute('role', 'button');
      link.title = Pages.pick(concept.definition, language(), data.languages[0]);
      range.surroundContents(link);
      return link;
    }
    function clear() {
      for (const link of links) {
        const parent = link.parentNode;
        if (!parent) continue;
        link.replaceWith(...link.childNodes);
        parent.normalize();
      }
      links = [];
    }
    function refresh() {
      clear();
      if (!data) return;
      for (const unit of doc.querySelectorAll(unitSelector)) {
        const list = entries(data, idOf(unit), language());
        if (!list.length) continue;
        const groups = new Map();
        for (const node of textNodes(unit)) {
          const home = node.parentElement.closest(part), key = home && unit.contains(home) ? home : unit;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(node);
        }
        for (const nodes of groups.values()) {
          const marks = plan(nodes.map(node => node.nodeValue), list);
          // The last mark of a text node first: a wrap splits the node and keeps the offsets before it.
          for (const mark of marks.reverse()) links.push(wrap(nodes[mark.text], mark));
        }
      }
    }
    function open(event) {
      const link = event.target.closest && event.target.closest('.concept-link');
      if (!link || !links.includes(link) || doc.body.classList.contains('annot-on')) return;
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); event.stopPropagation();
      if (options.panel) options.panel.select(link.dataset.concept, link);
      if (options.onOpen) options.onOpen(link.dataset.concept, link);
    }
    doc.addEventListener('click', open, true);
    doc.addEventListener('keydown', open, true);
    const watch = new root.MutationObserver(refresh);
    watch.observe(doc.documentElement, {attributes: true, attributeFilter: ['lang']});
    const ready = Pages.load(options, root).then(Atlas.normalize).then(loaded => { data = loaded; refresh(); return links.length; });
    return {ready, refresh, clear, get links() { return links.slice(); }, destroy() {
      doc.removeEventListener('click', open, true); doc.removeEventListener('keydown', open, true);
      watch.disconnect(); clear();
    }};
  }

  const api = {WITHIN, SKIP, PART, names, pattern, entries, plan, attach};
  root.ConceptLinks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
