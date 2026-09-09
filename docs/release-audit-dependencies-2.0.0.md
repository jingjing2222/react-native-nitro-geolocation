# 2.0.0 dependency audit

Last checked 2026-09-10 with:

```sh
yarn npm audit --all --recursive --environment production --json
yarn npm audit --all --recursive --json
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
range. A subsequent all-environment sweep (including development-only roots)
found 62 records, including one additional critical XML-parser advisory.
Compatible development-tool updates reduced the 2026-09-09 all-environment result
to 43 records (0 critical, 10 high, 27 moderate, 6 low). This also updates the pinned
web E2E Vite server to 8.0.16 and refreshes Babel's SystemJS transform, body-parser,
fast-xml-parser, Joi, launch-editor, path-to-regexp, and qs. No React Native,
React, Nitro, or Electron major was changed.

This fixes the reported critical archive-parser and shell-quoting advisories,
and the reported vulnerable versions of Babel, brace expansion, Browserslist,
Ajv, Lodash, Minimatch, Nano ID, PostCSS, React Router, tar, Vite, ws, YAML, and
other eligible transitive dependencies. This is a dated registry snapshot, not
a guarantee against future advisories.

## Final refresh — 2026-09-10

The next registry check reported 47 all-environment records. This included two
Vitest package records for the same advisory, one `smol-toml` record, and a second
unpatched `extract-zip` advisory that was absent from the earlier result.

- Update both packages' development-only Vitest pins from 4.1.5 to 4.1.11,
  including `@vitest/mocker` and the matching Vitest packages. The
  [upstream advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)
  identifies 4.1.11 as the fixed 4.x version. This addresses file reads through
  exposed mocker redirect endpoints; the advisory distinguishes those endpoints
  from Vitest's authenticated browser-mode RPC.
- Update transitive `smol-toml` to 1.7.1, the first patched version for the
  [malformed-TOML denial of service](https://github.com/advisories/GHSA-7w5x-hrqm-74c2).
  Nx 22.7.8 pins 1.6.1 exactly, so a resolution targets that exact descriptor.
  Knip's compatible `^1.6.1` range is deduplicated to the same patched version.

The resulting audit contains **43 production-tree records** (0 critical,
11 high, 26 moderate, 6 low) and **44 all-environment records** (0 critical,
11 high, 27 moderate, 6 low). Neither targeted advisory remains. The extra
high-severity record versus the previous audit is the second `extract-zip`
advisory, not a newly introduced dependency. The registry still lists 2.0.1 as
its latest version and both advisories list no patched release.

Only Vitest's development dependency tree and the transitive TOML parser change
in this refresh; React Native, React, Nitro, and Electron versions are unchanged.

## Remaining records and exposure boundary

| Package | Records | Why it remains / boundary |
| --- | ---: | --- |
| Electron 33.4.11 | 33 | Supplied by `@rozenite/electron-app`; even its 2.4.0 release still declares Electron 33. Moving to a supported Electron major is a separate upstream/integration migration. Used for developer tooling, not bundled into the geolocation runtime. Do not use this audit as approval to load untrusted content in that application. |
| extract-zip 2.0.1 | 2 | Electron installation dependency; the registry's latest release is still affected and both advisories list no patched release. Only install verified artifacts from trusted sources. |
| image-size 1.2.1 | 2 | Metro asset parser; the latest 2.0.2 is also affected, with no patched release in the advisories. Do not process untrusted image fixtures in build infrastructure. |
| decode-uri-component 0.2.2 | 1 | Example navigation's `query-string` dependency. The fixed 0.5 line is ESM while this dependency path uses CommonJS; forcing that cross-version change is not a compatible lockfile refresh. |
| uuid 7.0.3 | 1 | Xcode-project tooling dependency; fixing the advisory requires a newer major and upstream compatibility review. |
| fast-xml-parser 4.5.7 | 1 | The Android CLI's 4.x parser is updated past its critical advisory. A separate moderate advisory still requires 5.7.0 or later; that major migration needs upstream CLI compatibility review. |
| boolean, glob, inflight, rimraf | 4 | Registry deprecation/support notices in the toolchain. These are retained in the total rather than hidden as successful checks. |

Primary advisory references: [extract-zip](https://github.com/advisories/GHSA-jmr9-qjv8-65gv),
[extract-zip symlink writes](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3),
[image-size ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[image-size JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq),
[decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr),
[uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq),
[remaining XML-parser issue](https://github.com/advisories/GHSA-gh4j-gqv2-49f6).

The published `react-native-nitro-geolocation` manifest has peer dependencies
but no `dependencies`. These workspace lockfile overrides do not pin or secure
a consuming application's React Native/toolchain tree. Consumers must audit
their own lockfiles. The remaining warnings are not asserted to be harmless or
fixed; a zero-warning workspace security gate remains unmet.
