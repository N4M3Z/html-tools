/* High-contrast mode, for a projector that washes the deck out. Press H, or run "High contrast" from the
   command palette. Pure black ground, white ink, brighter muted and line colours, brighter accents. The same
   overrides are injected into every same-origin figure frame, now and as frames load, and the frame's root gets
   the hc class too. The choice persists per deck URL in localStorage, so it survives a reload on the day.

   With theme.js loaded, the active theme supplies the set through SlideTheme.contrast(): a light theme turns into
   white ground and black ink, and repaints the SVG literals itself. A theme without its own set, or a page
   without theme.js, gets the black set below. A theme change rebuilds the overrides. */
(function () {
    "use strict";
    var VARS = "--void:#000;--bg1:#000;--panel:rgba(255,255,255,.08);--line:rgba(230,238,250,.55);"
        + "--ink:#fff;--mut:#dbe3f2;--faint:#b3bfd6;"
        + "--cyan:#8df0ff;--cyan-soft:rgba(141,240,255,.2);--gold:#ffd98a;--gold-soft:rgba(255,217,138,.18);"
        + "--red:#ff9ba3;--red-soft:rgba(255,155,163,.2);--green:#a9edc2;--green-soft:rgba(169,237,194,.2);";
    // Inline SVG art carries literal colours; lift the ones the decks use.
    var LIFT = [
        ["#D7E1F0", "#fff"], ["#8B99B5", "#dbe3f2"], ["#5b6c85", "#b3bfd6"],
        ["#5CD6EC", "#8df0ff"], ["#F2C46B", "#ffd98a"], ["#7EC699", "#a9edc2"], ["#E06C75", "#ff9ba3"],
        ["rgba(139,153,181,0.3)", "rgba(230,238,250,.6)"], ["rgba(139,153,181,0.16)", "rgba(230,238,250,.45)"]
    ];
    function lifted(pairs, scope) {
        return pairs.map(function (p) {
            return scope + "[fill=\"" + p[0] + "\"]{fill:" + p[1] + "}" + scope + "[stroke=\"" + p[0] + "\"]{stroke:" + p[1] + "}";
        }).join("");
    }
    // The set in force: a theme's, as SlideTheme.contrast() returns it, or the black one.
    function palette(theme) {
        return theme ? { vars: theme.vars, ground: theme.ground || "#000", lift: theme.lift || [] } : { vars: VARS, ground: "#000", lift: LIFT };
    }
    function deckCss(set) { return "html.hc{" + set.vars + "}html.hc body{background:" + set.ground + "}" + lifted(set.lift, "html.hc "); }
    function frameCss(set) { return ":root{" + set.vars + "}" + lifted(set.lift, ""); }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { VARS: VARS, LIFT: LIFT, palette: palette, deckCss: deckCss, frameCss: frameCss };
        return;
    }

    var KEY = "slides.contrast:" + location.pathname;
    function current() { return palette(window.SlideTheme && window.SlideTheme.contrast ? window.SlideTheme.contrast() : null); }
    var FRAME_CSS = frameCss(current());
    var style = document.createElement("style");
    style.textContent = deckCss(current());
    document.head.appendChild(style);

    var on = false;
    function frames() { return Array.prototype.slice.call(document.querySelectorAll("iframe")); }
    function frameDoc(frame) { try { return frame.contentDocument; } catch (e) { return null; } }
    function applyFrames() {
        frames().forEach(function (frame) {
            var doc = frameDoc(frame);
            if (!doc || !doc.head) { return; }
            var have = doc.getElementById("hc-style");
            if (on) {
                if (!have) { have = doc.createElement("style"); have.id = "hc-style"; doc.head.appendChild(have); }
                if (have.textContent !== FRAME_CSS) { have.textContent = FRAME_CSS; }
                doc.documentElement.classList.add("hc");
            } else if (have) {
                have.remove();
                doc.documentElement.classList.remove("hc");
            }
        });
    }
    function refresh() {
        var next = current();
        style.textContent = deckCss(next);
        FRAME_CSS = frameCss(next);
        applyFrames();
    }
    function set(next) {
        on = !!next;
        document.documentElement.classList.toggle("hc", on);
        applyFrames();
        try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* storage unavailable */ }
    }
    document.addEventListener("slidetheme", refresh);
    document.addEventListener("load", function (e) { if (e.target && e.target.tagName === "IFRAME") { applyFrames(); } }, true);
    document.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) { return; }
        if (e.key === "h" || e.key === "H") { e.preventDefault(); set(!on); }
    });
    window.HTML_COMMANDS = (window.HTML_COMMANDS || []).concat([{ label: "High contrast", hint: "H · for a weak projector", group: "display", run: function () { set(!on); }, state: function () { return on; } }]);
    window.SlideContrast = { on: function (v) { set(v !== false); }, toggle: function () { set(!on); }, active: function () { return on; } };

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
    if (saved === "1" || /[?&]hc=1/.test(location.search)) { set(true); }
})();
