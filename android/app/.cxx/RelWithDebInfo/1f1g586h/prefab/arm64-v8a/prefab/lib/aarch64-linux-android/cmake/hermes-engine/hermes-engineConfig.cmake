if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/Users/emmyjw/.gradle/caches/9.0.0/transforms/95835c6ef9e56ec8bc885a4cb2d471e5/transformed/jetified-hermes-android-250829098.0.9-release/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/emmyjw/.gradle/caches/9.0.0/transforms/95835c6ef9e56ec8bc885a4cb2d471e5/transformed/jetified-hermes-android-250829098.0.9-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

