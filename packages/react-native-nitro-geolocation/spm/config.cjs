function withNitroGeolocationSwiftPM(config = {}) {
  const dependencies = config.dependencies ?? {};
  const nitroModules = dependencies["react-native-nitro-modules"] ?? {};
  const platforms = nitroModules.platforms ?? {};

  return {
    ...config,
    dependencies: {
      ...dependencies,
      "react-native-nitro-modules": {
        ...nitroModules,
        platforms: {
          ...platforms,
          ios: null
        }
      }
    }
  };
}

const swiftPMReactNativeConfigSource = `const {
  withNitroGeolocationSwiftPM
} = require("react-native-nitro-geolocation/spm");

module.exports = withNitroGeolocationSwiftPM({});
`;

module.exports = {
  swiftPMReactNativeConfigSource,
  withNitroGeolocationSwiftPM
};
