# Maestro E2E Tests for Nitro Geolocation

This directory contains E2E tests for the `react-native-nitro-geolocation` module using Maestro.

## Installation

### 1. Install Maestro

**Using mise (recommended for team projects):**
```bash
# Install globally
mise use -g maestro@latest

# Or for this project only
mise use maestro@latest

# Verify installation
maestro --version
```

### 2. Environment Setup

**iOS Simulator:**
```bash
# Ensure Xcode Command Line Tools are installed
xcode-select --install

# Launch simulator
open -a Simulator
```

**Android Emulator:**
```bash
# Ensure Android SDK is installed
# Launch emulator
emulator -avd <your_avd_name>
```

## Running Tests

### Build and Run the App

The app must be running before executing tests:

```bash
# iOS
yarn ios

# Android
yarn android
```

### Run All Tests

```bash
# Run all tests
yarn test:e2e

# Platform-specific
yarn test:e2e:ios
yarn test:e2e:android
```

### Run Individual Tests

```bash
# Permission tests only
yarn test:e2e:permission

# Get current position test
yarn test:e2e:current

# Watch position (continuous tracking) test
yarn test:e2e:watch

# Location simulation test
yarn test:e2e:location

# Compat API test (currently skipped)
yarn test:e2e:compat
```

## Test Files

### `permission-check.yaml`
- Tests location permission check/request functionality
- Verifies permission state changes

### `current-position.yaml`
- Tests `getCurrentPosition()` API
- Verifies one-time location fetch

### `watch-position.yaml`
- Tests `useWatchPosition()` Hook
- Verifies continuous location tracking
- Confirms position updates

### `location-simulation.yaml`
- Tests behavior at different locations
- Simulates locations: San Francisco, New York, Seoul

### `compat-api.yaml`
- Tests `@react-native-community/geolocation` compatibility API
- **Currently minimal**: Due to Maestro bottom tab navigation limitations
- Since Compat API uses the same native module as Default API, testing Default API provides sufficient coverage

### `all-tests.yaml`
- Master flow that runs all tests sequentially

## Location Simulation

Maestro supports location simulation using the `setLocation` command:

```yaml
# Set a specific location
- setLocation:
    latitude: 37.7749
    longitude: -122.4194
```

### Major City Coordinates

```
San Francisco: 37.7749, -122.4194
New York: 40.7128, -74.0060
Seoul: 37.5665, 126.9780
Tokyo: 35.6762, 139.6503
London: 51.5074, -0.1278
```

## CI/CD Integration

### Local Testing First (Recommended)

**For Pull Requests:** Run E2E tests locally and include results in your PR description.

**Why local testing?**
- ⚡ **Faster feedback**: No waiting for CI runners
- 💰 **Cost savings**: macOS CI runners are expensive
- 🐛 **Early detection**: Catch issues before pushing
- 🎯 **Better debugging**: Full access to logs and device

**How to include test results in PRs:**

1. Run tests locally:
   ```bash
   cd examples/v0.81.1
   yarn ios  # or yarn android
   yarn test:e2e
   ```

2. Copy the terminal output

3. Paste in the "E2E Test Results" section of your PR description

4. Include platform and version tested

**Example PR description section:**
```markdown
## E2E Test Results

✅ Run permission-check.yaml
✅ Run current-position.yaml
✅ Run watch-position.yaml
✅ Run location-simulation.yaml

**Platform tested:**
- [x] iOS 17.0
```

### Automated CI (Main Branch Only)

A GitHub Actions workflow runs E2E tests automatically on the `main` branch.

- **Manual trigger**: Actions → E2E Tests → Run workflow
- **Automatic**: Runs on push to `main` branch
- **Not for PRs**: To save time and costs

### Quick CI Setup

The workflow file is at `.github/workflows/e2e-tests.yml`.

To enable CI tests on PRs (not recommended due to cost):

```yaml
on:
  push:
    branches: [main]
  pull_request:  # Add this
    branches: [main]
```

## Writing Tests - Best Practices

### 1. Use testID for Reliable Element Selection

**Why testID?** React Native's Text components don't support partial text matching or wildcards in Maestro. Using `testID` is more reliable.

```yaml
# ✅ Recommended: Use testID
- tapOn:
    id: "get-position-button"
- assertVisible:
    id: "position-info"

# ⚠️ Text matching (works but less reliable)
- tapOn: "Get Position"

# ❌ Wildcards don't work with React Native Text
- assertVisible: "Latitude: 37.7*"  # This will fail!
```

**Add testID in your components:**
```tsx
<View testID="position-info">
  <Text testID="latitude-text">Latitude: {lat}</Text>
  <Text testID="longitude-text">Longitude: {lng}</Text>
</View>
```

### 2. Use extendedWaitUntil for Async Operations

```yaml
# For network requests or location fetching
- extendedWaitUntil:
    visible: "Current Position"
    timeout: 15000  # 15 seconds
```

### 3. Handle Scrolling

```yaml
# Scroll until element is visible
- scrollUntilVisible:
    element: "3. Watch Position (Hook)"
    direction: DOWN
```

### 4. Switch Component Interaction

React Navigation switches and bottom tabs need special handling:

```yaml
# ✅ Use testID for switches
- tapOn:
    id: "watch-toggle-switch"

# ❌ Tapping on label doesn't work
- tapOn: "Enable Watching:"  # Won't toggle the switch
```

## Debugging

### Maestro Studio

Interactive debugging tool:
```bash
maestro studio
```

### Screenshots

Capture screenshots during tests:
```yaml
- takeScreenshot: current-position-result
```

Screenshots are saved to: `~/.maestro/tests/<timestamp>/`

### Logs

View detailed logs:
```bash
maestro test --debug .maestro/test.yaml
```

### View Test Artifacts

```bash
# Open the test results directory
open ~/.maestro/tests

# View the latest test results
open ~/.maestro/tests/$(ls -t ~/.maestro/tests | head -1)
```

## Troubleshooting

### App Not Found
```
Error: App not found
```
**Solution:** Ensure the app is running and `appId` matches the bundle identifier:
- iOS: Check `ios/NitroGeolocationExample.xcodeproj/project.pbxproj`
- Android: Check `android/app/build.gradle` (`applicationId`)

### Element Not Found

**Problem:** Maestro can't find text in React Native Text components

**Solution:** Use `testID` instead of text matching:
```yaml
# Instead of this:
- assertVisible: "Latitude: 37.7"

# Do this:
- assertVisible:
    id: "latitude-text"
```

### Bottom Tab Navigation Fails

**Problem:** `tapOn: "Compat API"` doesn't switch tabs

**Solutions:**
1. Use coordinate-based tapping:
   ```yaml
   - tapOn:
       point: 540,1560
   ```
2. Use swipe gesture:
   ```yaml
   - swipe:
       direction: LEFT
   ```
3. Add `testID` to tabs (may not work with all React Navigation versions)

### Permission Dialog

iOS permission dialogs may require explicit handling:
```yaml
- tapOn:
    text: "Allow"
    optional: true
```

### Location Timeout

Location fetching may take time. Increase timeout:
```yaml
- extendedWaitUntil:
    visible: "Current Position"
    timeout: 30000  # 30 seconds
```

## Known Limitations

1. **Text Matching**: Wildcards and partial text matching don't work reliably with React Native Text components
2. **Bottom Tab Navigation**: React Navigation bottom tabs are difficult to interact with via text/testID in some versions
3. **Switch Components**: Label text doesn't trigger switch toggles; use testID on the Switch itself

## Resources

- [Maestro Documentation](https://maestro.mobile.dev)
- [Maestro Best Practices](https://maestro.mobile.dev/best-practices)
- [React Native Testing Overview](https://reactnative.dev/docs/testing-overview)
- [mise Tool Manager](https://mise.jdx.dev/)
