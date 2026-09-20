"""Export the runtime and tools into a consumer, or bundle one page into a single file.

    python3 -m htmltools export /path/to/consumer/vendor/html-tools
    python3 -m htmltools bundle page.html page-share.html
"""
import argparse
import json
from pathlib import Path

from htmltools.bundle import Bundler
from htmltools.export import export

ROOT = Path(__file__).resolve().parent.parent


def main(argv=None):
    parser = argparse.ArgumentParser(prog='htmltools', description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest='command', required=True)
    exporter = commands.add_parser('export', help='write the runtime, the tools, and manifest.json into a directory')
    exporter.add_argument('destination', type=Path)
    bundler = commands.add_parser('bundle', help='inline every local asset of a page into one HTML file')
    bundler.add_argument('source', type=Path, help='the page; its parent directory is the asset root')
    bundler.add_argument('output', type=Path)
    args = parser.parse_args(argv)
    if args.command == 'export':
        result = export(ROOT, args.destination)
        print(f"Exported {len(result['files'])} files")
        return 0
    source = args.source.resolve()
    print(json.dumps(Bundler(source.parent).write(source, args.output)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
