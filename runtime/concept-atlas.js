// Concept atlas: the concepts of a page set, as an atlas, a dictionary, or a panel over another page.
//
// The data is JSON with SKOS names: prefLabel and definition per language, altLabel, broader, related, and
// the units where a concept appears. Load language-copy.js and companion-pages.js before this file.
// The views never write data as HTML.
(function (root) {
  'use strict';

  const need = (name, file) => root[name] || (typeof require === 'function' ? require(file) : null);
  const Copy = need('LanguageCopy', './language-copy.js');
  const Pages = need('CompanionPages', './companion-pages.js');
  const {own, isRecord} = Pages;

  const SCHEMA = 'html-tools-concept-atlas/v1';
  const WORDS = {en: {
    title: 'Concepts', close: 'Close', search: 'Search concepts', loading: 'Loading the concepts.',
    error: 'The concepts did not load.', retry: 'Try again', on: 'On this unit', near: 'Related concepts',
    elsewhere: 'Elsewhere in the atlas', empty: 'This unit has no concepts.', noResults: 'No matching concept.',
    choose: 'Select a concept.', relations: 'Relations', none: 'No relations are recorded.', units: 'Units',
    unit: 'Unit', unavailable: 'No unit is selected.', altLabels: 'Other names', results: 'Results',
    graph: 'The selected concept and its neighbors. The numbers match the list below the graph.',
    graphLimit: 'The graph shows a limited count of neighbors. The relation list is complete.',
    noDefinition: 'No definition is available.', dictionary: 'Dictionary', atlas: 'Atlas', downloads: 'Downloads',
    broader: 'has the broader concept', related: 'relates to', command: 'Concepts',
  }};

  // Every problem in the data, as {record, field, message}. An empty list means that the data is valid.
  function validate(raw) {
    const declared = isRecord(raw) && Array.isArray(raw.languages) ? raw.languages : [];
    const languages = declared.filter(language => typeof language === 'string' && language.trim());
    const check = Pages.checker(languages);
    if (!isRecord(raw)) { check.add('data', '', 'is not an object'); return check.problems; }
    if (raw.schema !== SCHEMA) check.add('data', 'schema', 'is not "' + SCHEMA + '"');
    if (!languages.length || languages.length !== declared.length) check.add('data', 'languages', 'is not a list of language tags');
    const conceptIds = new Set((Array.isArray(raw.concepts) ? raw.concepts : [])
      .map(concept => isRecord(concept) ? Pages.identifier(concept.id) : null).filter(id => id !== null));
    const unitIds = check.records('units', raw.units, (name, unit) => {
      check.text(name, 'title', unit.title, {required: true});
      if (unit.focus != null) check.refs(name, 'focus', [unit.focus], conceptIds);
    });
    check.records('concepts', raw.concepts, (name, concept, id) => {
      check.text(name, 'prefLabel', concept.prefLabel, {required: true});
      check.text(name, 'definition', concept.definition, {required: true});
      if (concept.altLabel != null) {
        const lists = isRecord(concept.altLabel) ? Object.values(concept.altLabel) : [null];
        if (!lists.every(list => Array.isArray(list) && list.every(label => typeof label === 'string'))) {
          check.add(name, 'altLabel', 'is not a list of names for each language');
        }
      }
      check.refs(name, 'broader', concept.broader, conceptIds, id);
      check.refs(name, 'related', concept.related, conceptIds, id);
      check.refs(name, 'units', concept.units, unitIds);
      check.list(name, 'relations', concept.relations).forEach((relation, index) => {
        const field = 'relations[' + index + ']';
        if (!isRecord(relation) || typeof relation.type !== 'string' || !relation.type.trim()) check.add(name, field, 'has no type');
        else check.refs(name, field, [relation.target], conceptIds, id);
      });
    });
    if (raw.relationTypes != null) {
      if (!isRecord(raw.relationTypes)) check.add('data', 'relationTypes', 'is not an object');
      else for (const [type, label] of Object.entries(raw.relationTypes)) check.text('relationTypes "' + type + '"', 'label', label, {required: true});
    }
    check.list('data', 'downloads', raw.downloads).forEach((download, index) => {
      const name = 'downloads[' + index + ']';
      if (!isRecord(download)) { check.add(name, '', 'is not an object'); return; }
      check.text(name, 'label', download.label, {required: true, plain: true});
      check.url(name, 'href', download.href, {required: true});
    });
    return check.problems;
  }

  // The checked data in the form that the views read. Throws an error that names the bad records.
  function normalize(raw) {
    Pages.assertValid(validate(raw), 'Concept atlas data');
    const concepts = Object.create(null), units = Object.create(null), relations = [], seen = new Set();
    for (const unit of raw.units) {
      const id = Pages.identifier(unit.id);
      units[id] = {id, title: unit.title, focus: unit.focus ?? null, concepts: []};
    }
    const add = (source, type, target) => {
      const key = JSON.stringify([source, type, target]);
      if (!seen.has(key)) { seen.add(key); relations.push({source, type, target, key}); }
    };
    for (const concept of raw.concepts) {
      const id = concept.id, unitIds = [...new Set((concept.units || []).map(Pages.identifier))];
      concepts[id] = {id, prefLabel: concept.prefLabel, definition: concept.definition, altLabel: concept.altLabel || {}, units: Pages.unitOrder(unitIds)};
      for (const unit of unitIds) units[unit].concepts.push(id);
      for (const target of concept.broader || []) add(id, 'broader', target);
      // "related" has no direction, so one pair is one relation.
      for (const target of concept.related || []) {
        const [first, second] = [id, target].sort();
        add(first, 'related', second);
      }
      for (const relation of concept.relations || []) add(id, relation.type.trim(), relation.target);
    }
    relations.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return {
      languages: [...raw.languages], concepts, units,
      relations: relations.map(({source, type, target}) => ({source, type, target})),
      relationTypes: raw.relationTypes || {}, downloads: raw.downloads || [],
    };
  }

  const label = (data, id, language) => Pages.pick(data.concepts[id].prefLabel, language, data.languages[0]);
  // Concept ids in the alphabetical order of their labels in the language.
  const order = (data, ids, language) => Pages.sortBy(ids, language, id => label(data, id, language));

  // The concepts on a unit, and the concepts one relation away from them.
  function context(data, unit) {
    const id = Pages.identifier(unit), found = id !== null && data.units[id] ? data.units[id] : null;
    const on = new Set(found ? found.concepts : []), near = new Set();
    for (const edge of data.relations) {
      if (on.has(edge.source) && !on.has(edge.target)) near.add(edge.target);
      if (on.has(edge.target) && !on.has(edge.source)) near.add(edge.source);
    }
    return {unit: found, on, near};
  }
  const category = (found, id) => (found.on.has(id) ? 'on' : found.near.has(id) ? 'near' : 'elsewhere');

  // The concepts that match the query in any language, in the order of the active language.
  function search(data, query, language) {
    const ids = Object.keys(data.concepts).filter(id => {
      const concept = data.concepts[id];
      return Pages.matches([id, ...Pages.texts(concept.prefLabel), ...Pages.texts(concept.altLabel), ...Pages.texts(concept.definition)], query);
    });
    return order(data, ids, language);
  }

  // A concept, its relations, and up to `limit` neighbors for the graph.
  function neighborhood(data, id, language, limit = 8) {
    if (!data.concepts[id]) return {ids: [], edges: [], omitted: 0};
    const edges = data.relations.filter(edge => edge.source === id || edge.target === id);
    const neighbors = order(data, [...new Set(edges.flatMap(edge => [edge.source, edge.target]))].filter(key => key !== id), language);
    return {ids: [id, ...neighbors.slice(0, limit)], edges, omitted: Math.max(0, neighbors.length - limit)};
  }

  // What a key does to the panel: 'toggle', 'close' or null. Keys in a field stay with the field.
  function shortcut(event, open, inside = false, key = 'o') {
    if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
    const path = (event.composedPath && event.composedPath()) || [event.target];
    const editable = path.some(node => node && (node.isContentEditable || (node.matches && node.matches('input,textarea,select,[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"]'))));
    if (event.key === 'Escape') return open && (inside || !editable) ? 'close' : null;
    if (editable || !key) return null;
    return String(event.key).toLowerCase() === key ? 'toggle' : null;
  }

  // The address of an atlas or dictionary page for a language, a unit and a concept.
  function pageHref(page, fields = {}) {
    return Pages.safeUrl(Pages.href(page, {lang: fields.language, unit: fields.unit, concept: fields.concept}));
  }

  let count = 0;
  // Draw a view in `host`. `view` is 'atlas', 'dictionary' or 'panel'. Returns {update, select, selected, input}.
  function mount(host, options = {}) {
    const doc = host.ownerDocument, view = ['dictionary', 'panel'].includes(options.view) ? options.view : 'atlas';
    const copy = Pages.words(WORDS, options.words), fallback = options.fallback || 'en', prefix = 'cp-concepts-' + (++count);
    const el = (tag, className, text) => Pages.element(doc, tag, className, text);
    let data = null, failure = null, loading = false, expanded = false;
    let language = options.language || doc.documentElement.lang || fallback;
    let unit = Pages.identifier(options.unit), selected = options.selected || null, found = null;
    const t = key => Copy.lookup(copy, language, fallback, key);
    const say = value => Pages.pick(value, language, data ? data.languages[0] : fallback);

    host.classList.add('cp-root', 'cp-concepts', 'cp-' + view);
    const contextLine = el('p', 'cp-context'), searchLabel = el('label', 'cp-search-label'), input = el('input', 'cp-search');
    input.type = 'search'; input.id = prefix + '-search'; input.autocomplete = 'off'; input.spellcheck = false;
    searchLabel.htmlFor = input.id;
    const status = el('p', 'cp-status'); status.setAttribute('role', 'status');
    const directory = el('section', 'cp-directory'), detail = el('section', 'cp-detail'), body = el('div', 'cp-body');
    const cards = el('div', 'cp-cards'), foot = el('nav', 'cp-links');
    if (view === 'dictionary') body.append(cards); else body.append(directory, detail);
    host.append(contextLine, searchLabel, input, status, body, foot);

    function button(text, run, key) {
      const node = el('button', 'cp-button', text);
      node.type = 'button';
      if (key) node.dataset.cpKey = key;
      node.addEventListener('click', run);
      return node;
    }
    function unitLink(id) {
      const title = say(data.units[id].title);
      return Pages.link(doc, t('unit') + ' ' + id + (title ? ' · ' + title : ''), Pages.fill(options.unitHref, {unit: id, lang: language}));
    }
    function unitList(concept) {
      const details = el('details', 'cp-units'), list = el('ul');
      details.append(el('summary', '', t('units') + ' (' + concept.units.length + ')'));
      for (const id of concept.units) { const row = el('li'); row.append(unitLink(id)); list.append(row); }
      details.append(list);
      return details;
    }
    function names(concept) {
      const list = Array.isArray(concept.altLabel[language]) ? concept.altLabel[language] : [];
      return list.length ? el('p', 'cp-muted', t('altLabels') + ': ' + list.join(', ')) : null;
    }
    function select(id, notify = true) {
      if (!data || !data.concepts[id]) return;
      selected = id;
      render();
      if (notify && options.onSelect) options.onSelect(id);
    }
    function conceptButton(id, number) {
      const node = button('', () => select(id), (number ? 'graph-' : 'concept-') + id), kind = category(found, id);
      node.classList.add('cp-concept', 'cp-' + kind);
      node.setAttribute('aria-pressed', String(id === selected));
      if (number) node.append(el('span', 'cp-number', String(number)));
      node.append(el('span', 'cp-concept-label', label(data, id, language)), el('small', '', t(kind)));
      return node;
    }
    function group(title, ids) {
      if (!ids.length) return;
      const list = el('div', 'cp-concept-list');
      for (const id of ids) list.append(conceptButton(id));
      directory.append(el('h3', '', title), list);
    }
    function renderDirectory() {
      directory.replaceChildren();
      if (!data) return;
      const query = input.value.trim(), all = search(data, query, language);
      const of = kind => all.filter(id => category(found, id) === kind);
      status.textContent = query ? t('results') + ': ' + all.length : '';
      if (query) {
        for (const kind of ['on', 'near', 'elsewhere']) group(t(kind), of(kind));
        if (!all.length) directory.append(el('p', 'cp-muted', t('noResults')));
        return;
      }
      group(t('on'), of('on'));
      if (!found.on.size && found.unit) directory.append(el('p', 'cp-muted', t('empty')));
      const near = of('near');
      if (view === 'panel' && near.length) {
        const disclosure = el('details', 'cp-near'), list = el('div', 'cp-concept-list');
        disclosure.open = expanded;
        disclosure.append(el('summary', '', t('near') + ' (' + near.length + ')'));
        for (const id of near) list.append(conceptButton(id));
        disclosure.append(list);
        disclosure.addEventListener('toggle', () => { if (disclosure.isConnected) expanded = disclosure.open; });
        directory.append(disclosure);
      } else group(t('near'), near);
      if (view === 'atlas') group(t('elsewhere'), of('elsewhere'));
    }
    function renderGraph(id) {
      const local = neighborhood(data, id, language), figure = el('figure', 'cp-graph'), ns = 'http://www.w3.org/2000/svg';
      const svg = (tag, attributes) => {
        const node = doc.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
        return node;
      };
      const network = svg('svg', {viewBox: '0 0 320 224', role: 'img', 'aria-label': t('graph')});
      const points = new Map([[id, [160, 112]]]);
      local.ids.slice(1).forEach((key, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / (local.ids.length - 1);
        points.set(key, [160 + Math.cos(angle) * 128, 112 + Math.sin(angle) * 86]);
      });
      for (const key of local.ids.slice(1)) {
        const point = points.get(key);
        network.append(svg('line', {x1: 160, y1: 112, x2: point[0], y2: point[1], class: 'cp-edge'}));
      }
      local.ids.forEach((key, index) => {
        const point = points.get(key), mark = svg('g', {class: 'cp-node cp-' + category(found, key) + (key === id ? ' cp-selected' : '')});
        const number = svg('text', {x: point[0], y: point[1] + 5, 'text-anchor': 'middle'});
        number.textContent = String(index + 1);
        mark.append(svg('circle', {cx: point[0], cy: point[1], r: key === id ? 20 : 16}), number);
        network.append(mark);
      });
      const legend = el('div', 'cp-graph-legend');
      local.ids.forEach((key, index) => legend.append(conceptButton(key, index + 1)));
      figure.append(network, el('figcaption', '', t('graph')), legend);
      if (local.omitted) figure.append(el('p', 'cp-muted', t('graphLimit')));
      return figure;
    }
    function relationLabel(type) {
      if (own(data.relationTypes, type)) return say(data.relationTypes[type]);
      return type === 'broader' || type === 'related' ? t(type) : type;
    }
    function renderDetail() {
      detail.replaceChildren();
      if (!data) return;
      if (!selected) { detail.append(el('p', 'cp-muted', t('choose'))); return; }
      const concept = data.concepts[selected];
      detail.append(el('p', 'cp-category', t(category(found, selected))), el('h2', 'cp-concept-title', label(data, selected, language)),
        el('p', 'cp-definition', say(concept.definition) || t('noDefinition')));
      const other = names(concept);
      if (other) detail.append(other);
      detail.append(renderGraph(selected), el('h3', '', t('relations')));
      const edges = neighborhood(data, selected, language).edges, list = el('ul', 'cp-relations');
      for (const edge of edges) {
        const row = el('li'), far = edge.source === selected ? edge.target : edge.source;
        row.append(el('span', '', label(data, edge.source, language) + ' ' + relationLabel(edge.type) + ' ' + label(data, edge.target, language)),
          button(label(data, far, language), () => select(far), 'relation-' + far + '-' + edge.type));
        list.append(row);
      }
      detail.append(edges.length ? list : el('p', 'cp-muted', t('none')), unitList(concept));
    }
    function renderCards(jump) {
      cards.replaceChildren();
      if (!data) return;
      const ids = search(data, input.value, language);
      status.textContent = t('results') + ': ' + ids.length;
      if (!ids.length) cards.append(el('p', 'cp-muted', t('noResults')));
      let target = null;
      for (const id of ids) {
        const concept = data.concepts[id], card = el('article', 'cp-card'), heading = el('h2');
        card.dataset.concept = id; card.tabIndex = -1;
        if (id === selected) { card.classList.add('cp-selected'); target = card; }
        heading.append(el('span', '', label(data, id, language)));
        card.append(heading, el('p', 'cp-definition', say(concept.definition) || t('noDefinition')));
        const other = names(concept);
        if (other) card.append(other);
        const atlas = options.atlasHref ? pageHref(options.atlasHref, {language, unit, concept: id}) : null;
        if (atlas) card.append(Pages.link(doc, t('relations'), atlas));
        card.append(unitList(concept));
        cards.append(card);
      }
      if (jump && target && target.scrollIntoView) target.scrollIntoView({block: 'start'});
    }
    function renderLinks() {
      foot.replaceChildren();
      if (!data) return;
      foot.setAttribute('aria-label', t('downloads'));
      const fields = {language, unit, concept: selected}, tab = view === 'panel';
      if (view !== 'dictionary' && options.dictionaryHref) foot.append(Pages.link(doc, t('dictionary'), pageHref(options.dictionaryHref, fields), tab));
      if (view !== 'atlas' && options.atlasHref) foot.append(Pages.link(doc, t('atlas'), pageHref(options.atlasHref, fields), tab));
      for (const download of data.downloads) foot.append(Pages.link(doc, say(download.label), download.href, tab));
    }
    function render(jump = false) {
      const active = doc.activeElement, key = active && host.contains(active) && active.dataset ? active.dataset.cpKey : null;
      searchLabel.textContent = t('search'); input.placeholder = t('search'); input.disabled = !data;
      contextLine.textContent = found && found.unit ? t('unit') + ' ' + found.unit.id + ' · ' + say(found.unit.title) : view === 'panel' ? t('unavailable') : '';
      contextLine.hidden = !contextLine.textContent;
      if (view === 'dictionary') renderCards(jump); else { renderDirectory(); renderDetail(); }
      renderLinks();
      if (!data) {
        status.textContent = failure ? t('error') : loading ? t('loading') : '';
        const place = view === 'dictionary' ? cards : directory;
        if (failure) {
          place.append(Pages.failureList(doc, failure));
          if (!options.data) place.append(button(t('retry'), start, 'retry'));
        }
      }
      if (key) {
        const again = [...host.querySelectorAll('[data-cp-key]')].find(node => node.dataset.cpKey === key);
        if (again) again.focus({preventScroll: true});
      }
    }
    function update(next = {}) {
      const moved = own(next, 'unit') && Pages.identifier(next.unit) !== unit, chosen = own(next, 'selected');
      if (moved && !chosen) { input.value = ''; expanded = false; }
      if (next.language) language = next.language;
      if (own(next, 'unit')) unit = Pages.identifier(next.unit);
      if (chosen) selected = next.selected;
      found = data ? context(data, unit) : null;
      if (data && ((moved && !chosen) || !selected || !data.concepts[selected])) {
        const focus = found.unit && found.on.has(found.unit.focus) ? found.unit.focus : null;
        selected = focus || order(data, [...found.on], language)[0] || (view === 'atlas' ? order(data, Object.keys(data.concepts), language)[0] : null) || null;
      }
      render(chosen);
    }
    function start() {
      failure = null; loading = true; render();
      return Pages.load(options, root).then(normalize).then(
        ready => { data = ready; loading = false; update({selected}); },
        error => { failure = error; loading = false; render(); });
    }
    input.addEventListener('input', () => { if (view === 'dictionary') renderCards(false); else renderDirectory(); });
    const ready = start();
    return {update, select, ready, get selected() { return selected; }, get input() { return input; }, get language() { return language; }};
  }

  // A dialog over the page with the concepts of the unit on view. Returns {open, close, toggle, sync, view}.
  // `unit` is a function that returns the unit id on view. The default reads `unit` from the address.
  function panel(options = {}) {
    const doc = options.document || root.document, copy = Pages.words(WORDS, options.words), fallback = options.fallback || 'en';
    const t = key => Copy.lookup(copy, doc.documentElement.lang || fallback, fallback, key);
    const dialog = Pages.element(doc, 'dialog', 'cp-panel cp-root'), head = Pages.element(doc, 'div', 'cp-panel-head');
    dialog.id = options.id || 'cp-concept-panel';
    const title = Pages.element(doc, 'h2'), closer = Pages.element(doc, 'button', 'cp-button'), content = Pages.element(doc, 'div', 'cp-panel-content');
    title.id = dialog.id + '-title'; closer.type = 'button';
    dialog.setAttribute('aria-labelledby', title.id);
    head.append(title, closer); dialog.append(head, content); doc.body.append(dialog);
    const view = mount(content, {...options, view: 'panel'});
    const trigger = typeof options.trigger === 'string' ? doc.querySelector(options.trigger) : options.trigger || null;
    const unitNow = () => (options.unit ? options.unit() : Pages.address(root.location, ['unit']).unit);
    let returnTo = null;
    function sync() {
      title.textContent = t('title'); closer.textContent = t('close');
      view.update({language: doc.documentElement.lang || fallback, unit: unitNow()});
      if (trigger) {
        trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', dialog.id);
        trigger.setAttribute('aria-expanded', String(dialog.open));
      }
    }
    function open(opener) {
      if (dialog.open) return;
      returnTo = opener && opener.focus ? opener : doc.activeElement;
      sync(); dialog.showModal(); sync(); closer.focus({preventScroll: true});
    }
    function close() { if (dialog.open) dialog.close(); }
    const toggle = opener => (dialog.open ? close() : open(opener));
    closer.addEventListener('click', close);
    dialog.addEventListener('close', () => {
      sync();
      const target = returnTo && returnTo.isConnected ? returnTo : trigger;
      if (target && target.focus) target.focus({preventScroll: true});
      returnTo = null;
    });
    // The page under the panel does not see keys and clicks that the panel handles.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('click', event => event.stopPropagation());
    function onKey(event) {
      const action = shortcut(event, dialog.open, dialog.contains(event.target), options.key === undefined ? 'o' : options.key);
      if (!action) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (action === 'close') close(); else toggle(event.target);
    }
    root.addEventListener('keydown', onKey, true);
    if (trigger) trigger.addEventListener('click', event => { event.preventDefault(); open(trigger); });
    const watch = new root.MutationObserver(sync);
    watch.observe(doc.documentElement, {attributes: true, attributeFilter: ['lang']});
    root.addEventListener('hashchange', sync);
    (root.HTML_COMMANDS = root.HTML_COMMANDS || []).push(() => [{label: t('command'), hint: options.key === undefined ? 'O' : String(options.key || '').toUpperCase(), group: 'panels', run: () => toggle(), state: () => dialog.open}]);
    sync();
    return {open, close, toggle, sync, view, dialog, destroy() {
      root.removeEventListener('keydown', onKey, true); root.removeEventListener('hashchange', sync);
      watch.disconnect(); dialog.remove();
    }};
  }

  const api = {SCHEMA, WORDS, validate, normalize, label, order, context, category, search, neighborhood, shortcut, pageHref, mount, panel};
  root.ConceptAtlas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
