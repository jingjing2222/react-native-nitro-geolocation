#include <jni.h>
#include "nitrogeolocationOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitrogeolocation::initialize(vm);
}
