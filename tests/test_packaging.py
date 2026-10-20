"""Verify the Pages artifact contains the mountain viewer and its dependencies."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]


class ResourceLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img') and attrs.get('src'):
            self.links.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.links.append(attrs['href'])


class PackagingTests(unittest.TestCase):
    def test_pages_artifact_is_complete_and_excludes_local_workspace_files(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'site'
            subprocess.run([sys.executable, str(ROOT / 'scripts/package_site.py'),
                            '--output', str(output)], check=True, capture_output=True)
            self.assertTrue((output / 'data/trails/whistler.geojson').is_file())
            self.assertTrue((output / 'assets/mountain-icons/LICENSE').is_file())
            self.assertFalse((output / 'output').exists())
            self.assertFalse((output / '.git').exists())
            self.assertFalse((output / 'scripts').exists())
            parser = ResourceLinks()
            parser.feed((output / 'mountain.html').read_text())
            for link in parser.links:
                url = urlsplit(link)
                if not url.scheme:
                    self.assertFalse(url.path.startswith('/'), link)
                    self.assertTrue((output / unquote(url.path)).is_file(), link)
            # Resolve relative imports and texture/data URLs from the published
            # module locations, just as the /snow-scout/ Pages deployment does.
            for module in (output / 'js').glob('*.js'):
                for link in re.findall(r"(?:from\s+|new URL\()'([^']+)'", module.read_text()):
                    if link.startswith('.'):
                        path = module.parent / unquote(urlsplit(link).path)
                        self.assertTrue(path.is_file(), f'{module.name}: {link}')


if __name__ == '__main__':
    unittest.main()
