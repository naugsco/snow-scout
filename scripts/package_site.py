#!/usr/bin/env python3
"""Package the public static site without local tools, logs, or configuration."""
import argparse
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    output = parser.parse_args().output.resolve()
    files = [ROOT / name for name in ('index.html', 'history.html', 'styles.css')]
    files += sorted((ROOT / 'js').glob('*.js'))
    files += sorted((ROOT / 'data').glob('resort-*.json'))
    files += sorted((ROOT / 'ski-webcams').glob('*.json'))
    for source in files:
        if not source.is_file():
            raise FileNotFoundError(source)
    output.mkdir(parents=True, exist_ok=False)
    for source in files:
        destination = output / source.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    (output / '.nojekyll').touch()
    print(f'Packaged {len(files)} public files in {output}')


if __name__ == '__main__':
    main()
