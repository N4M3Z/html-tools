const test = require('node:test');
const assert = require('node:assert/strict');
const {geometry, attach} = require('../runtime/frame-fit.js');

test('wide, short, and portrait windows contain the full canvas', () => {
  for (const [width,height] of [[1920,1000],[1280,620],[1024,668],[390,650]]) {
    const box = geometry(width,height);
    assert.equal(box.width / box.height, 16 / 9);
    assert.ok(box.left >= 0 && box.top >= 0);
    assert.ok(box.left + box.width * box.scale <= width + 1e-8);
    assert.ok(box.top + box.height * box.scale <= height + 1e-8);
  }
});
test('hidden or invalid containers never create invalid transforms', () => {
  for (const [width,height] of [[0,0],[-1,1080],[NaN,undefined]]) {
    for (const value of Object.values(geometry(width,height))) assert.ok(Number.isFinite(value));
  }
});
test('window mode uses all available space', () => {
  assert.deepEqual(geometry(1280,620,false),{width:1280,height:620,scale:1,left:0,top:0});
});
test('mode changes and resize preserve loaded frame and clean up listeners', () => {
  let observed, disconnected=false, resize, click;
  global.ResizeObserver = class {
    constructor(fn){resize=fn;}
    observe(node){observed=node;}
    disconnect(){disconnected=true;}
  };
  const frame={style:{}, src:'unchanged.html', contentWindow:{demoState:3}};
  const host={clientWidth:1280,clientHeight:620};
  const button={setAttribute(){},addEventListener(type,fn){click=fn;},
    removeEventListener(type,fn){assert.equal(fn,click);click=null;}};
  const control=attach(frame,host,button);
  assert.equal(observed,host); assert.equal(frame.style.width,'1920px');
  click(); assert.equal(frame.style.width,'1280px');
  click(); host.clientHeight=450; resize();
  assert.equal(frame.style.transform,'scale(0.4166666666666667)');
  assert.equal(frame.src,'unchanged.html'); assert.equal(frame.contentWindow.demoState,3);
  control.destroy(); assert.ok(disconnected); assert.equal(click,null);
  delete global.ResizeObserver;
});
