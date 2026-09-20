"""Bundle local HTML and CSS assets within an explicit root."""
import base64
import html
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ATTR = re.compile(r'\b(src|href|data-src|data-modal)\s*=\s*([\"\x27])(.*?)\2', re.S)
CSS_URL = re.compile(r'url\(\s*([\"\x27]?)(.*?)\1\s*\)', re.S)
BRIDGE = """<script>
addEventListener('keydown', e => {
  if (parent === window || e.defaultPrevented) return;
  if (e.key === 'Escape') parent.postMessage('slidekit:escape', '*');
  if (e.key !== 'Tab') return;
  const nodes = Array.from(document.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea,select,[tabindex="0"]')).filter(n => !n.inert && n.getClientRects().length);
  if (!nodes.length || (e.shiftKey && document.activeElement === nodes[0]) || (!e.shiftKey && document.activeElement === nodes.at(-1))) {
    e.preventDefault(); parent.postMessage('slidekit:focus-parent', '*');
  }
});
</script>"""


class Bundler:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.cache = {}
        self.assets = set()

    def reference(self, value, owner, parents):
        url = urlsplit(html.unescape(value))
        if url.scheme or url.netloc or not url.path:
            return value
        if url.query:
            raise ValueError(f'Local query parameters are unsupported: {value}')
        target = ((self.root / unquote(url.path).lstrip('/')) if url.path.startswith('/')
                  else owner.parent / unquote(url.path)).resolve()
        result = self.bundle(target, parents)
        self.assets.add(str(target.relative_to(self.root)))
        return result + ('#' + url.fragment if url.fragment else '')

    def css(self, text, owner, parents):
        if re.search(r'@import\s+[\"\x27]', text):
            raise ValueError('Use url() for CSS imports.')
        return CSS_URL.sub(lambda m: 'url("' + self.reference(m[2], owner, parents) + '")', text)

    def bundle(self, path, parents=()):
        path = Path(path).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError(f'Asset outside the allowed root: {path.name}')
        if path in parents:
            raise ValueError(f'Circular asset reference: {path.name}')
        if path in self.cache:
            return self.cache[path]
        content = path.read_bytes()
        chain = parents + (path,)
        mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if path.suffix.lower() in ('.html', '.htm', '.svg'):
            text = content.decode()
            def tag(match):
                source = match[0]
                if source.startswith('<!--'):
                    return source
                if re.search(r'\bsrcset\s*=', source):
                    raise ValueError('srcset requires explicit bundling support. Use src instead.')
                if re.search(r'\btype\s*=\s*([\"\x27])module\1', source):
                    raise ValueError('JavaScript modules require a separate build.')
                if source.lower().startswith('<a ') and 'data-modal=' in source:
                    source = re.sub(r'\bhref=([\"\x27]).*?\1', 'href="#preview"', source)
                source = ATTR.sub(lambda m: f'{m[1]}={m[2]}{self.reference(m[3], path, chain)}{m[2]}', source)
                return re.sub(r'\bstyle=([\"\x27])(.*?)\1',
                              lambda m: 'style=' + m[1] + html.escape(self.css(html.unescape(m[2]), path, chain), quote=True) + m[1], source)
            # Keep scripts intact. Rewrite only HTML tags and CSS blocks.
            parts = re.split(r'(<script\b[^>]*>.*?</script\s*>)', text, flags=re.S | re.I)
            for index, part in enumerate(parts):
                if index % 2:
                    parts[index] = re.sub(r'^<script\b[^>]*>', tag, part, count=1, flags=re.I)
                else:
                    part = re.sub(r'<!--[\s\S]*?-->|<[^>]+>', tag, part)
                    parts[index] = re.sub(r'(<style\b[^>]*>)(.*?)(</style>)',
                                          lambda m: m[1] + self.css(m[2], path, chain) + m[3], part, flags=re.S | re.I)
            text = ''.join(parts)
            if path.suffix.lower() != '.svg':
                text = re.sub(r'</body>', lambda _: BRIDGE + '</body>', text, count=1, flags=re.I) if re.search(r'</body>', text, re.I) else text + BRIDGE
            content = text.encode()
        elif path.suffix.lower() == '.css':
            content = self.css(content.decode(), path, chain).encode()
        uri = 'data:' + mime + ';base64,' + base64.b64encode(content).decode()
        self.cache[path] = uri
        return uri

    def write(self, source, output):
        uri = self.bundle(source)
        payload = base64.b64decode(uri.split(',', 1)[1])
        Path(output).write_bytes(payload)
        return {'bytes': len(payload), 'assets': len(self.assets)}
