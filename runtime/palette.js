/* Command palette for any page. ⌘K, Ctrl+K or / opens it. Type to filter; ↑↓ move; Enter runs; Esc closes.

   Commands come from `window.HTML_COMMANDS`: an array whose entries are commands `{ label, hint, run, group,
   here }` or functions that return such arrays when the palette opens. A page, or another runtime file, pushes
   onto it before or after this script loads. `HtmlCommands.all()` flattens the array, and the command pane
   (pane.js) and a deck's help overlay read the same list. `window.SLIDE_COMMANDS` is read too, for pages that
   registered under the older name. */
(function () {
    "use strict";
    var registry = function () {
        var items = [];
        [].concat(window.HTML_COMMANDS || [], window.SLIDE_COMMANDS || []).forEach(function (entry) {
            var more = typeof entry === "function" ? entry() : entry;
            [].concat(more || []).forEach(function (c) { if (c && c.label && typeof c.run === "function") { items.push(c); } });
        });
        return items;
    };
    // Prefix, then substring, then every word somewhere. Zero means no match.
    function score(label, q) {
        var l = String(label).toLowerCase();
        if (!q) { return 1; }
        if (l.indexOf(q) === 0) { return 3; }
        if (l.indexOf(q) > -1) { return 2; }
        return q.split(/\s+/).every(function (word) { return l.indexOf(word) > -1; }) ? 1 : 0;
    }
    function filter(items, query, limit) {
        var q = String(query || "").trim().toLowerCase();
        return items.map(function (c) { return { c: c, s: score(c.label, q) }; }).filter(function (m) { return m.s > 0; })
            .sort(function (a, b) { return b.s - a.s; }).slice(0, limit || 14).map(function (m) { return m.c; });
    }
    if (typeof module !== "undefined" && module.exports) { module.exports = { score: score, filter: filter }; return; }
    window.HTML_COMMANDS = window.HTML_COMMANDS || [];
    window.HtmlCommands = { all: registry, register: function (entry) { window.HTML_COMMANDS.push(entry); } };

    var open = false;
    var index = 0;
    var matches = [];
    var style = document.createElement("style");
    style.textContent = [
        ".pal{position:fixed;inset:0;z-index:70;display:none;align-items:flex-start;justify-content:center;padding-top:12vh;background:color-mix(in srgb,var(--void,#070A12) 54.902%,transparent)}",
        ".pal.on{display:flex}",
        ".pal .box{width:min(44rem,92vw);background:var(--surface,#0b1220);border:1px solid var(--gold,#F2C46B);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.7);overflow:hidden}",
        ".pal input{width:100%;box-sizing:border-box;font:1.05rem/1.4 var(--sans,system-ui,sans-serif);color:var(--ink,#D7E1F0);background:transparent;border:0;border-bottom:1px solid var(--line,rgba(139,153,181,.3));padding:.9rem 1rem;outline:none}",
        ".pal ul{list-style:none;margin:0;padding:.4rem 0;max-height:52vh;overflow:auto}",
        ".pal li{display:flex;justify-content:space-between;gap:1rem;padding:.5rem 1rem;font:.95rem/1.35 var(--sans,system-ui,sans-serif);color:var(--mut,#8B99B5);cursor:pointer}",
        ".pal li.sel{background:color-mix(in srgb,var(--gold,#F2C46B) 12.1569%,transparent);color:var(--ink,#D7E1F0)}",
        ".pal li .hint{font:.7rem/1.4 var(--mono,ui-monospace,monospace);letter-spacing:.08em;color:var(--faint,#5b6c85);white-space:nowrap}",
        ".pal li.jump .label::before{content:'→ ';color:var(--cyan,#5CD6EC)}",
        ".pal .empty{padding:.8rem 1rem;color:var(--faint,#5b6c85);font:.85rem/1.4 var(--sans,system-ui,sans-serif)}"
    ].join("\n");
    document.head.appendChild(style);
    var pal = document.createElement("div");
    pal.className = "pal";
    pal.innerHTML = "<div class='box'><input type='text' placeholder='Type a command…' aria-label='command palette'><ul></ul></div>";
    document.body.appendChild(pal);
    var input = pal.querySelector("input");
    var list = pal.querySelector("ul");

    var render = function () {
        matches = filter(registry(), input.value);
        index = Math.min(index, Math.max(0, matches.length - 1));
        list.innerHTML = matches.length ? matches.map(function (c, i) {
            return "<li class='" + (i === index ? "sel " : "") + (c.group === "slides" ? "jump" : "") + "' data-i='" + i + "'><span class='label'>" + String(c.label).replace(/</g, "&lt;") + "</span><span class='hint'>" + (c.hint || "") + "</span></li>";
        }).join("") : "<div class='empty'>nothing matches</div>";
        var sel = list.querySelector("li.sel"); if (sel) { sel.scrollIntoView({ block: "nearest" }); }
    };
    var show = function () { open = true; pal.classList.add("on"); input.value = ""; index = 0; render(); input.focus(); };
    var hide = function () { open = false; pal.classList.remove("on"); input.blur(); };
    var run = function (i) { var c = matches[i]; hide(); if (c) { setTimeout(c.run, 0); } };

    document.addEventListener("keydown", function (e) {
        var typing = /input|textarea|select/i.test(e.target.tagName) && e.target !== input;
        if (!open) {
            if (typing || e.target.isContentEditable) { return; }
            if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey)) { e.preventDefault(); e.stopImmediatePropagation(); show(); }
            return;
        }
        e.stopImmediatePropagation();
        if (e.key === "Escape") { e.preventDefault(); hide(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); index = (index + 1) % Math.max(1, matches.length); render(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); index = (index - 1 + Math.max(1, matches.length)) % Math.max(1, matches.length); render(); return; }
        if (e.key === "Enter") { e.preventDefault(); run(index); return; }
    }, true);
    ["keyup", "keypress"].forEach(function (type) { document.addEventListener(type, function (e) { if (open) { e.stopImmediatePropagation(); } }, true); });
    input.addEventListener("input", function () { index = 0; render(); });
    list.addEventListener("click", function (e) { var li = e.target.closest("li"); if (li) { run(Number(li.dataset.i)); } });
    pal.addEventListener("click", function (e) { if (e.target === pal) { hide(); } });
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup"].forEach(function (type) {
        document.addEventListener(type, function (e) { if (open && pal.contains(e.target)) { e.stopPropagation(); } }, true);
    });
    window.HtmlPalette = { open: show, close: hide, commands: registry };
})();
