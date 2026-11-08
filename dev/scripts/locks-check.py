#!/usr/bin/env python3
"""This project's own lock for make locks-check: results.lock against the tags of the image it names on GHCR (crane ls,
crane digest; the image is public, read with no login): outdated when the image has a tag after the one it names, or
its tag now names another image than the digest it names. flake.lock's inputs are checked by the kit's `kit locks`,
which make locks-check runs first. Prints one line; changes nothing; exit 1 only when the image could not be asked.
Standard library only, with crane from the shell.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f'{" ".join(cmd[:2])}: {(r.stderr or r.stdout).strip().splitlines()[-1:]}')
    return r.stdout


def results():
    lock = json.loads((ROOT / 'results.lock').read_text(encoding='utf-8'))
    tag = lock['tag']
    image, digest = lock['image'].split('@')
    # the tags are versions, MAJOR.MINOR.PATCH, sorted by their numbers
    number = lambda t: tuple(int(n) for n in t.split('.'))
    tags = sorted((t for t in run(['crane', 'ls', image]).split() if re.fullmatch(r'\d+\.\d+\.\d+', t)), key=number)
    newer = [t for t in tags if number(t) > number(tag)]
    now = run(['crane', 'digest', f'{image}:{tag}']).strip() if tag in tags else None
    update = 'write its tag, its digest (crane digest IMAGE:TAG) and its assets in results.lock'
    return (f'results.lock: outdated: names {tag}, the image has {", ".join(newer)}: {update}') if newer else (
        f'results.lock: outdated: names {tag}, which the image does not have') if now is None else (
        f'results.lock: outdated: {tag} now names {now}, the lock {digest}: {update}') if now != digest else (
        f'results.lock: current ({tag})')


def main():
    try:
        print(results())
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as e:
        print(f'results.lock: could not be asked ({e})')
        sys.exit(1)


if __name__ == '__main__':
    main()
