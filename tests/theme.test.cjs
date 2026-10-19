const test = require('node:test');
const assert = require('node:assert/strict');
const theme = require('../runtime/theme.js');
const contrast = require('../runtime/contrast.js');

// The colour variables talk.css declares on :root. Every theme and every high-contrast set carries all of them.
const DECLARED = ['color-scheme', '--void', '--bg1', '--panel', '--line', '--ink', '--mut', '--faint',
  '--cyan', '--cyan-soft', '--gold', '--gold-soft', '--red', '--green', '--green-soft'];
const TEXT = ['--ink', '--mut', '--faint', '--cyan', '--gold', '--red', '--green'];
const byName = (name) => theme.THEMES.find((t) => t.name === name);

function luminance(hex) {
  const [r, g, b] = theme.parse(hex).slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('night comes first, then day and dusk, and every set declares every variable', () => {
  assert.deepEqual(theme.THEMES.map((t) => t.name), ['night', 'day', 'dusk']);
  for (const t of theme.THEMES) {
    for (const name of DECLARED) assert.ok(t.vars[name], `${t.name} lacks ${name}`);
    if (t.hc) for (const name of DECLARED) assert.ok(t.hc.vars[name], `${t.name} high contrast lacks ${name}`);
  }
  assert.equal(byName('day').vars['color-scheme'], 'light');
  assert.equal(byName('dusk').vars['color-scheme'], 'dark');
});

test('every text role passes WCAG AA on its ground, and day high contrast passes AAA', () => {
  for (const t of theme.THEMES.filter((x) => x.name !== 'night')) {
    for (const role of TEXT) assert.ok(ratio(t.vars[role], t.vars['--void']) >= 4.5, `${t.name} ${role}`);
  }
  const hc = byName('day').hc.vars;
  for (const role of TEXT) assert.ok(ratio(hc[role], hc['--void']) >= 7, `day high contrast ${role}`);
});

test('a literal of the night palette repaints as its variable at its own alpha, brand colours stay', () => {
  const night = byName('night').vars;
  assert.equal(theme.paint('#D7E1F0', night), 'var(--ink)');
  assert.equal(theme.paint('#d7e1f0', night), 'var(--ink)');
  assert.equal(theme.paint('#5C6A85', night), 'var(--faint)');
  assert.equal(theme.paint('rgba(139,153,181,0.3)', night), 'color-mix(in srgb, var(--mut) 30%, transparent)');
  assert.equal(theme.paint('rgba(215, 225, 240, 0.05)', night), 'color-mix(in srgb, var(--ink) 5%, transparent)');
  for (const other of ['#D97757', '#3186FF', 'none', 'currentColor', 'url(#pg1)', '']) assert.equal(theme.paint(other, night), null);
});

test('a theme yields its variables to high contrast, and keeps its repaint only with a set of its own', () => {
  const pairs = [['fill', '#D7E1F0'], ['stroke', 'rgba(139,153,181,0.3)'], ['fill', '#D97757']];
  const day = theme.deckCss(byName('day'), pairs);
  assert.ok(day.startsWith('html[data-theme="day"]:not(.hc){color-scheme:light;--void:#F7F9FC;'));
  assert.ok(day.includes(':where(html[data-theme="day"] [fill="#D7E1F0" i]){fill:var(--ink)}'));
  assert.ok(day.includes('{stroke:color-mix(in srgb, var(--mut) 30%, transparent)}'));
  assert.ok(!day.includes('D97757'));
  const dusk = theme.deckCss(byName('dusk'), pairs);
  assert.ok(dusk.includes(':where(html[data-theme="dusk"]:not(.hc) [fill="#D7E1F0" i])'));
  assert.ok(theme.frameCss(byName('day'), pairs).startsWith(':root:not(.hc){color-scheme:light;'));
  assert.ok(theme.frameCss(byName('day'), pairs).includes(':where([fill="#D7E1F0" i]){fill:var(--ink)}'));
  assert.ok(theme.frameCss(byName('dusk'), pairs).includes(':where(:root:not(.hc) [fill="#D7E1F0" i])'));
});

test('a saved or asked theme applies, anything else falls back to night', () => {
  assert.equal(theme.pick(null, ''), 'night');
  assert.equal(theme.pick('day', ''), 'day');
  assert.equal(theme.pick('sepia', ''), 'night');
  assert.equal(theme.pick('day', '?theme=dusk'), 'dusk');
  assert.equal(theme.pick('day', '?annotate=1&theme=DUSK'), 'dusk');
  assert.equal(theme.pick('day', '?theme=sepia'), 'day');
  assert.deepEqual(['night', 'day', 'dusk'].map(theme.next), ['day', 'dusk', 'night']);
});

test('high contrast keeps the black set without a theme, byte for byte', () => {
  const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex');
  const black = contrast.palette(null);
  assert.equal(sha(contrast.deckCss(black)), '377ae948c9434659691c08fc48113c0e7ec2fd2d726c1301f11f4376cd2b52ee');
  assert.equal(sha(contrast.frameCss(black)), '492f6602340240676e87d27c35b99204b86f6c0de86e56810945abcd24f3f6a8');
  assert.equal(theme.contrastSet(byName('night')), null);
  assert.equal(theme.contrastSet(byName('dusk')), null);
});

test('on day, high contrast turns white with black ink and leaves the repaint to the theme', () => {
  const set = contrast.palette(theme.contrastSet(byName('day')));
  const css = contrast.deckCss(set);
  assert.ok(css.startsWith('html.hc{color-scheme:light;--void:#fff;--bg1:#fff;'));
  assert.ok(css.includes('--ink:#000;'));
  assert.ok(css.includes('html.hc body{background:#fff}'));
  assert.ok(!css.includes('[fill='));
  assert.ok(contrast.frameCss(set).startsWith(':root{color-scheme:light;'));
});
