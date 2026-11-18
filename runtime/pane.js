/* Command pane for any page: every command, grouped, always visible while open. The palette (palette.js) is
   for typing a name; the pane (C, ⌘P or Ctrl+P) is for a glance during a talk or a review. Both read
   `window.HTML_COMMANDS` through `HtmlCommands.all()`. A command's `group` names its section, in order of
   first appearance; the group `slides`, the jump list of a deck, comes last, so the tools stay on the first
   screen. A command with `here: true` is the current one and is marked. Load after palette.js.

   ⌘P and Ctrl+P open the pane in place of the print dialog. Print from the browser menu.

   While open, the pane sets `--inset-right` on <html> to its width and dispatches a resize event, so a page
   that fits itself to the window (the html-slides stage) can move aside instead of hiding behind it. One
   panel has the right edge at a time: a panel that opens there dispatches `html-tools:side-panel` on the
   document with its name in `detail.owner`, and the pane closes when another owner opens. */
(function () {
    "use strict";
    var WIDTH = "min(22rem, 34vw)";
    var LAST = ["slides"];
    // Pure: commands into named groups, in order of first appearance; "commands" for the unnamed. A group in
    // `last` (default: the jump list `slides`) goes to the end, whenever its commands were registered.
    function groupCommands(commands, last) {
        var order = [], byName = {}, tail = last || LAST;
        commands.forEach(function (c) {
            var name = c.group || "commands";
            if (!byName[name]) { byName[name] = []; order.push(name); }
            byName[name].push(c);
        });
        var late = function (name) { return tail.indexOf(name) > -1 ? 1 : 0; };
        return order.map(function (name, index) { return { name: name, index: index }; })
            .sort(function (a, b) { return late(a.name) - late(b.name) || a.index - b.index; })
            .map(function (entry) { return { name: entry.name, commands: byName[entry.name] }; });
    }
    // Pure: what a key does to the pane: "toggle", "close" or null. C and Escape stay with a field that has
    // the focus.
    function paneKey(event, open, typing) {
        var p = event.key === "p" || event.key === "P";
        if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && p) {
            // Ctrl+P in a field is a cursor key on macOS, so only ⌘P works there.
            return event.repeat || (typing && !event.metaKey) ? null : "toggle";
        }
        if (event.metaKey || event.ctrlKey || event.altKey || typing) { return null; }
        if (event.key === "c" || event.key === "C") { return "toggle"; }
        return event.key === "Escape" && open ? "close" : null;
    }
    if (typeof module !== "undefined" && module.exports) { module.exports = { groupCommands: groupCommands, paneKey: paneKey }; return; }

    var open = false;
    var style = document.createElement("style");
    style.textContent = [
        ".cpane{position:fixed;top:0;right:0;bottom:0;width:" + WIDTH + ";z-index:58;display:none;flex-direction:column;background:color-mix(in srgb,var(--void,#070A12) 96.0784%,transparent);border-left:1px solid var(--line,rgba(139,153,181,.3));padding:1rem 0;overflow:auto;font:.8rem/1.4 var(--sans,system-ui,sans-serif);color:var(--mut,#8B99B5)}",
        "body.cpane-on .cpane{display:flex}",
        ".cpane h4{font:700 .62rem/1 var(--mono,ui-monospace,monospace);letter-spacing:.18em;text-transform:uppercase;color:var(--faint,#5b6c85);padding:.9rem 1rem .4rem}",
        ".cpane .x{position:absolute;top:.5rem;right:.6rem;background:none;border:0;color:var(--faint,#5b6c85);font-size:1rem;cursor:pointer}",
        ".cpane .x:hover{color:var(--ink,#D7E1F0)}",
        ".cpane button.cmd{display:flex;justify-content:space-between;gap:.8rem;width:100%;text-align:left;font:inherit;color:var(--mut,#8B99B5);background:none;border:0;border-left:2px solid transparent;padding:.32rem 1rem;cursor:pointer}",
        ".cpane button.cmd:hover{color:var(--ink,#D7E1F0);background:color-mix(in srgb,var(--gold,#F2C46B) 7.8431%,transparent)}",
        ".cpane button.cmd.here{color:var(--ink,#D7E1F0);border-left-color:var(--gold,#F2C46B)}",
        ".cpane button.cmd .hint{font:.62rem/1.6 var(--mono,ui-monospace,monospace);letter-spacing:.08em;color:var(--faint,#5b6c85);white-space:nowrap}",
        "@media print{.cpane{display:none!important}}"
    ].join("\n");
    document.head.appendChild(style);
    var pane = document.createElement("div");
    pane.className = "cpane";
    document.body.appendChild(pane);

    var registry = function () { return window.HtmlCommands ? window.HtmlCommands.all() : [].concat(window.HTML_COMMANDS || []); };
    var items = [];
    function render() {
        items = [];
        pane.innerHTML = "<button class='x' data-act='close' title='close'>✕</button>" + groupCommands(registry()).map(function (g) {
            return "<h4>" + g.name + "</h4>" + g.commands.map(function (c) {
                var i = items.push(c) - 1;
                return "<button class='cmd" + (c.here ? " here" : "") + "' data-i='" + i + "'><span>" + String(c.label).replace(/</g, "&lt;") + "</span><span class='hint'>" + (c.hint || "") + "</span></button>";
            }).join("");
        }).join("");
        var here = pane.querySelector(".cmd.here");
        if (here) { here.scrollIntoView({ block: "nearest" }); }
    }
    // The inset is the pane's measured width in px, so a page can subtract it from the window.
    function inset(on) {
        var root = document.documentElement;
        var width = on ? Math.round(pane.getBoundingClientRect().width) : 0;
        if (width) { root.style.setProperty("--inset-right", width + "px"); } else { root.style.removeProperty("--inset-right"); }
        window.dispatchEvent(new Event("resize"));
    }
    function set(next) {
        open = !!next;
        document.body.classList.toggle("cpane-on", open);
        if (open) { render(); document.dispatchEvent(new CustomEvent("html-tools:side-panel", { detail: { owner: "pane" } })); }
        inset(open);
    }
    document.addEventListener("html-tools:side-panel", function (e) { if (open && e.detail && e.detail.owner !== "pane") { set(false); } });
    pane.addEventListener("click", function (e) {
        e.stopPropagation();
        if (e.target.dataset.act === "close") { set(false); return; }
        var b = e.target.closest(".cmd");
        if (b) { var c = items[Number(b.dataset.i)]; if (c) { setTimeout(c.run, 0); setTimeout(render, 80); } }
    }, true);
    ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach(function (type) {
        document.addEventListener(type, function (e) { if (open && pane.contains(e.target)) { e.stopPropagation(); } }, true);
    });
    document.addEventListener("keydown", function (e) {
        var action = paneKey(e, open, /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable);
        if (!action) { return; }
        e.stopImmediatePropagation();
        if (action === "toggle") { e.preventDefault(); set(!open); } else { set(false); }
    }, true);
    window.addEventListener("hashchange", function () { if (open) { setTimeout(render, 30); } });
    window.HTML_COMMANDS = (window.HTML_COMMANDS || []).concat([{ label: "Command pane", hint: "C · ⌘P", group: "panels", run: function () { set(!open); }, state: function () { return open; } }]);
    window.HtmlPane = { open: function () { set(true); }, close: function () { set(false); }, toggle: function () { set(!open); }, refresh: render, width: WIDTH };
})();
