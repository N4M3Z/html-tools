const test = require('node:test');
const assert = require('node:assert/strict');
const {showVersion, fullscreen} = require('../runtime/presentation-view.js');

test('iteration switches mount only the selected version and never retain both', () => {
  const calls = {current:0,earlier:0};
  const slot = {dataset:{},children:[],replaceChildren(node) { this.children = [node]; }};
  const factories = Object.fromEntries(Object.keys(calls).map(id => [id, () => { calls[id]++; return {id}; }]));
  for (const id of ['current','earlier','current','earlier']) {
    assert.equal(showVersion(slot,id,factories), id);
    assert.deepEqual(slot.children, [{id}]);
  }
  assert.deepEqual(calls,{current:2,earlier:2});
  assert.equal(showVersion(slot,'__proto__',factories),'current');
  assert.equal(slot.children.length,1);
  assert.throws(() => showVersion(slot,'current',{}), /required/);
});

function element() {
  const listeners = new Map();
  return {attributes:{},isConnected:true,focused:false,
    addEventListener(type,fn) { listeners.set(type,fn); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type) { return listeners.get(type)?.(); },
    setAttribute(key,value) { this.attributes[key] = value; },
    toggleAttribute(key,on) { if(on)this.attributes[key]='';else delete this.attributes[key]; },
    focus() { this.focused = true; },
    listeners,
  };
}

test('fullscreen follows native state and restores focus after native Escape', async () => {
  const doc = element(), target = element(), button = element();
  doc.documentElement = target; doc.fullscreenElement = null; button.ownerDocument = doc;
  target.requestFullscreen = async () => { doc.fullscreenElement = target; doc.emit('fullscreenchange'); };
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.emit('fullscreenchange'); };
  const view = fullscreen(button);
  await button.emit('click');
  assert.equal(button.attributes['aria-pressed'],'true');
  assert.ok('data-presentation-fullscreen' in target.attributes);
  await doc.exitFullscreen();
  assert.equal(button.attributes['aria-pressed'],'false'); assert.equal(button.focused,true);
  assert.equal('data-presentation-fullscreen' in target.attributes,false);
  view.destroy(); assert.equal(doc.listeners.size,0); assert.equal(button.listeners.size,0);
});

test('rejected fullscreen leaves chrome visible and reports the failure', async () => {
  const doc = element(), target = element(), button = element(), status = {};
  doc.documentElement=target; doc.fullscreenElement=null; button.ownerDocument=doc;
  target.requestFullscreen=async () => { throw Error('Denied by browser'); };
  const view = fullscreen(button,{status,labels:{unavailable:'Not available'}});
  await button.emit('click');
  assert.equal(status.textContent,'Not available');
  assert.equal('data-presentation-fullscreen' in target.attributes,false);
  view.destroy();
});
