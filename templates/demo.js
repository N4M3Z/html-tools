// Example glue only. Consumers can keep the shared runtime and replace this file.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const example = document.body.dataset.example;
  const query = new URLSearchParams(location.search);
  let version = query.get('version') === 'earlier' ? 'earlier' : 'current';
  let player, fullscreen, saved, observer;
  const words = {
    en: {
      home:'Template examples', model:'Model and readout', evidence:'Evidence and explanation', iterations:'Compare iterations', provenance:'Source and provenance',
      intro:'One complete composition. Optional exploration. Retained sources.',
      indexNote:'These examples use small illustrative SVGs. They contain no observed measurements or physical simulations.',
      language:'Language', play:'Play', pause:'Pause', amplitude:'Amplitude', time:'Elapsed time',
      sources:'Sources', close:'Close', fullscreen:'Fullscreen', exitFullscreen:'Exit fullscreen', unavailable:'Fullscreen is unavailable. The normal view remains usable.',
      version:'Iteration', current:'Current version', earlier:'Earlier version',
      modelHeading:'Follow one moving point', modelCopy:'Change the amplitude while the point moves. Pause only when you choose Pause.',
      currentCaption:'Circular schematic', earlierCaption:'Horizontal projection', sampleLimit:'Illustrative model. Units and motion are chosen for this example.',
      evidenceHeading:'Let the evidence occupy the space', evidenceCopy:'Keep the complete source image beside a compact explanation. Use Sources for the detailed record.',
      evidenceLimit:'The curve is illustrative. It is not a measured time series.',
      provenanceHeading:'Keep the editable chain', provenanceCopy:'A preview helps inspection. It does not replace the native source or its object index.',
      native:'Immutable native package', master:'Editable master', derived:'Derived build', slide:'Slide', objectIndex:'Object index', manifest:'Provenance manifest',
      partial:'Partial example index. It does not claim lossless reconstruction.',
      sourceNote:'The source SVG and editable master remain separate files. The manifest records their exact digests.',
      sourceContract:'Real imports retain the immutable native package and its hash. Extracted text or layout files alone are not a complete object graph.',
      controlsOptional:'This evidence example needs no playback controls.',
    },
    cs: {
      home:'Ukázky šablon', model:'Model a hodnoty', evidence:'Podklad a vysvětlení', iterations:'Porovnání verzí', provenance:'Zdroj a původ',
      intro:'Jedna úplná kompozice. Volitelné zkoumání. Zachované zdroje.',
      indexNote:'Ukázky používají malé ilustrační SVG. Neobsahují pozorovaná měření ani fyzikální simulace.',
      language:'Jazyk', play:'Přehrát', pause:'Pozastavit', amplitude:'Amplituda', time:'Uplynulý čas',
      sources:'Zdroje', close:'Zavřít', fullscreen:'Celá obrazovka', exitFullscreen:'Ukončit celou obrazovku', unavailable:'Celá obrazovka není dostupná. Běžné zobrazení zůstává použitelné.',
      version:'Verze', current:'Současná verze', earlier:'Dřívější verze',
      modelHeading:'Sledujte jeden pohybující se bod', modelCopy:'Měňte amplitudu za pohybu bodu. Pohyb zastaví až volba Pozastavit.',
      currentCaption:'Kruhové schéma', earlierCaption:'Vodorovný průmět', sampleLimit:'Ilustrační model. Jednotky a pohyb jsou zvoleny pro tuto ukázku.',
      evidenceHeading:'Dejte prostor podkladu', evidenceCopy:'Zachovejte celý zdrojový obraz vedle stručného vysvětlení. Podrobný záznam patří do Zdrojů.',
      evidenceLimit:'Křivka je ilustrační. Nejde o měřenou časovou řadu.',
      provenanceHeading:'Zachovejte řetězec upravitelných podkladů', provenanceCopy:'Náhled pomáhá při kontrole. Nenahrazuje nativní zdroj ani jeho index objektů.',
      native:'Neměnný nativní balíček', master:'Upravitelný originál', derived:'Odvozený výstup', slide:'Snímek', objectIndex:'Index objektů', manifest:'Manifest původu',
      partial:'Částečný ukázkový index. Netvrdí bezeztrátovou rekonstrukci.',
      sourceNote:'Zdrojové SVG a upravitelný originál zůstávají samostatné soubory. Manifest zaznamenává jejich přesné otisky.',
      sourceContract:'Skutečný import zachová neměnný nativní balíček a jeho otisk. Samotný text nebo rozložení netvoří úplný graf objektů.',
      controlsOptional:'Tato ukázka podkladu nepotřebuje ovládání přehrávání.',
    },
  };
  // The shared runtime fills [data-i18n] text, sets <html lang>, and formats numbers for the language.
  const copy = LanguageCopy.bind({copy:words, languages:['en', 'cs'], fallback:'en', attributes:{text:'data-i18n'}, remember:'query'});
  const t = copy.t, format = copy.format;
  function translate() {
    const lang = copy.language;
    document.title = t(({index:'home', model:'model', evidence:'evidence', iterations:'iterations', provenance:'provenance'})[example]);
    $('language').value = lang;
    document.querySelector('.host-chrome nav').setAttribute('aria-label', t('home'));
    document.querySelector('.presentation')?.setAttribute('aria-label', document.title);
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname.endsWith('.html')) { url.searchParams.set('lang', lang); link.href = url; }
    });
  }
  function modelNode(selected) {
    const node = document.createElement('section');
    node.className = 'fixed-stage template-unit active'; node.id = `model-${copy.language}-${selected}`;
    node.dataset.version = selected;
    node.innerHTML = `<svg viewBox="0 0 1200 800" role="img" aria-labelledby="diagram-title"><title id="diagram-title">${t(selected === 'current' ? 'currentCaption' : 'earlierCaption')}</title>
      <path d="M130 400H1070M600 100V700" stroke="var(--line)" stroke-width="3"/>
      ${selected === 'current' ? '<circle id="model-orbit" cx="600" cy="400" r="240" fill="none" stroke="var(--cyan)" stroke-width="5" stroke-dasharray="12 12"/>' : '<path d="M240 400H960" stroke="var(--cyan)" stroke-width="8"/>'}
      <line id="radius" x1="600" y1="400" x2="840" y2="400" stroke="var(--cyan)" stroke-width="5"/>
      <circle id="model-point" cx="840" cy="400" r="22" fill="var(--gold)"/>
      <text x="600" y="770" text-anchor="middle" font-size="32" fill="var(--mut)">${t(selected === 'current' ? 'currentCaption' : 'earlierCaption')}</text></svg>
      <div><h2>${t('modelHeading')}</h2><p>${t('modelCopy')}</p><dl class="readout"><div><dt>${t('amplitude')}</dt><dd id="amplitude-readout"></dd></div><div><dt>${t('time')}</dt><dd id="time-readout"></dd></div></dl><p class="quiet">${t('sampleLimit')}</p></div>`;
    return node;
  }
  function fit() {
    const host = $('stage-host'), stage = host?.firstElementChild;
    if (!stage) return;
    const box = SlideFrameFit.geometry(host.clientWidth, host.clientHeight);
    Object.assign(stage.style, {left:box.left+'px', top:box.top+'px', transform:`scale(${box.scale})`});
  }
  function draw(state, playing, paused) {
    const r = 240 * state.value, angle = state.time;
    const x = 600 + (version === 'earlier' ? Math.sin(angle) : Math.cos(angle)) * r;
    const y = version === 'earlier' ? 400 : 400 - Math.sin(angle) * r;
    $('model-point').setAttribute('cx', x); $('model-point').setAttribute('cy', y);
    $('model-orbit')?.setAttribute('r', r);
    $('radius').setAttribute('x2', x); $('radius').setAttribute('y2', y);
    $('amplitude-readout').textContent = format(state.value) + ' cm';
    $('time-readout').textContent = format(state.time) + ' s';
    $('amplitude').value = state.value; $('amplitude-value').textContent = format(state.value);
    $('play').textContent = t(paused ? 'play' : 'pause'); $('play').setAttribute('aria-pressed', String(!paused));
    Object.assign(document.body.dataset, {time:String(state.time), value:String(state.value), playing:String(playing), version});
  }
  function mount() {
    if (player) { saved = player.snapshot(); player.destroy(); }
    if (fullscreen) fullscreen.destroy();
    if (example === 'evidence' || example === 'provenance') {
      $('stage-host').firstElementChild.id = `${example}-example-${copy.language}`;
    }
    translate();
    if (example === 'model' || example === 'iterations') {
      PresentationView.showVersion($('stage-host'), version, {current:() => modelNode('current'), earlier:() => modelNode('earlier')});
      player = ModelPlayback.attach({key:'html-tools:template-model:v1:'+location.pathname, snapshot:saved, min:.2, max:1.25, value:1, onFrame:draw});
      if ($('sources-dialog').open) player.setBlocked(true);
    }
    if ($('fullscreen')) fullscreen = PresentationView.fullscreen($('fullscreen'), {status:$('status'), labels:{enter:t('fullscreen'), exit:t('exitFullscreen'), unavailable:t('unavailable')}});
    fit(); document.body.dataset.ready = 'true';
  }
  window.HTML_ANNOTATE = {unit:'.template-unit', active:'.template-unit.active', goTo:() => { document.querySelector('.template-unit.active')?.scrollIntoView({block:'nearest'}); }};
  $('language').addEventListener('change', () => {
    const annotator = example === 'evidence' || example === 'provenance' ? window.SlideAnnotate : null;
    const annotating = document.body.classList.contains('annot-on');
    const editing = document.body.classList.contains('annot-edit');
    if (annotator) annotator.on(false);
    try {
      copy.set($('language').value); mount();
    } finally {
      if (annotator) { annotator.on(annotating); if (annotating && editing) annotator.edit(true); }
    }
  });
  if ($('version')) {
    $('version').value = version;
    $('version').addEventListener('change', () => { version = $('version').value; const url = new URL(location.href); url.searchParams.set('version', version); history.replaceState(null, '', url); mount(); });
  }
  $('play')?.addEventListener('click', () => player.toggle());
  $('amplitude')?.addEventListener('input', event => player.setValue(Number(event.target.value)));
  $('sources')?.addEventListener('click', () => { $('sources-dialog').showModal(); player?.setBlocked(true); });
  $('close-sources')?.addEventListener('click', () => $('sources-dialog').close());
  $('sources-dialog')?.addEventListener('close', () => { player?.setBlocked(false); $('sources').focus(); });
  if ($('stage-host')) { observer = new ResizeObserver(fit); observer.observe($('stage-host')); }
  window.addEventListener('resize', fit);
  window.TemplateDemo = {getState:() => player?.snapshot(), get playing() { return player?.playing; }};
  mount();
})();
