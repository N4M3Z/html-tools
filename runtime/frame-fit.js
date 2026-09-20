(function (root) {
  'use strict';
  function geometry(width, height, fitted = true) {
    width = Math.max(0, Number.isFinite(width) ? width : 0);
    height = Math.max(0, Number.isFinite(height) ? height : 0);
    const scale = fitted ? Math.min(width / 1920, height / 1080) : 1;
    return {width: fitted ? 1920 : width, height: fitted ? 1080 : height, scale,
      left: fitted ? (width - 1920 * scale) / 2 : 0,
      top: fitted ? (height - 1080 * scale) / 2 : 0};
  }
  function attach(frame, host, button) {
    let fitted = true;
    function update() {
      const box = geometry(host.clientWidth, host.clientHeight, fitted);
      Object.assign(frame.style, {position:'absolute', width:box.width+'px', height:box.height+'px',
        left:box.left+'px', top:box.top+'px', transform:`scale(${box.scale})`, transformOrigin:'0 0', border:'0'});
      button.textContent = fitted ? 'Fit slide: on' : 'Fit slide: off';
      button.setAttribute('aria-pressed', String(fitted));
      button.title = fitted ? 'Switch to window size' : 'Fit the complete 1920 × 1080 slide';
    }
    function toggle() { fitted = !fitted; update(); }
    button.addEventListener('click', toggle);
    const observer = new ResizeObserver(update);
    observer.observe(host);
    update();
    return {update, destroy() { observer.disconnect(); button.removeEventListener('click', toggle); }};
  }
  root.SlideFrameFit = {geometry, attach};
  if (typeof module !== 'undefined' && module.exports) module.exports = {geometry, attach};
})(typeof window !== 'undefined' ? window : globalThis);
