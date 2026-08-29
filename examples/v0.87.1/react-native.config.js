const {
  withNitroGeolocationSwiftPM
} = require("react-native-nitro-geolocation/spm");

const config = {};

module.exports =
  process.env.NITRO_GEOLOCATION_EXAMPLE_USE_COCOAPODS === "1"
    ? config
    : withNitroGeolocationSwiftPM(config);
