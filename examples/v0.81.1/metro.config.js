const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');
const { withMetroConfig } = require('react-native-monorepo-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

module.exports = withMetroConfig(config, {
  root: path.resolve(__dirname, '../..'),
  dirname: __dirname,
});
