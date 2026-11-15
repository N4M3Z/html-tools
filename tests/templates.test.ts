import { afterEach, beforeEach, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { digest, exportInto } from "../htmltools/export.ts";
import { refreshManifest } from "../templates/hash-manifest.ts";

const repository = resolve(import.meta.dir, "..");
let temporary = "";
beforeEach(() => { temporary = mkdtempSync(join(tmpdir(), "html-tools-templates-")); });
afterEach(() => { rmSync(temporary, {recursive:true, force:true}); });
const read = (name: string) => readFileSync(join(repository, name), "utf8");

test("the existing Bun CLI exports every example and its canonical runtime dependencies", () => {
  const destination = join(temporary, "vendor");
  const result = Bun.spawnSync([process.execPath, join(repository, "htmltools/cli.ts"), "export", destination]);
  expect(result.exitCode).toBe(0);
  const manifest = JSON.parse(readFileSync(join(destination, "manifest.json"), "utf8"));
  for (const name of ["index.html", "model-readout.html", "evidence.html", "iterations.html", "provenance.html", "templates.css", "demo.js", "source.svg", "editable-master.svg", "derived-build.svg", "preview.svg", "object-index.json", "manifest.json", "README.md", "hash-manifest.ts"]) {
    expect(manifest.files["templates/" + name]).toBe(digest(readFileSync(join(destination, "templates", name))));
  }
  for (const name of ["annotate.js", "frame-fit.js", "frame-steps.js", "language-copy.js", "model-playback.js", "presentation-view.js"]) {
    expect(manifest.files["runtime/" + name]).toBe(digest(readFileSync(join(destination, "runtime", name))));
  }
  for (const name of Object.keys(manifest.files).filter(name => name.endsWith(".html"))) {
    const page = join(destination, name), html = readFileSync(page, "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const target = resolve(dirname(page), match[1].split(/[?#]/)[0]);
      expect(target.startsWith(destination + sep)).toBe(true);
      expect(existsSync(target)).toBe(true);
    }
    if (!html.includes('src="demo.js"')) continue;
    expect(html.indexOf('src="../runtime/language-copy.js"')).toBeLessThan(html.indexOf('src="demo.js"'));
    expect(html.indexOf('src="demo.js"')).toBeLessThan(html.indexOf('src="../runtime/annotate.js"'));
  }
});

test("a modified consumer template stops CLI export without replacing files or its manifest", () => {
  const destination = join(temporary, "consumer");
  exportInto(repository, destination);
  const manifest = readFileSync(join(destination, "manifest.json"), "utf8");
  const helper = readFileSync(join(destination, "runtime/model-playback.js"), "utf8");
  writeFileSync(join(destination, "templates/model-readout.html"), "consumer edit");
  const result = Bun.spawnSync([process.execPath, join(repository, "htmltools/cli.ts"), "export", destination]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("Export changed locally: templates/model-readout.html");
  expect(readFileSync(join(destination, "templates/model-readout.html"), "utf8")).toBe("consumer edit");
  expect(readFileSync(join(destination, "runtime/model-playback.js"), "utf8")).toBe(helper);
  expect(readFileSync(join(destination, "manifest.json"), "utf8")).toBe(manifest);
});

test("an unmanaged template collision stops before the first runtime file is written", () => {
  const destination = join(temporary, "consumer");
  mkdirSync(join(destination, "templates"), {recursive:true});
  writeFileSync(join(destination, "templates/evidence.html"), "existing page");
  expect(() => exportInto(repository, destination)).toThrow(/Unmanaged file exists: templates\/evidence.html/);
  expect(existsSync(join(destination, "runtime/annotate.js"))).toBe(false);
  expect(existsSync(join(destination, "manifest.json"))).toBe(false);
  expect(readFileSync(join(destination, "templates/evidence.html"), "utf8")).toBe("existing page");
});

test("caller-supplied folder and suffix scope still excludes templates", () => {
  const manifest = exportInto(repository, join(temporary, "scoped"), ["runtime"], [".js"]);
  expect(Object.keys(manifest.files).every(name => name.startsWith("runtime/") && name.endsWith(".js"))).toBe(true);
  expect(existsSync(join(temporary, "scoped/templates"))).toBe(false);
});

test("the provenance chain binds real bytes and discloses its partial object coverage", () => {
  const manifest = JSON.parse(read("templates/manifest.json"));
  expect(manifest.nativePackage.immutable).toBe(true);
  expect(manifest.preview.isPreservationSource).toBe(false);
  expect(manifest.preview.role).toBe("preview-only");
  expect(manifest.objectIndex.fullLosslessObjectGraph).toBe(false);
  expect(manifest.retention.presentationImporterImplemented).toBe(false);
  for (const key of ["nativePackage", "objectIndex", "editableMaster", "derivedBuild", "slide", "preview"]) {
    expect(manifest[key].sha256).toBe(digest(readFileSync(join(repository, "templates", manifest[key].path))));
  }
  expect(manifest.slide.consumes).toEqual(["derivedBuild"]);
  const index = JSON.parse(read("templates/object-index.json"));
  expect(index.nativePackage.sha256).toBe(manifest.nativePackage.sha256);
  expect(index.coverage.fullLosslessObjectGraph).toBe(false);
  const source = read("templates/source.svg");
  for (const object of index.slides[0].objects) {
    expect(source).toContain(`id="${object.id}"`);
    expect(object.transform.units).toBe("svg-user-units");
    expect(object.transform.matrix).toHaveLength(6);
    expect(object.rawPartRefs.length).toBeGreaterThan(0);
    expect(Array.isArray(object.textRuns)).toBe(true);
    expect(Array.isArray(object.mediaRefs)).toBe(true);
  }
});

test("provenance refresh updates derived hashes but refuses a changed native package", () => {
  const source = join(temporary, "templates");
  cpSync(join(repository, "templates"), source, {recursive:true});
  writeFileSync(join(source, "derived-build.svg"), "new derived artifact");
  refreshManifest(source);
  let manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));
  expect(manifest.derivedBuild.sha256).toBe(digest("new derived artifact"));
  const prior = readFileSync(join(source, "manifest.json"), "utf8");
  writeFileSync(join(source, "source.svg"), "changed original");
  expect(() => refreshManifest(source)).toThrow(/Native package changed/);
  expect(readFileSync(join(source, "manifest.json"), "utf8")).toBe(prior);
  manifest.objectIndex.path = "../outside.json";
  writeFileSync(join(source, "source.svg"), read("templates/source.svg"));
  writeFileSync(join(source, "manifest.json"), JSON.stringify(manifest));
  expect(() => refreshManifest(source)).toThrow(/Invalid provenance path/);
});

test("templates use the shared visual tokens and do not carry annotation or personal data copies", () => {
  const css = read("templates/templates.css"), js = read("templates/demo.js");
  for (const token of ["--void:#080d16", "--surface:#111a2c", "--ink:#dbe5f7", "--mut:#99aac6", "--gold:#f5c769", "--cyan:#55d2e5"]) expect(css).toContain(token);
  expect(js).toContain('stroke="var(--cyan)"');
  expect(js).toContain('fill="var(--gold)"');
  expect(js).not.toContain("formatTuicr");
  expect(js).not.toContain("slides.annotations:");
  expect(js).not.toContain("/Users/");
  expect(js).not.toContain("private/");
  expect(css).not.toContain("Georgia");
  expect(css).toContain(".host-chrome{display:none}");
});
