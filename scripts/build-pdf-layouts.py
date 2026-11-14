"""Generate local PDF layouts from the static reader pages, or verify them with --check."""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent.parent


class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            self.images.append(dict(attrs))


def layout(number):
    folder = ROOT / 'issues' / str(number)
    source = (folder / 'data.js').read_text()
    issue = json.loads(source[source.index('{'):].rstrip(';\n '))
    assets, indices, pages = [], {}, []
    for page in issue['pages']:
        parser = Images()
        parser.feed((folder / page['file']).read_text())
        if not parser.images:
            raise ValueError(f'Issue {number}, {page["file"]}: no image layers')
        layers = []
        for image in parser.images:
            url = image['data-media-src']
            if url not in issue['localAssets']:
                raise ValueError(f'No local-file metadata for {url}')
            style = dict(part.split(':', 1) for part in image['style'].split(';') if ':' in part)
            if style.get('position') != 'absolute':
                raise ValueError(f'Unsupported image layout in issue {number}')
            values = [float(style[key].removesuffix('px')) for key in ('left', 'top', 'width', 'height')]
            if values[2] <= 0 or values[3] <= 0:
                raise ValueError(f'Invalid image size in issue {number}')
            if url not in indices:
                indices[url] = len(assets)
                assets.append(url)
            layers.append([indices[url], *values])
        pages.append(layers)
    return {'issue': number, 'width': issue['width'], 'height': issue['height'], 'assets': assets, 'pages': pages}


if __name__ == '__main__':
    check = '--check' in sys.argv
    for number in range(1, 127):
        path = ROOT / 'issues' / str(number) / 'pdf-pages.js'
        data = layout(number)
        current = json.loads(path.read_text().split(']=', 1)[1].rstrip(';\n ')) if path.exists() else {}
        if check:
            if any(current.get(key) != value for key, value in data.items()):
                raise SystemExit(f'PDF layout needs rebuilding: issue {number}')
        else:
            current.update(data)
            path.write_text('(window.CinefexPDFLayouts ||= {})[' + str(number) + ']=' + json.dumps(current, separators=(',', ':')) + ';\n')
    print('PDF layouts verified for issues 1–126.' if check else 'PDF layouts rebuilt for issues 1–126.')
