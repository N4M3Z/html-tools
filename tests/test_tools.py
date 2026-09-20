import base64
import json
import tempfile
import unittest
from pathlib import Path

from htmltools.bundle import Bundler
from htmltools.export import export


class ToolsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, text):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        return target

    def test_bundle_fragments_external_css(self):
        source = self.write('talk.html', '<link href="style.css"><iframe src="child.html#scene"></iframe><a href="https://example.com">Web</a>')
        self.write('child.html', '<body><button>Action</button></body>')
        self.write('style.css', 'body{background:url("dot.svg")}')
        self.write('dot.svg', '<svg/>')
        result = Bundler(self.root).bundle(source)
        text = base64.b64decode(result.split(',', 1)[1]).decode()
        self.assertIn('#scene', text)
        self.assertIn('https://example.com', text)
        self.assertNotIn('href="style.css"', text)
        self.assertIn('slidekit:focus-parent', text)

    def test_bundle_cycles(self):
        p = self.write('a.html', '<iframe src="b.html"></iframe>')
        self.write('b.html', '<iframe src="a.html"></iframe>')
        with self.assertRaisesRegex(ValueError, 'Circular'):
            Bundler(self.root).bundle(p)

    def test_bundle_outside_root(self):
        p = self.write('public/a.html', '<img src="../private.txt">')
        self.write('private.txt', 'do not bundle')
        with self.assertRaisesRegex(ValueError, 'outside'):
            Bundler(self.root / 'public').bundle(p)

    def test_export_and_modified_export(self):
        self.write('source/runtime/annotate.js', 'one')
        self.write('source/htmltools/__init__.py', '')
        source, dest = self.root / 'source', self.root / 'dest'
        first = export(source, dest)
        self.assertEqual(export(source, dest), first)
        (dest / 'runtime/annotate.js').write_text('local edit')
        self.write('source/runtime/new.js', 'two')
        with self.assertRaisesRegex(ValueError, 'changed locally'):
            export(source, dest)
        self.assertFalse((dest / 'runtime/new.js').exists())
        self.assertEqual(json.loads((dest / 'manifest.json').read_text()), first)

    def test_export_unmanaged_collision(self):
        self.write('source/runtime/annotate.js', 'new')
        self.write('dest/runtime/annotate.js', 'existing')
        with self.assertRaisesRegex(ValueError, 'Unmanaged'):
            export(self.root / 'source', self.root / 'dest')

    def test_export_consumer_folders(self):
        self.write('source/runtime/deck.js', 'deck')
        self.write('source/slidekit/parity.py', 'parity')
        self.write('source/htmltools/export.py', 'not this one')
        result = export(self.root / 'source', self.root / 'dest', folders=('runtime', 'slidekit'))
        self.assertEqual(sorted(result['files']), ['runtime/deck.js', 'slidekit/parity.py'])

    def test_bundle_inline_css(self):
        p = self.write('talk.html', '<body style="background:url(dot.svg)"></body>')
        self.write('dot.svg', '<svg/>')
        result = base64.b64decode(Bundler(self.root).bundle(p).split(',', 1)[1]).decode()
        self.assertIn('data:image/svg+xml', result)

    def test_bundle_rejects_unsupported_asset_loading(self):
        for markup in ['<script type="module" src="app.js"></script>', '<img srcset="one.png 1x, two.png 2x">']:
            p = self.write('talk.html', markup)
            with self.assertRaises(ValueError):
                Bundler(self.root).bundle(p)


if __name__ == '__main__':
    unittest.main()
