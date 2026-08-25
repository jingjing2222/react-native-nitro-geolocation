# Install Doctor

`nitro-geolocation doctor` checks a consumer app's installation without
changing any files. It has no `postinstall` hook and never applies native
configuration automatically.

Run it from the React Native app root after installing dependencies and after
generating native projects:

```bash
yarn nitro-geolocation doctor

# npm projects can use the package's local binary
npx --no-install nitro-geolocation doctor
```

The command checks:

- a readable app `package.json`;
- React Native 0.75 or newer;
- a declared `react-native-nitro-modules` dependency;
- Android New Architecture configuration;
- Android coarse and fine location permissions; and
- the iOS `NSLocationWhenInUseUsageDescription` value.

Each failure includes a remediation. The process exits with status `1` when
configuration errors are present and `0` when the project has only passes or
warnings. Missing generated `ios` or `android` directories are warnings because
an Expo prebuild or another native generation step may not have run yet. Rerun
the command after generating them to complete the native checks.

## CI and monorepos

Use `--project` when the app is not the current directory and `--json` for
machine-readable output:

```bash
nitro-geolocation doctor --project apps/mobile --json
```

The JSON report contains `ok`, `project`, `summary`, and the complete `checks`
array. Do not treat warnings as proof that native setup is complete; they are a
signal to rerun the doctor when the native project exists.

## Scope

The doctor validates install-time prerequisites that can be determined from
project files. It does not request device permissions, start location updates,
or prove that a signed native build can receive a position. Keep device-level
happy-path and denial tests in the app's own E2E suite.
