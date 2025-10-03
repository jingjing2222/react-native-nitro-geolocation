if(NOT TARGET react-native-nitro-modules::NitroModules)
add_library(react-native-nitro-modules::NitroModules SHARED IMPORTED)
set_target_properties(react-native-nitro-modules::NitroModules PROPERTIES
    IMPORTED_LOCATION "/Users/kimhyeongjeong/Desktop/code/react-native-nitro-geolocation/example/node_modules/react-native-nitro-modules/android/build/intermediates/cxx/Debug/6o3p684e/obj/armeabi-v7a/libNitroModules.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/kimhyeongjeong/Desktop/code/react-native-nitro-geolocation/example/node_modules/react-native-nitro-modules/android/build/headers/nitromodules"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

