"""Export managed files. Refuse local edits before writing any file.

The manifest at `<destination>/manifest.json` records a sha256 digest per exported file.
A consumer that edits an exported file stops the next export until it reverts the edit.
"""
import hashlib
import json
from pathlib import Path

FOLDERS = ('runtime', 'htmltools')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def export(source, destination, folders=FOLDERS):
    """Copy the `.py`, `.js` and `.css` files of `folders` under `source` into `destination`."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    manifest = destination / 'manifest.json'
    prior = json.loads(manifest.read_text())['files'] if manifest.exists() else {}
    files = {str(path.relative_to(source)): path.read_bytes()
             for folder in folders
             for path in (source / folder).glob('*') if path.suffix in ('.py', '.js', '.css')}
    for name, expected in prior.items():
        target = (destination / name).resolve()
        if not target.is_relative_to(destination):
            raise ValueError('Invalid export manifest path')
        if not target.is_file() or digest(target.read_bytes()) != expected:
            raise ValueError(f'Export changed locally: {name}')
    for name, data in files.items():
        target = destination / name
        if target.exists() and name not in prior and target.read_bytes() != data:
            raise ValueError(f'Unmanaged file exists: {name}')
    if set(prior) - set(files):
        raise ValueError('Source files were removed. Review the export before updating it.')
    for name, data in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    result = {'version': 1, 'files': {name: digest(data) for name, data in sorted(files.items())}}
    manifest.write_text(json.dumps(result, indent=2) + '\n')
    return result
