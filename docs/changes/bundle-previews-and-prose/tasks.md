## 0. TypeScript

- [x] 0.1 `bundle.ts`, `export.ts`, `prose.ts`, `cli.ts`, ported one for one
- [x] 0.2 `tests/tools.test.ts` under `bun test`, the Python removed, the pre-commit hook on `bun test`

## 1. Bundler

- [x] 1.1 `Bundler.localPage` and the `<a href>` rewrite to `data-modal`
- [x] 1.2 Test: a local page link becomes a preview, an external link and a `data-modal` link stay

## 2. Prose

- [x] 2.1 `htmltools/prose.ts`: `extract(text, title)`, blocks per section, code and scripts dropped
- [x] 2.2 The `prose` command in `cli.ts`
- [x] 2.3 Test: blocks, escaping, punctuation after inline markup, SVG labels

## 3. Documentation

- [x] 3.1 README: `Extract prose`, the bundler note, the consumer renamed to html-slides
- [x] 3.2 AGENTS: architecture lines

## 4. Consumers

- [x] 4.1 Re-export into html-slides
