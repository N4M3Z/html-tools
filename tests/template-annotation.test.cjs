const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {geometry} = require('../runtime/frame-fit.js');

function staticPage(example, initial = 'en', annotating = true, editing = false) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'templates', example + '.html'), 'utf8');
  const id = html.match(new RegExp(`id="(${example}-example-[^"]+)"`))?.[1];
  assert.equal(id, example + '-example-en', 'HTML must declare the default language before scripts run');
  const unit = {id, tagName:'SECTION', style:{}, children:[], matches:selector => selector.startsWith('.template-unit')};
  const figure = {id:'', tagName:'FIGURE', parentNode:unit, children:[], matches:() => false};
  const image = {id:'', tagName:'IMG', parentNode:figure, matches:() => false,
    getAttribute:name => name === 'alt' ? 'Preview / Náhled' : null};
  unit.children.push(figure); figure.children.push(image);
  const handlers = new Map(), language = {value:initial, addEventListener:(type,fn) => handlers.set(type,fn)};
  const host = {firstElementChild:unit, clientWidth:1920, clientHeight:1080};
  const classes = new Set(annotating ? ['annot-on'] : []); if (editing) classes.add('annot-edit');
  const document = {title:'', documentElement:{lang:'en'}, body:{dataset:{example},classList:{contains:name => classes.has(name)}},
    getElementById:id => id === 'language' ? language : id === 'stage-host' ? host : null,
    querySelectorAll:() => [], querySelector:selector => selector === '.template-unit.active' ? unit : {setAttribute() {}},
  };
  const location = {href:`https://example.test/templates/${example}.html?lang=${initial}`,search:`?lang=${initial}`,pathname:`/templates/${example}.html`,origin:'https://example.test'};
  const calls = [];
  const annotator = {
    on(value) {
      calls.push({method:'on',value,id:unit.id,lang:document.documentElement.lang});
      if (value) classes.add('annot-on'); else { classes.delete('annot-on'); classes.delete('annot-edit'); }
    },
    edit(value) { calls.push({method:'edit',value,id:unit.id}); if (value) classes.add('annot-edit'); },
  };
  const window = {SlideAnnotate:annotator, addEventListener() {}};
  const context = {document,window,location,URL,URLSearchParams,SlideFrameFit:{geometry},
    history:{replaceState(_state,_title,url) { const next = new URL(url); location.href=next.href; location.search=next.search; }},
    ResizeObserver:class { observe() {} },
  };
  // The demo reads its copy through the shared language runtime, loaded first as the pages load it.
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../runtime/language-copy.js'), 'utf8'),context);
  context.LanguageCopy = window.LanguageCopy;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../templates/demo.js'), 'utf8'),context);
  const annotationModule = {exports:{}};
  // Use the canonical address and copy functions. Do not reproduce their formatting in this test.
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../runtime/annotate.js'), 'utf8'),
    {window,location,module:annotationModule});
  const canonical = annotationModule.exports;
  return {unit,calls,classes,window,document,
    change(lang) { language.value=lang; handlers.get('change')(); },
    address() { return canonical.targetAddress({el:image}); },
    copy(address) { return canonical.formatTuicr([{...address,kind:'note',text:'Check this figure',ts:'1'}]); },
  };
}

for (const example of ['evidence','provenance']) {
  test(`${example} EN and CS annotations remain distinct through a real demo language remount`, () => {
    const page=staticPage(example,'en',true,true), api=page.window.SlideAnnotate;
    const english=page.address(), englishCopy=page.copy(english);
    assert.equal(english.slide,example+'-example-en');
    page.change('cs');
    const czech=page.address(), czechCopy=page.copy(czech);
    assert.equal(czech.slide,example+'-example-cs');
    assert.equal(czech.path,english.path);
    assert.notEqual(czechCopy,englishCopy);
    assert.match(czechCopy,new RegExp('#'+example+'-example-cs › figure › img'));
    assert.equal(english.slide,example+'-example-en','captured EN addresses must retain their original context');
    assert.deepEqual(page.calls,[
      {method:'on',value:false,id:example+'-example-en',lang:'en'},
      {method:'on',value:true,id:example+'-example-cs',lang:'cs'},
      {method:'edit',value:true,id:example+'-example-cs'},
    ]);
    assert.equal(page.classes.has('annot-on'),true); assert.equal(page.classes.has('annot-edit'),true);
    assert.equal(page.window.SlideAnnotate,api,'the canonical instance must not be replaced');
    page.change('en'); assert.equal(page.address().slide,english.slide);
    assert.equal(page.copy(page.address()),englishCopy);
  });

  test(`${example} applies an initial CS context before annotation capture and keeps disabled annotation off`, () => {
    const page=staticPage(example,'cs',false);
    assert.equal(page.address().slide,example+'-example-cs');
    assert.equal(page.document.body.dataset.ready,'true');
    assert.equal(page.calls.length,0);
    page.change('en');
    assert.equal(page.address().slide,example+'-example-en');
    assert.equal(page.classes.has('annot-on'),false);
    assert.deepEqual(page.calls.map(call => call.value),[false,false]);
  });
}
