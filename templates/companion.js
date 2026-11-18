// Wiring of the companion examples: the concept atlas, the dictionary, the concept panel and the library.
// The page text comes from one copy table through LanguageCopy. The runtimes draw the data.
(function () {
  'use strict';

  const copy = {
    en: {
      skip: 'Skip to the content', examples: 'Companion examples', language: 'Language',
      navPanel: 'Sample units', navAtlas: 'Concept atlas', navDictionary: 'Dictionary', navAssets: 'Asset library', navReferences: 'References',
      atlasTitle: 'Concept atlas', atlasIntro: 'Each concept with its relations and the units where it appears.',
      dictionaryTitle: 'Dictionary', dictionaryIntro: 'Every concept in alphabetical order, with its definition in the active language.',
      assetsTitle: 'Asset library', assetsIntro: 'Each media file with its units, digest, source and license status.',
      referencesTitle: 'References', referencesIntro: 'The sources of the page set. Corrections are in a separate list.',
      panelTitle: 'Sample units', panelIntro: 'A small page set with four units. The Concepts button, or the O key, opens the panel for the unit on view. A concept in the text is a link to the panel. With dock=side in the hash, the panel stays beside the page.',
      concepts: 'Concepts', previous: 'Previous unit', next: 'Next unit', noscript: 'This page needs JavaScript.',
      unit1: 'The sea level moves', unit1Text: 'The tide raises and lowers the sea level two times each day at this sample coast.',
      unit2: 'Two bodies pull', unit2Text: 'Two bodies pull on the water. The range changes with their positions.',
      unit3: 'A gauge records the level', unit3Text: 'A tide gauge writes the level each minute. The record gives the tidal range.',
      unit4: 'A model predicts the next tide', unit4Text: 'A model reads the record and gives the time of the next high water.',
    },
    cs: {
      skip: 'Přejít k obsahu', examples: 'Ukázky doprovodných stránek', language: 'Jazyk',
      navPanel: 'Ukázkové jednotky', navAtlas: 'Atlas pojmů', navDictionary: 'Slovník', navAssets: 'Knihovna médií', navReferences: 'Zdroje',
      atlasTitle: 'Atlas pojmů', atlasIntro: 'Každý pojem se svými vztahy a jednotkami, ve kterých se objevuje.',
      dictionaryTitle: 'Slovník', dictionaryIntro: 'Všechny pojmy podle abecedy, s definicí ve zvoleném jazyce.',
      assetsTitle: 'Knihovna médií', assetsIntro: 'Každý soubor s jednotkami, otiskem, zdrojem a stavem licence.',
      referencesTitle: 'Zdroje', referencesIntro: 'Zdroje sady stránek. Opravy jsou v samostatném seznamu.',
      panelTitle: 'Ukázkové jednotky', panelIntro: 'Malá sada stránek se čtyřmi jednotkami. Tlačítko Pojmy nebo klávesa O otevře panel pro zobrazenou jednotku. Pojem v textu je odkaz do panelu. S dock=side v adrese za mřížkou zůstane panel vedle stránky.',
      concepts: 'Pojmy', previous: 'Předchozí jednotka', next: 'Další jednotka', noscript: 'Tato stránka vyžaduje JavaScript.',
      unit1: 'Hladina moře se hýbe', unit1Text: 'Dmutí na tomto ukázkovém pobřeží dvakrát denně zvedá a snižuje hladinu moře.',
      unit2: 'Působí dvě tělesa', unit2Text: 'Na vodu působí dvě tělesa. Výška dmutí se mění s jejich polohou.',
      unit3: 'Mareograf měří hladinu', unit3Text: 'Mareograf zapisuje hladinu každou minutu. Ze záznamu plyne výška dmutí.',
      unit4: 'Model předpoví další dmutí', unit4Text: 'Model čte záznam a určí čas další nejvyšší hladiny.',
    },
  };
  // The Czech words of the runtimes. English is their default.
  const words = {
    concepts: {cs: {
      title: 'Pojmy', close: 'Zavřít', search: 'Hledat pojmy', loading: 'Načítání pojmů.', error: 'Pojmy se nepodařilo načíst.',
      retry: 'Zkusit znovu', on: 'V této jednotce', near: 'Související pojmy', elsewhere: 'Jinde v atlasu',
      empty: 'Tato jednotka nemá žádné pojmy.', noResults: 'Žádný odpovídající pojem.', choose: 'Vyberte pojem.',
      relations: 'Vztahy', none: 'Žádné vztahy nejsou uvedeny.', units: 'Jednotky', unit: 'Jednotka',
      unavailable: 'Není vybrána žádná jednotka.', altLabels: 'Další názvy', results: 'Výsledky',
      graph: 'Vybraný pojem a jeho sousedé. Čísla odpovídají seznamu pod grafem.',
      graphLimit: 'Graf ukazuje omezený počet sousedů. Seznam vztahů je úplný.', noDefinition: 'Definice není dostupná.',
      dictionary: 'Slovník', atlas: 'Atlas', downloads: 'Ke stažení', broader: 'má širší pojem', related: 'souvisí s', command: 'Pojmy',
      scopeNote: 'Poznámka k rozsahu',
    }},
    library: {cs: {
      search: 'Hledat média', status: 'Stav licence', all: 'Vše', unitFilter: 'Jednotka', allUnits: 'Všechny jednotky',
      unit: 'Jednotka', units: 'Jednotky', unused: 'Tento soubor nepoužívá žádná jednotka.', shown: 'Zobrazeno',
      noResults: 'Žádný odpovídající záznam.', file: 'Soubor', hash: 'SHA-256', source: 'Zdroj', noSource: 'Zdroj není uveden.',
      license: 'Licence', notes: 'Poznámky', more: 'Zobrazit další', loading: 'Načítání záznamů.',
      error: 'Záznamy se nepodařilo načíst.', retry: 'Zkusit znovu', searchReferences: 'Hledat zdroje a opravy',
      references: 'Zdroje', noReferences: 'Žádný odpovídající zdroj.', corrections: 'Opravy', correction: 'Oprava',
      correctionNote: 'Oprava je pozdější změna. Není to tvrzení zdroje.', noCorrections: 'Žádná odpovídající oprava.', basis: 'Podklad',
    }},
  };

  const page = document.body.dataset.page, host = document.getElementById('content');
  const names = ['unit', 'concept', 'asset', 'view', 'dock'];
  let fields = CompanionPages.address(location, names), view = null;

  const text = LanguageCopy.bind({copy, fallback: 'en', remember: 'hash', onChange(language) {
    if (view) view.update({language});
    chrome();
  }});

  // The links between the pages carry the language and the unit. The address format is in the design.
  function chrome() {
    document.title = text.t(document.body.dataset.title);
    document.getElementById('language').value = text.language;
    for (const node of document.querySelectorAll('a[data-page-link]')) {
      const where = node.dataset.unitIn === 'hash' ? 'hash' : 'query';
      node.setAttribute('href', CompanionPages.href(CompanionPages.href(node.dataset.pageLink, {lang: text.language}), {unit: fields.unit}, where));
    }
  }
  function remember(next) {
    fields = {...fields, ...next};
    try { history.replaceState(null, '', CompanionPages.href(location.href, next, 'hash')); }
    catch { /* The view still changes when the address cannot. */ }
    chrome();
  }
  document.getElementById('language').addEventListener('change', event => text.set(event.target.value));

  const shared = {language: text.language, fallback: 'en', unit: fields.unit, unitHref: 'concept-panel.html?lang={lang}#unit={unit}'};
  const conceptPages = {atlasHref: 'concept-atlas.html', dictionaryHref: 'concept-dictionary.html'};
  let follow = () => {};

  if (page === 'atlas' || page === 'dictionary') {
    const kind = fields.view === 'atlas' || fields.view === 'dictionary' ? fields.view : page;
    view = ConceptAtlas.mount(host, {...shared, ...conceptPages, src: 'concepts.json', view: kind, words: words.concepts,
      selected: fields.concept, onSelect: concept => remember({concept})});
    follow = () => view.update({unit: fields.unit, selected: fields.concept});
  } else if (page === 'assets' || page === 'references') {
    view = AssetLibrary.mount(host, {...shared, src: 'library.json', view: page, words: words.library,
      selected: fields.asset, onUnit: unit => remember({unit})});
    follow = () => view.update({unit: fields.unit, selected: fields.asset});
  } else if (page === 'panel') {
    const units = [...document.querySelectorAll('[data-unit]')];
    const show = () => {
      if (!units.some(node => node.dataset.unit === fields.unit)) fields.unit = units[0].dataset.unit;
      for (const node of units) node.hidden = node.dataset.unit !== fields.unit;
      chrome();
    };
    const step = delta => {
      const at = units.findIndex(node => node.dataset.unit === fields.unit);
      const next = units[Math.min(units.length - 1, Math.max(0, at + delta))].dataset.unit;
      location.href = CompanionPages.href(location.href, {unit: next}, 'hash');
    };
    document.getElementById('previous').addEventListener('click', () => step(-1));
    document.getElementById('next').addEventListener('click', () => step(1));
    show();
    const panel = ConceptAtlas.panel({...conceptPages, src: 'concepts.json', trigger: '#concepts', words: words.concepts, fallback: 'en',
      unit: () => fields.unit, unitHref: '#lang={lang}&unit={unit}', dock: fields.dock === 'side' ? 'side' : undefined});
    // The first mention of a concept in the text of a unit opens the panel on that concept.
    ConceptLinks.attach({src: 'concepts.json', panel, unit: '[data-unit]', unitId: node => node.dataset.unit});
    follow = () => { show(); panel.sync(); };
  }
  window.addEventListener('hashchange', () => { fields = CompanionPages.address(location, names); follow(); chrome(); });
  chrome();
})();
