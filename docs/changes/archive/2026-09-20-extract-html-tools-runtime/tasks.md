## 1. Repository

- [x] 1.1 Create the colocated jj repository with `runtime/`, `htmltools/`, `tests/`, `openspec/`, README,
  AGENTS, LICENSE, and a pre-commit config that runs the tests.
- [x] 1.2 Move `annotate.js`, `contrast.js`, and `frame-fit.js`. Verify each file by reading it for deck
  coupling and record the borderline decisions in design.md.
- [x] 1.3 Move `bundle.py` and `export.py` as `htmltools`. Add the `export` and `bundle` commands.

## 2. Generalisation

- [x] 2.1 Read the unit selectors and navigation of `annotate.js` from `window.HTML_ANNOTATE` with the deck
  shape as the default. Verify the node tests and the syntax check pass.
- [x] 2.2 Take the export folder list as a parameter. Test a consumer folder list.

## 3. Consumer

- [x] 3.1 Export into slides at `vendor/html-tools/`. Verify slides deletes its copies, imports from the
  vendored copy, and its Python and node tests pass.
- [x] 3.2 Record the dependency in slides as `consume-html-tools-runtime`. Mark
  `extract-shared-workshop-runtime` as superseded.
