package com.margelo.nitro.nitrogeolocation

import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroGeolocation : HybridNitroGeolocationSpec() {
    override fun multiply(a: Double, b: Double): Double {
        return a * b
    }
    override fun addition(a: Double, b: Double): Double {
        return a + b
    }
    override fun subtraction(a: Double, b: Double): Double {
        return a - b
    }
    override fun division(a: Double, b: Double): Double {
        return a - b
    }
    override fun test(a: Double, b: Double): Double {
        return a + b
    }
}
