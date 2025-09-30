package com.margelo.nitro.nitrogeolocation
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
