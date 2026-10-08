// Bundle a page and every local asset it references into one HTML file, within an explicit root.
//
// Local src, href, data-src and data-modal values, and CSS url() references, become data URIs. A link to a
// local page becomes a preview (data-modal plus href="#preview"), because a browser refuses to open a data
// URL in a new tab. Every bundled HTML page receives the focus bridge, which hands Escape and Tab back to the
// parent window. Assets outside the root, cycles, srcset and module scripts stop the build.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

const ATTR = /\b(src|href|data-src|data-modal)\s*=\s*(["'])(.*?)\2/gs;
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)/gs;
const BRIDGE = `<script>
addEventListener('keydown', e => {
  if (parent === window || e.defaultPrevented) return;
  if (e.key === 'Escape') parent.postMessage('slidekit:escape', '*');
  if (e.key !== 'Tab') return;
  const nodes = Array.from(document.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea,select,[tabindex="0"]')).filter(n => !n.inert && n.getClientRects().length);
  if (!nodes.length || (e.shiftKey && document.activeElement === nodes[0]) || (!e.shiftKey && document.activeElement === nodes.at(-1))) {
    e.preventDefault(); parent.postMessage('slidekit:focus-parent', '*');
  }
});
</script>`;
const MIME: Record<string, string> = {
  ".html": "text/html", ".htm": "text/html", ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".txt": "text/plain", ".md": "text/markdown", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".pdf": "application/pdf",
};

export function unescapeHtml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" })[e as string] ?? _m);
}
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
// The parts of a URL reference, as Python's urlsplit sees them.
export function splitUrl(value: string) {
  const m = /^(?:([a-z][a-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/is.exec(value)!;
  return { scheme: m[1] ?? "", netloc: m[2] ?? "", path: m[3] ?? "", query: m[4] ?? "", fragment: m[5] ?? "" };
}

export class Bundler {
  root: string;
  cache = new Map<string, string>();
  assets = new Set<string>();

  constructor(root: string) {
    this.root = resolve(root);
  }

  static localPage(value: string): boolean {
    const url = splitUrl(unescapeHtml(value));
    return !url.scheme && !url.netloc && /\.html?$/i.test(url.path);
  }

  reference(value: string, owner: string, parents: string[]): string {
    const url = splitUrl(unescapeHtml(value));
    if (url.scheme || url.netloc || !url.path) return value;
    if (url.query) throw new Error(`Local query parameters are unsupported: ${value}`);
    const path = decodeURIComponent(url.path);
    const target = resolve(path.startsWith("/") ? resolve(this.root, path.replace(/^\/+/, "")) : resolve(dirname(owner), path));
    const result = this.bundle(target, parents);
    this.assets.add(relative(this.root, target));
    return result + (url.fragment ? "#" + url.fragment : "");
  }

  css(text: string, owner: string, parents: string[]): string {
    if (/@import\s+["']/.test(text)) throw new Error("Use url() for CSS imports.");
    return text.replace(CSS_URL, (_m, _q, v) => 'url("' + this.reference(v, owner, parents) + '")');
  }

  bundle(path: string, parents: string[] = []): string {
    path = resolve(path);
    if (path !== this.root && !path.startsWith(this.root + sep)) throw new Error(`Asset outside the allowed root: ${path.split(sep).pop()}`);
    if (parents.includes(path)) throw new Error(`Circular asset reference: ${path.split(sep).pop()}`);
    const cached = this.cache.get(path);
    if (cached) return cached;
    let content: Uint8Array = readFileSync(path);
    const chain = [...parents, path];
    const suffix = extname(path).toLowerCase();
    const mime = MIME[suffix] ?? "application/octet-stream";
    if (suffix === ".html" || suffix === ".htm" || suffix === ".svg") {
      let text = Buffer.from(content).toString("utf8");
      const tag = (source: string): string => {
        if (source.startsWith("<!--")) return source;
        if (/\bsrcset\s*=/.test(source)) throw new Error("srcset requires explicit bundling support. Use src instead.");
        if (/\btype\s*=\s*(["'])module\1/.test(source)) throw new Error("JavaScript modules require a separate build.");
        if (source.toLowerCase().startsWith("<a ") && source.includes("data-modal=")) {
          source = source.replace(/\bhref=(["']).*?\1/, 'href="#preview"');
        } else if (source.toLowerCase().startsWith("<a ")) {
          const link = /\bhref=(["'])(.*?)\1/.exec(source);
          if (link && Bundler.localPage(link[2])) {
            const uri = this.reference(link[2], path, chain);
            source = source.slice(0, link.index) + `data-modal="${uri}" data-modal-kind="iframe" href="#preview"` + source.slice(link.index + link[0].length);
          }
        }
        source = source.replace(ATTR, (_m, name, quote, value) => `${name}=${quote}${this.reference(value, path, chain)}${quote}`);
        return source.replace(/\bstyle=(["'])(.*?)\1/g, (_m, quote, value) => "style=" + quote + escapeHtml(this.css(unescapeHtml(value), path, chain)) + quote);
      };
      // Keep scripts intact. Rewrite only HTML tags and CSS blocks.
      const parts = text.split(/(<script\b[^>]*>.*?<\/script\s*>)/gis);
      for (let i = 0; i < parts.length; i += 1) {
        if (i % 2) {
          parts[i] = parts[i].replace(/^<script\b[^>]*>/i, (m) => tag(m));
        } else {
          const rewritten = parts[i].replace(/<!--[\s\S]*?-->|<[^>]+>/g, (m) => tag(m));
          parts[i] = rewritten.replace(/(<style\b[^>]*>)(.*?)(<\/style>)/gis, (_m, open, body, close) => open + this.css(body, path, chain) + close);
        }
      }
      text = parts.join("");
      if (suffix !== ".svg") {
        text = /<\/body>/i.test(text) ? text.replace(/<\/body>/i, () => BRIDGE + "</body>") : text + BRIDGE;
      }
      content = Buffer.from(text, "utf8");
    } else if (suffix === ".css") {
      content = Buffer.from(this.css(Buffer.from(content).toString("utf8"), path, chain), "utf8");
    }
    const uri = "data:" + mime + ";base64," + Buffer.from(content).toString("base64");
    this.cache.set(path, uri);
    return uri;
  }

  write(source: string, output: string): { bytes: number; assets: number } {
    const uri = this.bundle(source);
    const payload = Buffer.from(uri.split(",", 2)[1], "base64");
    writeFileSync(output, payload);
    return { bytes: payload.length, assets: this.assets.size };
  }
}
