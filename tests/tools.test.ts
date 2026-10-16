import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Bundler } from "../htmltools/bundle.ts";
import { exportInto } from "../htmltools/export.ts";
import { extract } from "../htmltools/prose.ts";

let root = "";
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "htmltools-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function write(name: string, text: string): string {
  const target = join(root, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  return target;
}
const decode = (uri: string) => Buffer.from(uri.split(",", 2)[1], "base64").toString("utf8");

test("bundle inlines css, keeps fragments and external links, adds the bridge", () => {
  const source = write("talk.html", '<link href="style.css"><iframe src="child.html#scene"></iframe><a href="https://example.com">Web</a>');
  write("child.html", "<body><button>Action</button></body>");
  write("style.css", 'body{background:url("dot.svg")}');
  write("dot.svg", "<svg/>");
  const text = decode(new Bundler(root).bundle(source));
  expect(text).toContain("#scene");
  expect(text).toContain("https://example.com");
  expect(text).not.toContain('href="style.css"');
  expect(text).toContain("slidekit:focus-parent");
});

test("bundle refuses cycles and assets outside the root", () => {
  const a = write("a.html", '<iframe src="b.html"></iframe>');
  write("b.html", '<iframe src="a.html"></iframe>');
  expect(() => new Bundler(root).bundle(a)).toThrow(/Circular/);
  const p = write("public/a.html", '<img src="../private.txt">');
  write("private.txt", "do not bundle");
  expect(() => new Bundler(join(root, "public")).bundle(p)).toThrow(/outside/);
});

test("bundle rewrites inline css and refuses srcset and module scripts", () => {
  const p = write("talk.html", '<body style="background:url(dot.svg)"></body>');
  write("dot.svg", "<svg/>");
  expect(decode(new Bundler(root).bundle(p))).toContain("data:image/svg+xml");
  for (const markup of ['<script type="module" src="app.js"></script>', '<img srcset="one.png 1x, two.png 2x">']) {
    const q = write("bad.html", markup);
    expect(() => new Bundler(root).bundle(q)).toThrow();
  }
});

test("bundle turns a local page link into a preview and leaves the others", () => {
  const p = write("talk.html", '<a href="report.html" target="_blank">Report</a><a href="https://example.com/x.html">Web</a><a data-modal="shot.png" href="shot.png">Shot</a>');
  write("report.html", "<p>r</p>");
  write("shot.png", "png");
  const text = decode(new Bundler(root).bundle(p));
  expect(text).toContain('data-modal="data:text/html;base64,');
  expect(text).toContain('data-modal-kind="iframe" href="#preview"');
  expect(text).toContain('href="https://example.com/x.html"');
  expect(text.split('href="#preview"').length - 1).toBe(2);
});

test("export writes a manifest, refuses local edits and unmanaged collisions, scopes folders", () => {
  write("source/runtime/annotate.js", "one");
  write("source/htmltools/export.ts", "");
  const source = join(root, "source"), dest = join(root, "dest");
  const first = exportInto(source, dest);
  expect(exportInto(source, dest)).toEqual(first);
  writeFileSync(join(dest, "runtime/annotate.js"), "local edit");
  write("source/runtime/new.js", "two");
  expect(() => exportInto(source, dest)).toThrow(/changed locally/);
  expect(JSON.parse(readFileSync(join(dest, "manifest.json"), "utf8"))).toEqual(first);
  write("other/runtime/annotate.js", "new");
  write("dest2/runtime/annotate.js", "existing");
  expect(() => exportInto(join(root, "other"), join(root, "dest2"))).toThrow(/Unmanaged/);
  write("scoped/runtime/deck.js", "deck");
  write("scoped/slidekit/parity.ts", "parity");
  write("scoped/htmltools/export.ts", "not this one");
  const result = exportInto(join(root, "scoped"), join(root, "dest3"), ["runtime", "slidekit"]);
  expect(Object.keys(result.files).sort()).toEqual(["runtime/deck.js", "slidekit/parity.ts"]);
});

test("export refuses a manifest that lost a source file", () => {
  write("src/runtime/a.js", "a");
  write("src/runtime/b.js", "b");
  exportInto(join(root, "src"), join(root, "out"));
  unlinkSync(join(root, "src/runtime/b.js"));
  expect(() => exportInto(join(root, "src"), join(root, "out"))).toThrow(/removed/);
});

test("prose extracts blocks per section, keeps svg labels, skips code, scripts and kickers", () => {
  const text = extract('<section id="a"><p class="kicker rise">Part I — See it work</p><h2>Title &amp; more</h2><p>Body <b>bold</b>.</p><pre>code here</pre>'
    + '<svg><text>label</text></svg><script>var x = 1;</script></section><section id="b"><li>x</li><li>Second</li></section>', "t.html");
  expect(text.split("\n")).toEqual(["# t.html", "", "## 1 a", "", "Title & more  ", "Body bold.  ", "label  ", "", "## 2 b", "", "Second  ", ""]);
});
