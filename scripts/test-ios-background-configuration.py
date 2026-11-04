#!/usr/bin/env python3
"""Run fast host unit tests on production methods using CoreLocation doubles.

Actual app delivery is tested by examples/v0.81.1/scripts/test-issue-224-ios.mjs.
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / 'packages/react-native-nitro-geolocation/ios/NitroGeolocation.swift')
args = parser.parse_args()


def method(source, name):
    start = source.index('    ', source.rfind('\n', 0, source.index('func ' + name + '(')))
    opening = source.index('{', start)
    depth = 1
    end = opening + 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[start:end]


source = args.source.read_text()
names = ['setConfiguration', 'requestPermission', 'initializeLocationManagerIfNeeded',
         'initializeLocationManagerOnMainIfNeeded', 'determineAuthorizationLevel',
         'requestSystemPermission', 'enableBackgroundLocationUpdatesIfNeeded']
methods = '\n\n'.join(method(source, name) for name in names)
methods += '\n' + method((ROOT / 'packages/react-native-nitro-geolocation/ios/NitroGeolocation+CurrentPosition.swift').read_text(), 'runLocationOperationOnMain')
harness = (ROOT / 'tests/ios/IOSBackgroundConfigurationContract.swift').read_text().replace('// PRODUCTION_METHODS', methods)
env = dict(os.environ)
env.setdefault('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer')
with tempfile.TemporaryDirectory(prefix='nitro-background-') as directory:
    swift = Path(directory) / 'Contract.swift'
    binary = Path(directory) / 'contract'
    swift.write_text(harness)
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', str(swift), '-o', str(binary)], env=env, check=True)
    raise SystemExit(subprocess.run([str(binary)], env=env).returncode)
