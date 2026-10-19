/* Colour themes. Night is the page's own dark palette and the default, Day a light ground, Dusk a slate ground
   between the two. Press T to cycle them, or pick one in the command palette, where each theme shows whether it
   is on. A theme overrides the colour variables on html[data-theme="…"], injects the same variables into every
   same-origin frame, now and as frames load, and repaints the literal colours of inline SVG art from them. The
   choice persists per page URL in localStorage, and ?theme=<name> picks one. With nothing saved the default
   applies, whatever the system's prefers-color-scheme says.

   High contrast (contrast.js, H) composes with every theme. A theme names its own high-contrast set, which
   contrast.js reads through SlideTheme.contrast(): Day turns into white ground and black ink. A theme without a
   set keeps the black one. Load this script before contrast.js. */
(function () {
    "use strict";
    // Every theme is a full set of the colour variables talk.css declares, plus --surface: the ground of floating
    // panels such as the palette and the note box, which falls back to #0b1220 on a page that leaves it unset.
    // Night is the page's own palette, listed here as the source the literal colours are matched against. It
    // injects nothing, so a page on Night renders exactly as it did before this script.
    //
    // Day passes WCAG AA (4.5:1) for every text role. Ratios on the ground #F7F9FC, on the glow #E8EEF6, and on
    // the role's own soft fill (a chip): ink 16.83 · 15.20 · 13.69, mut 8.23 · 7.44 · 7.05, faint 5.34 · 4.83 ·
    // 4.68, cyan 5.60 · 5.06 · 4.86, gold 5.62 · 5.08 · 4.89, red 6.20 · 5.60 · 5.27, green 5.49 · 4.96 · 4.79.
    // The ground colour on a gold, cyan and red badge: 5.62, 5.60, 6.20.
    // Day's high contrast, on #FFFFFF: ink 21.00, mut 16.51, faint 12.14, cyan 8.43, gold 9.89, red 9.32, green 9.70.
    // Dusk, on the ground #3A4254: ink 9.28, mut 6.81, faint 5.32, cyan 6.96, gold 7.07, red 5.70, green 6.71.
    var THEMES = [
        { name: "night", label: "Night", hc: null, vars: {
            "color-scheme": "dark", "--void": "#070A12", "--bg1": "#0a1426", "--panel": "rgba(255, 255, 255, 0.035)",
            "--line": "rgba(139, 153, 181, 0.16)", "--ink": "#D7E1F0", "--mut": "#8B99B5", "--faint": "#5b6c85",
            "--cyan": "#5CD6EC", "--cyan-soft": "rgba(92, 214, 236, 0.12)", "--gold": "#F2C46B", "--gold-soft": "rgba(242, 196, 107, 0.10)",
            "--red": "#E06C75", "--green": "#7EC699", "--green-soft": "rgba(126, 198, 153, 0.12)" } },
        { name: "day", label: "Day", vars: {
            "color-scheme": "light", "--void": "#F7F9FC", "--bg1": "#E8EEF6", "--panel": "rgba(16, 24, 40, 0.04)",
            "--line": "rgba(62, 76, 99, 0.22)", "--ink": "#101828", "--mut": "#3E4C63", "--faint": "#5A6880",
            "--cyan": "#0A6E80", "--cyan-soft": "rgba(10, 110, 128, 0.10)", "--gold": "#8A5A00", "--gold-soft": "rgba(138, 90, 0, 0.10)",
            "--red": "#B3261E", "--green": "#1C7442", "--green-soft": "rgba(28, 116, 66, 0.10)", "--surface": "#FFFFFF" },
          hc: { ground: "#fff", vars: {
            "color-scheme": "light", "--void": "#fff", "--bg1": "#fff", "--panel": "rgba(0, 0, 0, 0.05)",
            "--line": "rgba(0, 0, 0, 0.55)", "--ink": "#000", "--mut": "#1A1F29", "--faint": "#2E3645",
            "--cyan": "#005566", "--cyan-soft": "rgba(0, 85, 102, 0.14)", "--gold": "#5C3D00", "--gold-soft": "rgba(92, 61, 0, 0.14)",
            "--red": "#8F0F1B", "--red-soft": "rgba(143, 15, 27, 0.14)", "--green": "#0B4F2A", "--green-soft": "rgba(11, 79, 42, 0.14)",
            "--surface": "#fff" } } },
        { name: "dusk", label: "Dusk", hc: null, vars: {
            "color-scheme": "dark", "--void": "#3A4254", "--bg1": "#424B60", "--panel": "rgba(255, 255, 255, 0.05)",
            "--line": "rgba(205, 213, 227, 0.2)", "--ink": "#F3F6FA", "--mut": "#CDD5E3", "--faint": "#B3BDD0",
            "--cyan": "#8EE4F2", "--cyan-soft": "rgba(142, 228, 242, 0.14)", "--gold": "#F7D48E", "--gold-soft": "rgba(247, 212, 142, 0.12)",
            "--red": "#F9B0B5", "--green": "#A6E0BC", "--green-soft": "rgba(166, 224, 188, 0.14)", "--surface": "#333B4C" } }
    ];
    var ATTRS = ["fill", "stroke", "stop-color"];
    var ROLES = ["--ink", "--mut", "--faint", "--cyan", "--gold", "--red", "--green", "--bg1", "--void"];

    function parse(text) {
        var s = String(text || "").trim().toLowerCase();
        var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
        if (m) {
            var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
        }
        m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(s);
        if (!m) { return null; }
        var a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }
    // A literal colour as an expression over the theme variables: the role whose Night colour it matches, within
    // two levels per channel, at the literal's own alpha. A brand colour matches no role and keeps its literal.
    function paint(text, source) {
        var c = parse(text);
        if (!c) { return null; }
        for (var i = 0; i < ROLES.length; i += 1) {
            var s = parse(source[ROLES[i]]);
            if (s && s[3] === 1 && Math.abs(s[0] - c[0]) <= 2 && Math.abs(s[1] - c[1]) <= 2 && Math.abs(s[2] - c[2]) <= 2) {
                return c[3] >= 1 ? "var(" + ROLES[i] + ")" : "color-mix(in srgb, var(" + ROLES[i] + ") " + Math.round(c[3] * 1000) / 10 + "%, transparent)";
            }
        }
        return null;
    }
    function declarations(vars) { return Object.keys(vars).map(function (k) { return k + ":" + vars[k]; }).join(";"); }
    // Zero specificity: the rule beats the SVG attribute and loses to any stylesheet rule that already paints it.
    function liftRules(pairs, scope) {
        return pairs.map(function (p) {
            var to = paint(p[1], THEMES[0].vars);
            return to ? ":where(" + scope + "[" + p[0] + "=\"" + p[1].replace(/["\\]/g, "\\$&") + "\" i]){" + p[0] + ":" + to + "}" : "";
        }).join("");
    }
    function find(name) { return THEMES.filter(function (t) { return t.name === name; })[0] || null; }
    // A theme's variables yield to high contrast. Its repaint stays on under high contrast when the theme brings
    // its own set, because the repaint reads variables; otherwise contrast.js lifts the literals itself.
    function deckCss(theme, pairs) {
        var scope = "html[data-theme=\"" + theme.name + "\"]";
        return scope + ":not(.hc){" + declarations(theme.vars) + "}" + liftRules(pairs, scope + (theme.hc ? " " : ":not(.hc) "));
    }
    function frameCss(theme, pairs) {
        return ":root:not(.hc){" + declarations(theme.vars) + "}" + liftRules(pairs, theme.hc ? "" : ":root:not(.hc) ");
    }
    function contrastSet(theme) { return theme && theme.hc ? { vars: declarations(theme.hc.vars), ground: theme.hc.ground, lift: [] } : null; }
    function pick(saved, search) {
        var m = /[?&]theme=([a-z]+)/i.exec(search || "");
        var asked = m ? find(m[1].toLowerCase()) : null;
        if (asked) { return asked.name; }
        return find(saved) ? saved : THEMES[0].name;
    }
    function next(name) { return THEMES[(THEMES.indexOf(find(name)) + 1) % THEMES.length].name; }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { THEMES: THEMES, parse: parse, paint: paint, declarations: declarations, deckCss: deckCss, frameCss: frameCss, contrastSet: contrastSet, pick: pick, next: next };
        return;
    }

    var KEY = "slides.theme:" + location.pathname;
    var current = THEMES[0].name;
    var style = document.createElement("style");
    document.head.appendChild(style);
    function literals(doc) {
        var seen = {};
        var pairs = [];
        ATTRS.forEach(function (attr) {
            Array.prototype.forEach.call(doc.querySelectorAll("[" + attr + "]"), function (el) {
                var value = el.getAttribute(attr);
                if (!seen[attr + " " + value]) { seen[attr + " " + value] = true; pairs.push([attr, value]); }
            });
        });
        return pairs;
    }
    function frames() { return Array.prototype.slice.call(document.querySelectorAll("iframe")); }
    function frameDoc(frame) { try { return frame.contentDocument; } catch (e) { return null; } }
    function applyFrames() {
        var theme = find(current);
        frames().forEach(function (frame) {
            var doc = frameDoc(frame);
            if (!doc || !doc.head) { return; }
            var have = doc.getElementById("theme-style");
            if (theme === THEMES[0]) { if (have) { have.remove(); } return; }
            var css = frameCss(theme, literals(doc));
            if (!have) { have = doc.createElement("style"); have.id = "theme-style"; doc.head.appendChild(have); }
            if (have.textContent !== css) { have.textContent = css; }
        });
    }
    function apply(name) {
        var theme = find(name) || THEMES[0];
        current = theme.name;
        document.documentElement.setAttribute("data-theme", current);
        style.textContent = theme === THEMES[0] ? "" : deckCss(theme, literals(document));
        applyFrames();
        document.dispatchEvent(new CustomEvent("slidetheme", { detail: { name: current } }));
    }
    function set(name) {
        apply(name);
        try { localStorage.setItem(KEY, current); } catch (e) { /* storage unavailable */ }
    }
    document.addEventListener("load", function (e) { if (e.target && e.target.tagName === "IFRAME") { applyFrames(); } }, true);
    document.addEventListener("keydown", function (e) {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) { return; }
        if (e.key === "t" || e.key === "T") { e.preventDefault(); set(next(current)); }
    });
    var names = THEMES.map(function (t) { return t.name; });
    window.HTML_COMMANDS = (window.HTML_COMMANDS || []).concat([{ label: "Next theme", hint: "T · " + names.join(", "), group: "modes", run: function () { set(next(current)); } }]
        .concat(THEMES.map(function (t) {
            return { label: "Theme · " + t.label, group: "modes", run: function () { set(t.name); }, state: function () { return current === t.name; } };
        })));
    window.SlideTheme = {
        names: function () { return names.slice(); },
        active: function () { return current; },
        set: set,
        next: function () { set(next(current)); },
        contrast: function () { return contrastSet(find(current)); }
    };

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
    var chosen = pick(saved, location.search);
    if (chosen !== saved && /[?&]theme=/i.test(location.search)) { set(chosen); } else { apply(chosen); }
})();
