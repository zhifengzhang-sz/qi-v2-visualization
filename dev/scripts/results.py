#!/usr/bin/env python3
"""The results this project takes (results.lock): their files fetched, and a set found for the chart.

    python3 dev/scripts/results.py fetch       # make results-fetch
    python3 dev/scripts/results.py set NAME    # a set's file and its scale, on one line, for the make targets
    python3 dev/scripts/results.py sets        # every set's name, one a line (make chart-static)

fetch takes the files of the image the lock names, by its digest, with crane, into .cache/results/<tag>/, each checked
against the lock's sha256 and size. A file already there and right is left alone; a wrong file stops it, with its name.
The image is public: it needs no login and no Docker. A set is one of the lock's
assets, by its name without .json. Standard library only, with crane from the shell.
"""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]


def lock():
    return json.loads((ROOT / 'results.lock').read_text(encoding='utf-8'))


def folder(results):
    return ROOT / '.cache' / 'results' / results['tag']


def right(path, asset):
    return path.stat().st_size == asset['size'] and hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256']


def shown(path):
    return path.relative_to(ROOT)


def take(results, names, into):
    """The named files out of the image, by its digest: each checked in a folder of its own, then moved to its place."""
    with tempfile.TemporaryDirectory(dir=into) as work:
        tar = pathlib.Path(work) / 'image.tar'
        r = subprocess.run(['crane', 'export', results['image'], str(tar)], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f'results-fetch: cannot take {results["image"]}: {r.stderr.strip()}')
        with tarfile.open(tar) as image:
            held = {m.name: m for m in image.getmembers() if m.isfile()}
            for name in names:
                if name not in held:
                    sys.exit(f'results-fetch: {name}: not in the image')
                got = pathlib.Path(work) / name
                with image.extractfile(held[name]) as source, got.open('wb') as target:
                    shutil.copyfileobj(source, target)
                if not right(got, results['assets'][name]):
                    sys.exit(f'results-fetch: {name}: the image gives another file than results.lock names')
                os.replace(got, into / name)


def fetch():
    results = lock()
    into = folder(results)
    assets = results['assets']
    plain = [n for n, a in assets.items() if not a['bare'] or a['files'] != [n]]
    if plain:
        sys.exit(f'results-fetch: {", ".join(plain)}: results.lock names more than one bare file')
    into.mkdir(parents=True, exist_ok=True)
    there = [n for n in assets if (into / n).exists()]
    wrong = [n for n in there if not right(into / n, assets[n])]
    if wrong:
        sys.exit(f'results-fetch: {", ".join(str(shown(into / n)) for n in wrong)}: '
                 'a wrong file, not the one results.lock names: nothing fetched')
    missing = [n for n in assets if n not in there]
    if missing:
        take(results, missing, into)
    print(f'results-fetch: {shown(into)}: {len(missing)} fetched, {len(there)} there and right')


def found(name):
    results = lock()
    asset = results['assets'].get(f'{name}.json')
    if asset is None:
        sets = ', '.join(n.removesuffix('.json') for n in results['assets'])
        sys.exit(f'chart: SET={name}: results.lock has no such set: it has {sets}')
    path = folder(results) / f'{name}.json'
    if not path.exists():
        sys.exit(f'chart: the set {name} is not fetched: make results-fetch')
    if not right(path, asset):
        sys.exit(f'chart: {shown(path)}: a wrong file, not the one results.lock names')
    print(path, asset['scale'])


def main():
    args = sys.argv[1:]
    if args == ['fetch']:
        fetch()
    elif len(args) == 2 and args[0] == 'set':
        found(args[1])
    elif args == ['sets']:
        print('\n'.join(n.removesuffix('.json') for n in lock()['assets']))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
