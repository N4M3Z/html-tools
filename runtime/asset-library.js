// Library: the asset records of a page set, and its references with corrections kept apart.
//
// An asset record has its units, file, sha256, source, license status and notes. The assets view has a search,
// a license filter and a unit filter. The references view shows sources and corrections in two separate lists.
// Load language-copy.js and companion-pages.js before this file. The views never write data as HTML.
(function (root) {
  'use strict';

  const need = (name, file) => root[name] || (typeof require === 'function' ? require(file) : null);
  const Copy = need('LanguageCopy', './language-copy.js');
  const Pages = need('CompanionPages', './companion-pages.js');
  const {own, isRecord} = Pages;

  const SCHEMA = 'html-tools-asset-library/v1';
  const PAGE = 60;
  const WORDS = {en: {
    search: 'Search assets', status: 'License status', all: 'All', unitFilter: 'Unit', allUnits: 'All units',
    unit: 'Unit', units: 'Units', unused: 'No unit uses this file.', shown: 'Shown', noResults: 'No matching record.',
    file: 'File', hash: 'SHA-256', source: 'Source', noSource: 'No source is recorded.', license: 'License',
    notes: 'Notes', more: 'Show more', loading: 'Loading the records.', error: 'The records did not load.',
    retry: 'Try again', searchReferences: 'Search sources and corrections', references: 'Sources',
    noReferences: 'No matching source.', corrections: 'Corrections', correction: 'Correction',
    correctionNote: 'A correction is a later change. It is not a statement of a source.',
    noCorrections: 'No matching correction.', basis: 'Basis',
  }};

  // Every problem in the data, as {record, field, message}. An empty list means that the data is valid.
  function validate(raw) {
    const declared = isRecord(raw) && Array.isArray(raw.languages) ? raw.languages : [];
    const languages = declared.filter(language => typeof language === 'string' && language.trim());
    const check = Pages.checker(languages);
    if (!isRecord(raw)) { check.add('data', '', 'is not an object'); return check.problems; }
    if (raw.schema !== SCHEMA) check.add('data', 'schema', 'is not "' + SCHEMA + '"');
    if (!languages.length || languages.length !== declared.length) check.add('data', 'languages', 'is not a list of language tags');
    const units = (name, record) => {
      for (const unit of check.list(name, 'units', record.units)) {
        if (Pages.identifier(unit) === null) check.add(name, 'units', 'names "' + String(unit) + '", which is not a valid unit id');
      }
    };
    const statuses = check.records('licenseStatuses', raw.licenseStatuses, (name, status) => check.text(name, 'label', status.label, {required: true}));
    check.records('assets', raw.assets, (name, asset) => {
      units(name, asset);
      check.url(name, 'file', asset.file, {required: true});
      if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) check.add(name, 'sha256', 'is not 64 lower-case hex digits');
      check.text(name, 'title', asset.title);
      check.text(name, 'notes', asset.notes);
      if (asset.source != null) {
        if (!isRecord(asset.source)) check.add(name, 'source', 'is not an object');
        else {
          check.text(name, 'source.title', asset.source.title, {required: true, plain: true});
          check.url(name, 'source.url', asset.source.url);
        }
      }
      if (!isRecord(asset.license)) check.add(name, 'license', 'is required');
      else {
        if (!statuses.has(Pages.identifier(asset.license.status))) check.add(name, 'license.status', 'names "' + String(asset.license.status) + '", which is not a declared status');
        check.url(name, 'license.url', asset.license.url);
      }
    });
    const references = check.records('references', raw.references ?? [], (name, reference) => {
      units(name, reference);
      check.text(name, 'title', reference.title, {required: true, plain: true});
      check.url(name, 'url', reference.url);
      check.text(name, 'note', reference.note);
    });
    check.records('corrections', raw.corrections ?? [], (name, correction) => {
      units(name, correction);
      check.text(name, 'text', correction.text, {required: true});
      check.refs(name, 'references', correction.references, references);
    });
    return check.problems;
  }

  // The checked data in the form that the views read. Throws an error that names the bad records.
  function normalize(raw) {
    Pages.assertValid(validate(raw), 'Asset library data');
    const tidy = record => ({...record, units: Pages.unitOrder([...new Set((record.units || []).map(Pages.identifier))])});
    const statuses = Object.create(null), references = Object.create(null);
    for (const status of raw.licenseStatuses) statuses[status.id] = status;
    const sources = (raw.references || []).map(tidy);
    for (const reference of sources) references[reference.id] = reference;
    return {
      languages: [...raw.languages], statuses, statusOrder: raw.licenseStatuses.map(status => status.id),
      assets: raw.assets.map(tidy), references: sources, referenceById: references,
      corrections: (raw.corrections || []).map(tidy),
    };
  }

  const fileName = file => String(file).split(/[?#]/)[0].split('/').pop();
  const title = (asset, language, fallback) => Pages.pick(asset.title, language, fallback) || fileName(asset.file);

  // 'image', 'video', 'audio' or 'file', from the extension. Only an image gets a preview.
  function mediaKind(file) {
    const name = fileName(file).toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(name)) return 'image';
    if (/\.(mp4|webm|mov)$/.test(name)) return 'video';
    return /\.(mp3|ogg|wav|m4a)$/.test(name) ? 'audio' : 'file';
  }

  function assetText(asset) {
    const source = asset.source || {}, license = asset.license || {};
    return [asset.id, asset.file, asset.sha256, ...Pages.texts(asset.title), ...Pages.texts(asset.notes), ...Pages.texts(source.title),
      source.author, source.url, license.status, license.name, ...asset.units];
  }

  // The assets that match a query, a license status and a unit, in the order of their titles in the language.
  function filterAssets(data, filter = {}, language) {
    const unit = Pages.identifier(filter.unit), status = filter.status && filter.status !== 'all' ? filter.status : null;
    const kept = data.assets.filter(asset => (!status || asset.license.status === status)
      && (unit === null || asset.units.includes(unit)) && Pages.matches(assetText(asset), filter.query));
    return Pages.sortBy(kept, language, asset => title(asset, language, data.languages[0]));
  }

  // The count of assets for each declared license status.
  function statusCounts(data, assets = data.assets) {
    const counts = Object.create(null);
    for (const id of data.statusOrder) counts[id] = 0;
    for (const asset of assets) counts[asset.license.status] += 1;
    return counts;
  }

  // Every unit that a record names, in unit order.
  const unitsOf = records => Pages.unitOrder([...new Set(records.flatMap(record => record.units))]);

  // The sources and the corrections that match. They are two lists, and no record moves between them.
  function filterReferences(data, filter = {}, language) {
    const unit = Pages.identifier(filter.unit), on = record => unit === null || record.units.includes(unit);
    const references = data.references.filter(reference => on(reference)
      && Pages.matches([reference.id, ...Pages.texts(reference.title), reference.author, reference.url, ...Pages.texts(reference.note)], filter.query));
    const corrections = data.corrections.filter(correction => on(correction)
      && Pages.matches([correction.id, ...Pages.texts(correction.text), ...correction.units], filter.query));
    return {references: Pages.sortBy(references, language, reference => Pages.pick(reference.title, language, data.languages[0])), corrections};
  }

  let count = 0;
  // Draw a view in `host`. `view` is 'assets' or 'references'. Returns {update, ready, input}.
  function mount(host, options = {}) {
    const doc = host.ownerDocument, view = options.view === 'references' ? 'references' : 'assets';
    const copy = Pages.words(WORDS, options.words), fallback = options.fallback || 'en', prefix = 'cp-library-' + (++count);
    const el = (tag, className, text) => Pages.element(doc, tag, className, text);
    let data = null, failure = null, loading = false, limit = PAGE;
    let language = options.language || doc.documentElement.lang || fallback;
    let unit = Pages.identifier(options.unit), status = 'all', selected = options.selected || null;
    const t = key => Copy.lookup(copy, language, fallback, key);
    const say = value => Pages.pick(value, language, data ? data.languages[0] : fallback);

    host.classList.add('cp-root', 'cp-library', 'cp-' + view);
    const controls = el('div', 'cp-controls'), tally = el('p', 'cp-status'), list = el('div', 'cp-records');
    tally.setAttribute('role', 'status');
    function field(name, tag) {
      const label = el('label', 'cp-search-label'), control = el(tag, tag === 'input' ? 'cp-search' : 'cp-select');
      control.id = prefix + '-' + name; label.htmlFor = control.id;
      const wrap = el('div', 'cp-field'); wrap.append(label, control); controls.append(wrap);
      return {label, control};
    }
    const query = field('search', 'input'), statusField = view === 'assets' ? field('status', 'select') : null, unitField = field('unit', 'select');
    query.control.type = 'search'; query.control.autocomplete = 'off'; query.control.spellcheck = false;
    host.append(controls, tally, list);

    function options_(select, entries, value) {
      select.replaceChildren();
      for (const [key, text] of entries) {
        const option = el('option', '', text);
        option.value = key; option.selected = key === value;
        select.append(option);
      }
    }
    function unitLinks(units) {
      const line = el('p', 'cp-unit-links');
      if (!units.length) { line.classList.add('cp-muted'); line.textContent = view === 'assets' ? t('unused') : ''; return line; }
      line.append(el('span', 'cp-term', units.length > 1 ? t('units') : t('unit')));
      for (const id of units) line.append(Pages.link(doc, id, Pages.fill(options.unitHref, {unit: id, lang: language})));
      return line;
    }
    function row(list_, term, ...content) {
      const value = el('dd');
      value.append(...content);
      list_.append(el('dt', '', term), value);
    }
    function assetCard(asset) {
      const card = el('article', 'cp-card cp-asset'), facts = el('dl', 'cp-facts'), name = title(asset, language, data.languages[0]);
      card.dataset.asset = asset.id; card.tabIndex = -1;
      if (asset.id === selected) card.classList.add('cp-selected');
      const file = Pages.safeUrl(asset.file);
      if (file && mediaKind(asset.file) === 'image') {
        const image = el('img', 'cp-preview');
        image.setAttribute('src', file); image.alt = name; image.loading = 'lazy';
        card.append(image);
      }
      const badge = el('span', 'cp-badge', say(data.statuses[asset.license.status].label));
      badge.dataset.status = asset.license.status;
      card.append(el('h2', '', name), badge);
      row(facts, t('file'), Pages.link(doc, asset.file, asset.file));
      row(facts, t('hash'), el('code', 'cp-hash', asset.sha256));
      if (asset.source) {
        const author = asset.source.author ? el('span', 'cp-muted', ' · ' + asset.source.author) : '';
        row(facts, t('source'), Pages.link(doc, say(asset.source.title), asset.source.url, true), author);
      } else row(facts, t('source'), el('span', 'cp-muted', t('noSource')));
      if (asset.license.name) row(facts, t('license'), Pages.link(doc, asset.license.name, asset.license.url, true));
      if (say(asset.notes)) row(facts, t('notes'), el('span', '', say(asset.notes)));
      card.append(facts, unitLinks(asset.units));
      return card;
    }
    function renderAssets(jump) {
      const found = filterAssets(data, {query: query.control.value, status, unit}, language), counts = statusCounts(data);
      options_(statusField.control, [['all', t('all') + ' (' + data.assets.length + ')'],
        ...data.statusOrder.map(id => [id, say(data.statuses[id].label) + ' (' + counts[id] + ')'])], status);
      tally.textContent = t('shown') + ': ' + found.length + ' / ' + data.assets.length;
      if (!found.length) list.append(el('p', 'cp-muted', t('noResults')));
      const at = selected ? found.findIndex(asset => asset.id === selected) : -1;
      if (at >= limit) limit = at + 1;
      for (const asset of found.slice(0, limit)) list.append(assetCard(asset));
      if (found.length > limit) {
        const more = el('button', 'cp-button', t('more'));
        more.type = 'button';
        more.addEventListener('click', () => { limit += PAGE; render(); });
        list.append(more);
      }
      const target = jump && at >= 0 ? list.querySelector('.cp-selected') : null;
      if (target && target.scrollIntoView) target.scrollIntoView({block: 'start'});
    }
    function renderReferences() {
      const found = filterReferences(data, {query: query.control.value, unit}, language);
      const sources = el('section', 'cp-sources'), corrections = el('section', 'cp-corrections');
      sources.append(el('h2', '', t('references')));
      for (const reference of found.references) {
        const card = el('article', 'cp-card cp-reference'), heading = el('h3');
        card.dataset.reference = reference.id;
        heading.append(Pages.link(doc, say(reference.title), reference.url, true));
        card.append(heading);
        if (reference.author) card.append(el('p', 'cp-muted', reference.author));
        if (say(reference.note)) card.append(el('p', '', say(reference.note)));
        card.append(unitLinks(reference.units));
        sources.append(card);
      }
      if (!found.references.length) sources.append(el('p', 'cp-muted', t('noReferences')));
      corrections.append(el('h2', '', t('corrections')), el('p', 'cp-muted', t('correctionNote')));
      for (const correction of found.corrections) {
        const card = el('article', 'cp-card cp-correction');
        card.dataset.correction = correction.id;
        card.append(el('span', 'cp-badge', t('correction')), el('p', '', say(correction.text)));
        const basis = (correction.references || []).map(id => data.referenceById[id]);
        if (basis.length) {
          const line = el('p', 'cp-basis');
          line.append(el('span', 'cp-term', t('basis')));
          for (const reference of basis) line.append(Pages.link(doc, say(reference.title), reference.url, true));
          card.append(line);
        }
        card.append(unitLinks(correction.units));
        corrections.append(card);
      }
      if (!found.corrections.length) corrections.append(el('p', 'cp-muted', t('noCorrections')));
      tally.textContent = t('references') + ': ' + found.references.length + ' · ' + t('corrections') + ': ' + found.corrections.length;
      list.append(sources, corrections);
    }
    function render(jump = false) {
      const words = view === 'assets' ? t('search') : t('searchReferences');
      query.label.textContent = words; query.control.placeholder = words; query.control.disabled = !data;
      if (statusField) { statusField.label.textContent = t('status'); statusField.control.disabled = !data; }
      unitField.label.textContent = t('unitFilter'); unitField.control.disabled = !data;
      list.replaceChildren();
      if (!data) {
        tally.textContent = failure ? t('error') : loading ? t('loading') : '';
        if (failure) {
          list.append(Pages.failureList(doc, failure));
          if (!options.data) {
            const again = el('button', 'cp-button', t('retry'));
            again.type = 'button'; again.addEventListener('click', start);
            list.append(again);
          }
        }
        return;
      }
      const known = unitsOf(view === 'assets' ? data.assets : [...data.references, ...data.corrections]);
      const shownUnits = unit !== null && !known.includes(unit) ? Pages.unitOrder([...known, unit]) : known;
      options_(unitField.control, [['', t('allUnits')], ...shownUnits.map(id => [id, t('unit') + ' ' + id])], unit ?? '');
      if (view === 'assets') renderAssets(jump); else renderReferences();
    }
    function update(next = {}) {
      if (next.language) language = next.language;
      if (own(next, 'unit')) unit = Pages.identifier(next.unit);
      if (own(next, 'selected')) selected = next.selected;
      render(own(next, 'selected'));
    }
    function start() {
      failure = null; loading = true; render();
      return Pages.load(options, root).then(normalize).then(
        ready => { data = ready; loading = false; render(true); },
        error => { failure = error; loading = false; render(); });
    }
    const filtered = () => { limit = PAGE; render(); };
    query.control.addEventListener('input', filtered);
    if (statusField) statusField.control.addEventListener('change', () => { status = statusField.control.value; filtered(); });
    unitField.control.addEventListener('change', () => {
      unit = Pages.identifier(unitField.control.value);
      if (options.onUnit) options.onUnit(unit);
      filtered();
    });
    const ready = start();
    return {update, ready, get input() { return query.control; }, get unit() { return unit; }, get language() { return language; }};
  }

  const api = {SCHEMA, WORDS, validate, normalize, title, mediaKind, filterAssets, statusCounts, unitsOf, filterReferences, mount};
  root.AssetLibrary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
