/* Element annotations for an HTML page: press A, click any element in the unit on view, type a note, copy all
   notes out as tuicr review comments. A page loads this after its own script. Notes persist per page URL in
   localStorage. Screenshots pasted into a note are kept as data URLs and saved with "Save screenshots".

   The page is a sequence of units and one unit is on view. The defaults are a slide deck: units are ".slide",
   the one on view is ".slide.active", and a unit is reached by the "#N" hash. A page with another shape sets
   window.HTML_ANNOTATE = { unit, active, goTo } before this script loads.

   Targets can live inside a figure: figures load as same-origin iframes, and a click on one crosses into the
   frame document and picks the element under the pointer, so a note lands on "#stamp" or "div › div[2]"
   inside graphics/x.html rather than on the frame as a whole. Parts of an inline SVG work the same way.
   Elements that cannot host a badge (SVG parts, elements inside frames) get a floating mark drawn over them.

   Edit mode (E, while annotating): a click makes the element's text editable in place. Leaving it records the
   change as a SUGGESTION, "replace … with …", so the copied notes carry the exact words; the page itself is not
   saved. While the panel is open, `--inset-right` on <html> holds its width and a resize event fires, so a page
   that fits itself to the window can move aside. The script registers its commands in `window.HTML_COMMANDS`. */
(function () {
    "use strict";
    var TYPES = [
        { id: "issue", label: "ISSUE", color: "var(--red, #E06C75)", def: "problems to fix", key: "1" },
        { id: "note", label: "NOTE", color: "var(--cyan, #5CD6EC)", def: "observations", key: "2" },
        { id: "suggestion", label: "SUGGESTION", color: "var(--gold, #F2C46B)", def: "improvements", key: "3" },
        { id: "praise", label: "PRAISE", color: "var(--green, #7EC699)", def: "positive feedback", key: "4" }
    ];
    var TARGETS = "li, .chip, .card, .code, .promptbox, .foot-note, .kicker, h1, h2, h3, figure, .diagram, .diagram-frame, img, svg, p, blockquote, pre";
    var FIGURES = "figure, .diagram, .diagram-frame, img, svg";
    // What a click inside a figure document or an inline SVG resolves to: the nearest of these ancestors.
    var INNER = "[id], li, p, h1, h2, h3, td, th, img, svg, text, rect, circle, ellipse, image, a, g, div, span";
    var SVG_PART = "text, rect, circle, ellipse, image, a, g, path";
    var SVG_NS = "http://www.w3.org/2000/svg";
    var CFG = Object.assign({
        unit: ".slide",
        active: ".slide.active",
        goTo: function (i) { if (location.hash !== "#" + (i + 1)) { location.hash = "#" + (i + 1); } }
    }, (typeof window !== "undefined" && window.HTML_ANNOTATE) || {});
    var here = typeof location !== "undefined" ? location.pathname : "/deck.html";
    var STORE = "slides.annotations:" + here;
    var deckName = here.split("/").pop() || "deck";
    var records = typeof localStorage !== "undefined" ? load() : [];
    var on = false;
    var pending = null;

    function load() {
        try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; }
    }
    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(records)); } catch (e) { /* storage unavailable: keep in memory */ }
    }
    function esc(text) { return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function typeOf(id) { return TYPES.filter(function (t) { return t.id === id; })[0] || TYPES[1]; }

    // A short, stable address for an element under a root: "#id" when the element or an ancestor has one,
    // otherwise tag plus index among same-tag siblings at each level.
    function pathWithin(root, el) {
        var parts = [];
        var node = el;
        while (node && node !== root) {
            if (node.id) { parts.unshift("#" + node.id); break; }
            var tag = node.tagName.toLowerCase();
            var same = Array.prototype.filter.call(node.parentNode.children, function (c) { return c.tagName === node.tagName; });
            parts.unshift(same.length > 1 ? tag + "[" + (same.indexOf(node) + 1) + "]" : tag);
            node = node.parentNode;
        }
        return parts.join(" › ");
    }
    function resolve(root, path) {
        var node = root;
        var steps = path.split(" › ");
        for (var i = 0; i < steps.length && node; i += 1) {
            if (steps[i].charAt(0) === "#") { node = node.querySelector("[id='" + steps[i].slice(1).replace(/'/g, "\\'") + "']"); continue; }
            var m = /^([a-z0-9-]+)(?:\[(\d+)\])?$/.exec(steps[i]);
            if (!m) { return null; }
            var kids = Array.prototype.filter.call(node.children, function (c) { return c.tagName.toLowerCase() === m[1]; });
            node = kids[m[2] ? Number(m[2]) - 1 : 0] || null;
        }
        return node;
    }
    function snippet(el) {
        var text = (el.getAttribute("alt") || el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
        return text.length > 70 ? text.slice(0, 67) + "…" : text;
    }
    function where(r) { return r.path + (r.inner ? " › " + r.inner.src + " › " + r.inner.path : ""); }

    // tuicr review comment, the same shape forge-cli's annotate.js produces.
    function formatTuicr(items) {
        var used = {};
        items.forEach(function (r) { used[r.kind] = true; });
        var legend = TYPES.filter(function (t) { return used[t.id]; }).map(function (t) { return t.label + " (" + t.def + ")"; }).join(", ");
        var out = ["I reviewed your slides and have the following comments. Please address them.", "", "Comment types: " + legend, "", "## Local tuicr Comments", ""];
        items.forEach(function (r, i) {
            var snip = r.inner ? r.inner.snippet : r.snippet;
            out.push((i + 1) + ". **[" + typeOf(r.kind).label + "]** `" + deckName + "#" + r.slide + " › " + where(r) + "` - " + r.text
                + (r.pin && !r.inner ? " (at " + r.pin.x + "%, " + r.pin.y + "% of the figure)" : "")
                + (snip ? " (on: “" + snip + "”)" : "")
                + (r.image ? " (screenshot: annot-" + r.id + ".png)" : ""));
        });
        return out.join("\n");
    }

    if (typeof module !== "undefined" && module.exports) { module.exports = { formatTuicr: formatTuicr, TYPES: TYPES }; return; }

    var style = document.createElement("style");
    style.textContent = [
        ".annot-bar{position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:60;display:none;gap:.5rem;align-items:center;white-space:nowrap;max-width:calc(100vw - 2rem);font:600 .72rem/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#F2C46B);background:rgba(7,10,18,.92);border:1px solid var(--gold,#F2C46B);border-radius:999px;padding:.45rem .5rem .45rem .9rem}",
        ".annot-bar .count{color:var(--mut,#8B99B5);margin-right:.3rem}",
        ".annot-bar button{font:inherit;color:inherit;background:none;border:1px solid rgba(242,196,107,.5);border-radius:999px;padding:.35rem .7rem;cursor:pointer;white-space:nowrap}",
        ".annot-bar button:hover{background:rgba(242,196,107,.15)}",
        "body.annot-on .annot-bar{display:flex}",
        "body.annot-edit .annot-bar [data-act=edit]{background:var(--gold,#F2C46B);color:#070A12}",
        "body.annot-on.annot-edit " + CFG.active + " " + TARGETS.split(", ").join(",body.annot-on.annot-edit " + CFG.active + " ") + "{cursor:text}",
        "[contenteditable=true]{outline:2px solid var(--gold,#F2C46B)!important;outline-offset:4px;background:rgba(242,196,107,.06)}",
        "body.annot-on:not(.annot-inner) " + CFG.active + " " + TARGETS.split(", ").map(function (s) { return s + ":hover"; }).join(",body.annot-on:not(.annot-inner) " + CFG.active + " ") + "{outline:1px dashed rgba(242,196,107,.75);outline-offset:6px;cursor:crosshair}",
        "body.annot-on " + CFG.active + " iframe{pointer-events:none}",
        "body.annot-on " + CFG.active + " :is(figure,.diagram,.diagram-frame,svg){cursor:crosshair}",
        "body.annot-on [data-annot]{position:relative}",
        "body.annot-on [data-annot],body.annot-on " + CFG.active + " [data-annot]:hover{outline:1px solid var(--annot-color)!important;outline-offset:6px;position:relative}",
        ".annot-pin{display:none;position:absolute;width:1.3rem;height:1.3rem;margin:-.65rem 0 0 -.65rem;border-radius:50%;background:var(--annot-color);color:#070A12;font:700 .62rem/1.3rem var(--mono,ui-monospace,monospace);text-align:center;box-shadow:0 0 0 2px #070A12;z-index:6;pointer-events:none}",
        "body.annot-on .annot-pin{display:block}",
        ".annot-badge{display:none;position:absolute;top:-.65rem;left:-.65rem;width:1.3rem;height:1.3rem;border-radius:50%;background:var(--annot-color);color:#070A12;font:700 .62rem/1.3rem var(--mono,ui-monospace,monospace);text-align:center;box-shadow:0 0 0 2px #070A12;z-index:6;pointer-events:none}",
        "body.annot-on .annot-badge{display:block}",
        ".annot-hover,.annot-mark{position:fixed;z-index:58;pointer-events:none;border-radius:4px;box-sizing:border-box}",
        ".annot-hover{display:none;outline:1px dashed rgba(242,196,107,.75);outline-offset:6px}",
        "body.annot-on.annot-inner .annot-hover{display:block}",
        ".annot-mark{display:none;outline:1px solid var(--annot-color);outline-offset:6px}",
        ".annot-mark b{position:absolute;top:-.65rem;left:-.65rem;width:1.3rem;height:1.3rem;border-radius:50%;background:var(--annot-color);color:#070A12;font:700 .62rem/1.3rem var(--mono,ui-monospace,monospace);text-align:center;box-shadow:0 0 0 2px #070A12;z-index:6;pointer-events:auto;cursor:pointer}",
        "body.annot-on .annot-mark{display:block}",
        ".annot-pop{position:fixed;z-index:61;display:none;flex-direction:column;gap:.6rem;padding-top:1.6rem;width:min(40rem,92vw);background:#0b1220;border:1px solid var(--gold,#F2C46B);border-radius:12px;padding:.9rem;box-shadow:0 20px 60px rgba(0,0,0,.7)}",
        ".annot-pop.on{display:flex}",
        ".annot-pop .x{position:absolute;top:.35rem;right:.5rem;background:none;border:0;color:var(--faint,#5b6c85);font-size:1rem;cursor:pointer}",
        ".annot-pop .x:hover{color:var(--ink,#D7E1F0)}",
        ".annot-pop .target{font:.65rem/1.3 var(--mono,ui-monospace,monospace);color:var(--faint,#5b6c85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".annot-pop .shot:empty{display:none}",
        ".annot-pop .shot img,.annot-panel .rec img{display:block;max-width:100%;max-height:9rem;border:1px solid var(--line,rgba(139,153,181,.3));border-radius:6px;margin-top:.3rem}",
        ".annot-panel .rec .edit{color:var(--faint,#5b6c85);font:.65rem/1.3 var(--mono,ui-monospace,monospace);margin-top:.2rem}",
        ".annot-pop .kinds{display:flex;gap:.4rem}",
        ".annot-pop .kinds button{flex:1;font:700 .66rem/1 var(--mono,ui-monospace,monospace);letter-spacing:.1em;white-space:nowrap;background:none;border:1px solid var(--k);color:var(--k);border-radius:6px;padding:.5rem .4rem;cursor:pointer}",
        ".annot-pop .kinds button small{opacity:.6;font-weight:400;margin-right:.35rem}",
        ".annot-pop .kinds button.sel{background:var(--k);color:#070A12}",
        ".annot-pop textarea{font:.95rem/1.45 var(--sans,system-ui,sans-serif);color:var(--ink,#D7E1F0);background:#070A12;border:1px solid var(--line,rgba(139,153,181,.3));border-radius:6px;padding:.6rem;min-height:4.4rem;resize:vertical;outline:none}",
        ".annot-pop textarea:focus{border-color:var(--gold,#F2C46B)}",
        ".annot-pop .hint{font:.7rem/1.3 var(--mono,ui-monospace,monospace);color:var(--faint,#5b6c85)}",
        ".annot-panel{position:fixed;top:0;right:0;bottom:0;width:min(22rem,34vw);z-index:59;display:none;flex-direction:column;background:rgba(7,10,18,.96);border-left:1px solid var(--line,rgba(139,153,181,.3));padding:4rem 1rem 1rem;overflow:auto;font:.8rem/1.4 var(--sans,system-ui,sans-serif);color:var(--mut,#8B99B5)}",
        "body.annot-on .annot-panel{display:flex}",
        ".annot-panel .rec{border-left:2px solid var(--k);padding:.3rem .7rem;margin-bottom:.7rem;cursor:pointer;color:var(--ink,#D7E1F0)}",
        ".annot-panel .rec .n{display:inline-block;min-width:1.3rem;height:1.3rem;border-radius:50%;background:var(--k);color:#070A12;font:700 .62rem/1.3rem var(--mono,ui-monospace,monospace);text-align:center;margin-right:.4rem}",
        ".annot-panel .rec b{color:var(--k);font:700 .65rem/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em}",
        ".annot-panel .rec .where{color:var(--faint,#5b6c85);font:.65rem/1.3 var(--mono,ui-monospace,monospace);word-break:break-all}",
        ".annot-panel .rec .del{float:right;color:var(--faint,#5b6c85);cursor:pointer}",
        ".annot-panel .empty{color:var(--faint,#5b6c85)}",
        "@media print{.annot-bar,.annot-panel,.annot-pop,.annot-badge,.annot-mark,.annot-hover{display:none!important}}"
    ].join("\n");
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "annot-bar";
    bar.innerHTML = "<span>annotate</span><span class='count'></span><button data-act='edit' title='E · click text to edit it in place; the change is recorded as a suggestion'>Edit</button><button data-act='copy' title='copy all notes as tuicr comments'>Copy notes</button><button data-act='shots' title='save pasted screenshots as files'>Screenshots</button><button data-act='clear'>Clear</button><button data-act='off' title='Esc'>Off</button>";
    var pop = document.createElement("div");
    pop.className = "annot-pop";
    pop.innerHTML = "<button class='x' data-act='close' title='close'>✕</button><div class='target'></div><div class='kinds'>" + TYPES.map(function (t) { return "<button data-kind='" + t.id + "' style='--k:" + t.color + "'><small>⌥" + t.key + "</small>" + t.label + "</button>"; }).join("") + "</div><textarea placeholder='the note · paste a screenshot here too'></textarea><div class='shot'></div><div class='hint'>⌥1–⌥4 picks the type · Enter saves · Esc cancels · ⌘V pastes a screenshot</div>";
    var panel = document.createElement("div");
    panel.className = "annot-panel";
    var hover = document.createElement("div");
    hover.className = "annot-hover";
    var marks = document.createElement("div");
    marks.className = "annot-marks";
    document.body.appendChild(bar);
    document.body.appendChild(pop);
    document.body.appendChild(panel);
    document.body.appendChild(hover);
    document.body.appendChild(marks);
    var textarea = pop.querySelector("textarea");
    var shot = pop.querySelector(".shot");
    var targetLine = pop.querySelector(".target");
    var kind = "note";
    var image = null;
    var editing = null;
    var editMode = false;
    var editable = null;

    function slideOf(el) { while (el && !(el.matches && el.matches(CFG.unit))) { el = el.parentNode; } return el; }
    function units() { return Array.prototype.slice.call(document.querySelectorAll(CFG.unit)); }
    function isSvgPart(el) { return el.namespaceURI === SVG_NS && el.tagName.toLowerCase() !== "svg"; }
    function frameDoc(frame) { try { return frame && frame.contentDocument; } catch (e) { return null; } }
    function frameSrc(frame) { return (frame.dataset.src || frame.getAttribute("src") || "").split(/[?#]/)[0]; }
    function frameOf(container) { return container.tagName === "IFRAME" ? container : container.querySelector("iframe"); }
    function contains(box, x, y) { return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom; }
    function place(box, rect) { box.style.left = rect.left + "px"; box.style.top = rect.top + "px"; box.style.width = rect.width + "px"; box.style.height = rect.height + "px"; }

    // What sits under the pointer: the slide element, and when that element is a figure holding a frame,
    // the element inside the frame document at the same point; a part of an inline SVG counts on its own.
    function locate(e) {
        var slide = document.querySelector(CFG.active);
        if (!slide || !slide.contains(e.target)) { return null; }
        var el = e.target.closest(TARGETS);
        if (!el || !slide.contains(el)) { return null; }
        var loc = { el: el, frame: null, inner: null, pin: null };
        if (isSvgPart(e.target) && e.target !== el) {
            var part = e.target.closest(SVG_PART);
            if (part && el.contains(part)) { loc.el = part; return loc; }
        }
        if (!el.matches(FIGURES)) { return loc; }
        var box = el.getBoundingClientRect();
        loc.pin = { x: Math.round((e.clientX - box.left) / box.width * 1000) / 10, y: Math.round((e.clientY - box.top) / box.height * 1000) / 10 };
        var frames = el.tagName === "IFRAME" ? [el] : Array.prototype.slice.call(el.querySelectorAll("iframe"));
        var frame = frames.filter(function (f) { return contains(f.getBoundingClientRect(), e.clientX, e.clientY); })[0];
        var doc = frameDoc(frame);
        if (!doc || !doc.body) { return loc; }
        var fb = frame.getBoundingClientRect();
        var hit = doc.elementFromPoint(e.clientX - fb.left, e.clientY - fb.top);
        if (!hit || hit === doc.body || hit === doc.documentElement) { return loc; }
        var inner = hit.closest(INNER) || hit;
        if (inner === doc.body || inner === doc.documentElement) { return loc; }
        loc.frame = frame; loc.inner = inner;
        return loc;
    }
    function innerRect(frame, inner) {
        var fb = frame.getBoundingClientRect();
        var r = inner.getBoundingClientRect();
        return { left: fb.left + r.left, top: fb.top + r.top, width: r.width, height: r.height };
    }
    // Where a saved record points right now, or null when its slide is not the active one or its frame
    // has not loaded yet.
    function targetOf(r) {
        var slide = document.getElementById(r.slide);
        var el = slide && resolve(slide, r.path);
        if (!el) { return null; }
        if (!r.inner) { return { el: el, rect: isSvgPart(el) ? el.getBoundingClientRect() : null }; }
        var frame = frameOf(el);
        var doc = frameDoc(frame);
        var inner = doc && doc.body && resolve(doc.body, r.inner.path);
        return inner ? { el: el, frame: frame, inner: inner, rect: innerRect(frame, inner) } : { el: el, rect: null, unresolved: true };
    }
    function drawMarks() {
        marks.innerHTML = "";
        if (!on) { return; }
        var active = document.querySelector(CFG.active);
        records.forEach(function (r) {
            if (!active || active.id !== r.slide) { return; }
            var t = targetOf(r);
            if (!t || !t.rect) { return; }
            var mark = document.createElement("div");
            mark.className = "annot-mark"; mark.style.setProperty("--annot-color", typeOf(r.kind).color); mark.dataset.id = r.id;
            place(mark, t.rect);
            mark.innerHTML = "<b>" + (records.indexOf(r) + 1) + "</b>";
            marks.appendChild(mark);
        });
    }
    function paint() {
        Array.prototype.forEach.call(document.querySelectorAll("[data-annot]"), function (el) {
            el.removeAttribute("data-annot"); el.style.removeProperty("--annot-color");
            Array.prototype.forEach.call(el.querySelectorAll(":scope > .annot-badge, :scope > .annot-pin"), function (x) { x.remove(); });
        });
        records.forEach(function (r) {
            var slide = document.getElementById(r.slide);
            var el = slide && resolve(slide, r.path);
            if (!el || r.inner || isSvgPart(el)) { return; }   // those get floating marks instead
            var t = typeOf(r.kind);
            el.setAttribute("data-annot", r.id);
            el.style.setProperty("--annot-color", t.color);
            if (r.pin && !/^(img|svg)$/i.test(el.tagName)) {
                var pin = document.createElement("span");
                pin.className = "annot-pin"; pin.style.setProperty("--annot-color", t.color);
                pin.style.left = r.pin.x + "%"; pin.style.top = r.pin.y + "%"; pin.textContent = String(records.indexOf(r) + 1);
                el.appendChild(pin);
            } else if (!el.querySelector(":scope > .annot-badge") && !/^(img|svg)$/i.test(el.tagName)) {
                var badge = document.createElement("span");
                badge.className = "annot-badge"; badge.textContent = String(records.indexOf(r) + 1); el.appendChild(badge);
            }
        });
        drawMarks();
        bar.querySelector(".count").textContent = records.length + (records.length === 1 ? " note" : " notes");
        panel.innerHTML = records.length ? records.map(function (r) {
            var t = typeOf(r.kind);
            return "<div class='rec' data-id='" + r.id + "' style='--k:" + t.color + "'><span class='del' data-del='" + r.id + "'>✕</span><span class='n'>" + (records.indexOf(r) + 1) + "</span><b>" + t.label + "</b> <span class='where'>#" + esc(r.slide) + " › " + esc(where(r)) + (r.pin && !r.inner ? " @ " + r.pin.x + "%," + r.pin.y + "%" : "") + "</span><div>" + esc(r.text) + "</div>" + (r.edit ? "<div class='edit'>text edit</div>" : "") + (r.image ? "<img src='" + r.image + "' alt='screenshot'>" : "") + "<div class='edit'>click to edit</div></div>";
        }).join("") : "<div class='empty'>No notes yet. Click an element on the slide, or a part of a figure.</div>";
    }
    function setKind(id) { kind = id; Array.prototype.forEach.call(pop.querySelectorAll("[data-kind]"), function (b) { b.classList.toggle("sel", b.dataset.kind === id); }); }
    function describe(loc, record) {
        if (record) { return "#" + record.slide + " › " + where(record); }
        var slide = slideOf(loc.el);
        var text = "#" + (slide ? slide.id : "?") + " › " + pathWithin(slide, loc.el);
        if (loc.inner) { text += " › " + frameSrc(loc.frame) + " › " + pathWithin(loc.frame.contentDocument.body, loc.inner); }
        return text;
    }
    function openPop(loc, x, y, record) {
        pending = loc;
        editing = record || null;
        image = record ? record.image || null : null;
        shot.innerHTML = image ? "<img src='" + image + "' alt='screenshot'>" : "";
        targetLine.textContent = describe(loc, record);
        setKind(record ? record.kind : kind);
        textarea.value = record ? record.text : "";
        pop.style.left = Math.min(x, innerWidth - pop.offsetWidth - 16) + "px";
        pop.style.top = Math.min(y + 12, innerHeight - 200) + "px";
        pop.classList.add("on");
        pop.style.left = Math.max(8, Math.min(x, innerWidth - pop.offsetWidth - 16)) + "px";
        textarea.focus();
    }
    function closePop() { pop.classList.remove("on"); pending = null; editing = null; image = null; shot.innerHTML = ""; }
    function commit() {
        var text = textarea.value.trim();
        if (!pending || (!text && !image)) { closePop(); return; }
        if (editing) {
            editing.kind = kind; editing.text = text || "(screenshot)"; editing.image = image || undefined;
            save(); paint(); closePop(); return;
        }
        var slide = slideOf(pending.el);
        if (!slide || !slide.id) { closePop(); return; }
        var r = { id: Date.now().toString(36), slide: slide.id, path: pathWithin(slide, pending.el), kind: kind, text: text || "(screenshot)", snippet: snippet(pending.el), image: image || undefined, pin: pending.pin || undefined, ts: new Date().toISOString() };
        if (pending.inner) { r.inner = { src: frameSrc(pending.frame), path: pathWithin(pending.frame.contentDocument.body, pending.inner), snippet: snippet(pending.inner) }; }
        records.push(r);
        save(); paint(); closePop();
    }
    function editRecord(r) {
        var i = units().indexOf(document.getElementById(r.slide));
        if (i >= 0) { CFG.goTo(i); }
        var t = targetOf(r);
        var box = t && (t.rect || (t.el && t.el.getBoundingClientRect())) || { left: 80, bottom: 120 };
        openPop({ el: (t && t.el) || document.getElementById(r.slide), frame: t && t.frame, inner: t && t.inner, pin: r.pin }, box.left, box.bottom || box.top + box.height, r);
    }
    function copyAll() {
        if (!records.length) { return; }
        var all = units();
        var ordered = records.slice().sort(function (a, b) {
            var sa = document.getElementById(a.slide), sb = document.getElementById(b.slide);
            var ia = sa ? all.indexOf(sa) : 0;
            var ib = sb ? all.indexOf(sb) : 0;
            return ia - ib || a.ts.localeCompare(b.ts);
        });
        var text = formatTuicr(ordered);
        var done = function () { var c = bar.querySelector(".count"); var keep = c.textContent; c.textContent = "copied " + records.length; setTimeout(function () { c.textContent = keep; }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); }); }
        else { fallbackCopy(text); done(); }
    }
    function fallbackCopy(text) {
        var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) { /* the text stays selected for a manual copy */ }
        document.body.removeChild(ta);
    }
    var ticker = null;
    function inset() {
        var root = document.documentElement;
        var width = on ? Math.round(panel.getBoundingClientRect().width) : 0;
        if (width) { root.style.setProperty("--inset-right", width + "px"); } else { root.style.removeProperty("--inset-right"); }
        window.dispatchEvent(new Event("resize"));
    }
    function setEdit(next) {
        editMode = !!next; document.body.classList.toggle("annot-edit", editMode);
        if (!editMode) { finishEdit(); }
    }
    function startEdit(el) {
        finishEdit();
        editable = { el: el, before: el.innerText };
        el.setAttribute("contenteditable", "true"); el.focus();
    }
    function finishEdit() {
        if (!editable) { return; }
        var el = editable.el, before = editable.before, after = el.innerText;
        el.removeAttribute("contenteditable"); editable = null;
        if (after.trim() === before.trim()) { return; }
        var slide = slideOf(el);
        if (!slide || !slide.id) { return; }
        var line = function (t) { return t.trim().replace(/\n+/g, " ⏎ "); };
        records.push({ id: Date.now().toString(36), slide: slide.id, path: pathWithin(slide, el), kind: "suggestion", edit: true,
            text: "replace “" + line(before) + "” with “" + line(after) + "”", snippet: "", ts: new Date().toISOString() });
        save(); paint();
    }
    function setOn(next) {
        on = next; document.body.classList.toggle("annot-on", on);
        if (!on) { closePop(); setEdit(false); document.body.classList.remove("annot-inner"); }
        inset();
        // Figures animate and frames load late, so floating marks follow their targets while annotating.
        clearInterval(ticker); ticker = on ? setInterval(drawMarks, 400) : null;
        paint();
    }

    document.addEventListener("keydown", function (e) {
        if (e.target.isContentEditable) {
            e.stopPropagation();
            if (e.key === "Escape") { e.preventDefault(); e.target.blur(); }
            return;
        }
        var typing = e.target === textarea;
        if (typing) {
            e.stopPropagation();
            if (e.key === "Escape") { e.preventDefault(); closePop(); return; }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); return; }
            if (e.altKey) {
                var pick = TYPES.filter(function (x) { return "Digit" + x.key === e.code; })[0];
                if (pick) { e.preventDefault(); setKind(pick.id); }
            }
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (e.key === "a" || e.key === "A") { if (!/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); e.stopImmediatePropagation(); setOn(!on); } return; }
        if (!on) { return; }
        if (e.key === "e" || e.key === "E") { e.preventDefault(); e.stopImmediatePropagation(); setEdit(!editMode); return; }
        if (e.key === "Escape") { if (pop.classList.contains("on")) { closePop(); } else { setOn(false); } e.stopImmediatePropagation(); return; }
    }, true);
    document.addEventListener("focusout", function (e) { if (editable && e.target === editable.el) { setTimeout(finishEdit, 0); } }, true);
    var onPop = function (e) {
        if (e.target.dataset.act === "close") { closePop(); return; }
        var b = e.target.closest("[data-kind]"); if (b) { setKind(b.dataset.kind); textarea.focus(); }
    };
    textarea.addEventListener("paste", function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i += 1) {
            if (items[i].type.indexOf("image/") === 0) {
                var file = items[i].getAsFile();
                var reader = new FileReader();
                reader.onload = function () { image = reader.result; shot.innerHTML = "<img src='" + image + "' alt='screenshot'>"; };
                reader.readAsDataURL(file);
                e.preventDefault();
                return;
            }
        }
    });
    var onBar = function (e) {
        var act = e.target.dataset.act;
        if (act === "copy") { copyAll(); }
        if (act === "edit") { setEdit(!editMode); }
        if (act === "shots") {
            records.filter(function (r) { return r.image; }).forEach(function (r) {
                var a = document.createElement("a"); a.href = r.image; a.download = "annot-" + r.id + ".png"; document.body.appendChild(a); a.click(); a.remove();
            });
        }
        if (act === "clear" && confirm("Delete all " + records.length + " notes on this deck?")) { records = []; save(); paint(); }
        if (act === "off") { setOn(false); }
    };
    var onPanel = function (e) {
        var del = e.target.dataset.del;
        if (del) { records = records.filter(function (r) { return r.id !== del; }); save(); paint(); return; }
        var rec = e.target.closest(".rec");
        if (rec) { editRecord(records.filter(function (x) { return x.id === rec.dataset.id; })[0]); }
    };
    // Capture phase, so the deck's own click navigation never sees a click on the annotation UI.
    document.addEventListener("click", function (e) {
        if (!on) { return; }
        if (bar.contains(e.target)) { e.stopPropagation(); onBar(e); return; }
        if (pop.contains(e.target)) { e.stopPropagation(); onPop(e); return; }
        if (panel.contains(e.target)) { e.stopPropagation(); onPanel(e); return; }
        var mark = e.target.closest(".annot-mark");
        if (mark) { e.stopPropagation(); editRecord(records.filter(function (x) { return x.id === mark.dataset.id; })[0]); return; }
        if (editable && editable.el.contains(e.target)) { e.stopPropagation(); return; }
        var loc = locate(e);
        if (!loc) { return; }
        e.preventDefault(); e.stopImmediatePropagation();
        if (editMode && !loc.inner && !isSvgPart(loc.el) && !loc.el.matches(FIGURES)) { startEdit(loc.el); return; }
        var existing = loc.el.getAttribute && loc.el.getAttribute("data-annot");
        if (existing && !loc.inner) { editRecord(records.filter(function (x) { return x.id === existing; })[0]); return; }
        openPop(loc, e.clientX, e.clientY, null);
    }, true);
    document.addEventListener("mousemove", function (e) {
        if (!on || pop.classList.contains("on")) { return; }
        var loc = locate(e);
        var rect = loc && (loc.inner ? innerRect(loc.frame, loc.inner) : (isSvgPart(loc.el) ? loc.el.getBoundingClientRect() : null));
        document.body.classList.toggle("annot-inner", !!rect);
        if (rect) { place(hover, rect); }
    }, true);
    ["keyup", "keypress"].forEach(function (type) {
        document.addEventListener(type, function (e) { if (e.target === textarea) { e.stopPropagation(); } }, true);
    });
    ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach(function (type) {
        document.addEventListener(type, function (e) {
            if (on && (bar.contains(e.target) || pop.contains(e.target) || panel.contains(e.target) || marks.contains(e.target))) { e.stopPropagation(); }
        }, true);
    });
    window.addEventListener("resize", drawMarks);
    window.addEventListener("hashchange", function () { setTimeout(drawMarks, 50); });

    window.HTML_COMMANDS = (window.HTML_COMMANDS || []).concat([
        { label: "Annotate mode", hint: "A", group: "modes", run: function () { setOn(!on); } },
        { label: "Edit text in place", hint: "E · while annotating", group: "modes", run: function () { if (!on) { setOn(true); } setEdit(!editMode); } },
        { label: "Copy notes", hint: "", group: "modes", run: copyAll }
    ]);
    window.SlideAnnotate = { formatTuicr: formatTuicr, records: function () { return records.slice(); }, on: function (v) { setOn(v !== false); }, edit: function (v) { setEdit(v !== false); } };
    if (/[?&]annotate=1/.test(location.search)) { setOn(true); } else { paint(); }
})();
