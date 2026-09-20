/* High-contrast mode, for a projector that washes the deck out. Press H, or run "High contrast" from the
   command palette. Pure black ground, white ink, brighter muted and line colours, brighter accents. The same
   overrides are injected into every same-origin figure frame, now and as frames load. The choice persists per
   deck URL in localStorage, so it survives a reload on the day. */
(function () {
    "use strict";
    var KEY = "slides.contrast:" + location.pathname;
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
    function lifted(scope) {
        return LIFT.map(function (p) {
            return scope + "[fill=\"" + p[0] + "\"]{fill:" + p[1] + "}" + scope + "[stroke=\"" + p[0] + "\"]{stroke:" + p[1] + "}";
        }).join("");
    }
    var DECK_CSS = "html.hc{" + VARS + "}html.hc body{background:#000}" + lifted("html.hc ");
    var FRAME_CSS = ":root{" + VARS + "}" + lifted("");

    var style = document.createElement("style");
    style.textContent = DECK_CSS;
    document.head.appendChild(style);

    var on = false;
    function frames() { return Array.prototype.slice.call(document.querySelectorAll("iframe")); }
    function frameDoc(frame) { try { return frame.contentDocument; } catch (e) { return null; } }
    function applyFrames() {
        frames().forEach(function (frame) {
            var doc = frameDoc(frame);
            if (!doc || !doc.head) { return; }
            var have = doc.getElementById("hc-style");
            if (on && !have) { var s = doc.createElement("style"); s.id = "hc-style"; s.textContent = FRAME_CSS; doc.head.appendChild(s); }
            if (!on && have) { have.remove(); }
        });
    }
    function set(next) {
        on = !!next;
        document.documentElement.classList.toggle("hc", on);
        applyFrames();
        try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* storage unavailable */ }
    }
    document.addEventListener("load", function (e) { if (e.target && e.target.tagName === "IFRAME") { applyFrames(); } }, true);
    document.addEventListener("keydown", function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) { return; }
        if (e.key === "h" || e.key === "H") { e.preventDefault(); set(!on); }
    });
    window.SLIDE_COMMANDS = (window.SLIDE_COMMANDS || []).concat([{ label: "High contrast", hint: "H · for a weak projector", run: function () { set(!on); } }]);
    window.SlideContrast = { on: function (v) { set(v !== false); }, toggle: function () { set(!on); }, active: function () { return on; } };

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
    if (saved === "1" || /[?&]hc=1/.test(location.search)) { set(true); }
})();
