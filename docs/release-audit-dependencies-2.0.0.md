# 2.0.0 dependency audit

Checked 2026-09-09 with:

```sh
yarn npm audit --all --recursive --environment production --json
```

`--all` matters: the private root has no production dependencies, so auditing
only the root produces a misleading empty result. This command covers all
workspace dependency trees, including examples, documentation, and development
tools, not just the published geolocation package.

## Remediation

The initial result contained 117 advisory/deprecation records (2 critical,
58 high, 48 moderate, 9 low). Re-resolving affected packages within existing
ranges, plus narrowly scoped same-major overrides for Ajv, Lodash, and Minimatch,
reduced this to 42 records (0 critical, 10 high, 26 moderate, 6 low).
The lockfile also refreshes the documentation router through its existing 7.x
range. No React Native, React, Nitro, or Electron major was changed.

This fixes the reported critical archive-parser and shell-quoting advisories,
and the reported vulnerable versions of Babel, brace expansion, Browserslist,
Ajv, Lodash, Minimatch, Nano ID, PostCSS, React Router, tar, Vite, ws, YAML, and
other eligible transitive dependencies. This is a dated registry snapshot, not
a guarantee against future advisories.

## Remaining records and exposure boundary

| Package | Records | Why it remains / boundary |
| --- | ---: | --- |
| Electron 33.4.11 | 33 | Supplied by `@rozenite/electron-app`; even its 2.4.0 release still declares Electron 33. Moving to a supported Electron major is a separate upstream/integration migration. Used for developer tooling, not bundled into the geolocation runtime. Do not use this audit as approval to load untrusted content in that application. |
| extract-zip 2.0.1 | 1 | Electron installation dependency; the registry's latest release is still affected and the advisory lists no patched release. Only install verified artifacts from trusted sources. |
| image-size 1.2.1 | 2 | Metro asset parser; the latest 2.0.2 is also affected, with no patched release in the advisories. Do not process untrusted image fixtures in build infrastructure. |
| decode-uri-component 0.2.2 | 1 | Example navigation's `query-string` dependency. The fixed 0.5 line is ESM while this dependency path uses CommonJS; forcing that cross-version change is not a compatible lockfile refresh. |
| uuid 7.0.3 | 1 | Xcode-project tooling dependency; fixing the advisory requires a newer major and upstream compatibility review. |
| boolean, glob, inflight, rimraf | 4 | Registry deprecation/support notices in the toolchain. These are retained in the total rather than hidden as successful checks. |

Primary advisory references: [extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv),
[image-size ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[image-size JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq),
[decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr),
[uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

The published `react-native-nitro-geolocation` manifest has peer dependencies
but no `dependencies`. These workspace lockfile overrides do not pin or secure
a consuming application's React Native/toolchain tree. Consumers must audit
their own lockfiles. The remaining warnings are not asserted to be harmless or
fixed; a zero-warning workspace security gate remains unmet.
