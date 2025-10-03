if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/kimhyeongjeong/.gradle/caches/8.14.3/transforms/197577c9406afbc5eba8e8fb58fb092a/transformed/hermes-android-0.81.1-debug/prefab/modules/libhermes/libs/android.x86/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/kimhyeongjeong/.gradle/caches/8.14.3/transforms/197577c9406afbc5eba8e8fb58fb092a/transformed/hermes-android-0.81.1-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

