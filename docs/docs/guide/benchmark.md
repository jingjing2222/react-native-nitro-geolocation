# Benchmark

This app benchmarks the performance difference between `react-native-nitro-geolocation` and `@react-native-community/geolocation`.

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/benchmark.gif)

## 📊 Benchmark Results

**Test Environment:**
- Device: iPhone 14 Pro
- React Native: 0.81.4
- Test: 1000 iterations × 5 runs of `getCurrentPosition` with cached location (measuring pure bridge/JSI latency)

### Results

| Metric | Nitro | Community | Improvement |
|--------|-------|-----------|-------------|
| **Average** | 0.019ms | 0.436ms | **22.95x faster** |
| **Median** | 0.017ms | 0.045ms | 62.2% faster |
| **Min** | 0.014ms | 0.034ms | 58.8% faster |
| **Max** | 1.007ms | 10.577ms | 90.5% faster |
| **P95** | 0.025ms | 6.434ms | **257.4x faster** |
| **P99** | 0.031ms | 7.271ms | **234.5x faster** |
| **Std Dev** | 0.032ms | 1.545ms | 98.0% more stable |
| **Samples** | 1000 | 1000 | - |

### Why is Nitro faster?

1. **Zero Queue Overhead**: Cached location responses return immediately without any dispatch queue overhead
2. **Direct JSI Calls**: No JSON serialization or async bridge crossing
3. **Optimized Architecture**: Fast path for cached responses, queue-free delegate callbacks
