import React, { useState } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  clearWatch,
  getCurrentPosition,
  setRNConfiguration,
  watchPosition,
} from 'react-native-nitro-geolocation';

interface BenchmarkStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
  samples: number;
}

interface BenchmarkResults {
  setRNConfiguration?: BenchmarkStats;
  getCurrentPosition?: BenchmarkStats;
  watchPosition?: BenchmarkStats;
}

export default function BenchmarkScreen() {
  const [results, setResults] = useState<BenchmarkResults>({});
  const [running, setRunning] = useState<string | null>(null);

  const calculateStats = (measurements: number[]): BenchmarkStats => {
    if (measurements.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        samples: 0,
      };
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;

    // Standard deviation
    const squaredDiffs = sorted.map(x => Math.pow(x - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev,
      samples: sorted.length,
    };
  };

  const benchmarkSetRNConfiguration = async () => {
    setRunning('setRNConfiguration');
    const iterations = 1000;
    const measurements: number[] = [];

    try {
      // Warmup
      for (let i = 0; i < 10; i++) {
        setRNConfiguration({ skipPermissionRequests: false });
      }

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        setRNConfiguration({
          skipPermissionRequests: false,
          authorizationLevel: 'whenInUse',
          locationProvider: 'auto',
        });
        const end = performance.now();
        measurements.push(end - start);
      }

      const stats = calculateStats(measurements);
      setResults(prev => ({ ...prev, setRNConfiguration: stats }));
      Alert.alert(
        'Success',
        `setRNConfiguration benchmark completed\nAvg: ${stats.avg.toFixed(
          3,
        )}ms`,
      );
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setRunning(null);
    }
  };

  const benchmarkGetCurrentPosition = async () => {
    setRunning('getCurrentPosition');
    const iterations = 10;
    const measurements: number[] = [];

    try {
      // Warmup (1 call)
      await new Promise((resolve, reject) => {
        getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 0,
          enableHighAccuracy: true,
        });
      });

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await new Promise((resolve, reject) => {
          getCurrentPosition(
            () => {
              const end = performance.now();
              measurements.push(end - start);
              resolve(null);
            },
            error => {
              const end = performance.now();
              measurements.push(end - start);
              reject(error);
            },
            {
              timeout: 5000,
              maximumAge: 60000, // Accept cached location
              enableHighAccuracy: true,
            },
          );
        });

        // Wait 500ms between calls
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const stats = calculateStats(measurements);
      setResults(prev => ({ ...prev, getCurrentPosition: stats }));
      Alert.alert(
        'Success',
        `getCurrentPosition benchmark completed\nAvg: ${stats.avg.toFixed(
          1,
        )}ms`,
      );
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setRunning(null);
    }
  };

  const benchmarkWatchPosition = async () => {
    setRunning('watchPosition');
    const targetSamples = 20;
    const measurements: number[] = [];
    let lastUpdate = performance.now();
    let sampleCount = 0;

    return new Promise<void>(resolve => {
      const watchId = watchPosition(
        position => {
          const now = performance.now();
          const latency = now - lastUpdate;

          // Skip first sample (cold start)
          if (sampleCount > 0) {
            measurements.push(latency);
          }

          sampleCount++;
          lastUpdate = now;

          console.log(
            `watchPosition sample ${sampleCount}: ${latency.toFixed(3)}ms`,
          );

          if (sampleCount >= targetSamples) {
            clearWatch(watchId);

            const stats = calculateStats(measurements);
            setResults(prev => ({ ...prev, watchPosition: stats }));
            setRunning(null);

            Alert.alert(
              'Success',
              `watchPosition benchmark completed\nAvg callback interval: ${stats.avg.toFixed(
                0,
              )}ms`,
            );

            resolve();
          }
        },
        error => {
          clearWatch(watchId);
          Alert.alert('Error', error.message);
          setRunning(null);
          resolve();
        },
        {
          enableHighAccuracy: true,
          interval: 1000, // 1 second
          distanceFilter: 0, // Accept any movement
        },
      );
    });
  };

  const renderStats = (name: string, stats: BenchmarkStats) => (
    <View key={name} style={styles.resultContainer}>
      <Text style={styles.resultTitle}>{name}</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Samples:</Text>
          <Text style={styles.statValue}>{stats.samples}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Min:</Text>
          <Text style={styles.statValue}>{stats.min.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Max:</Text>
          <Text style={styles.statValue}>{stats.max.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Avg:</Text>
          <Text style={styles.statValueHighlight}>
            {stats.avg.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Median:</Text>
          <Text style={styles.statValue}>{stats.median.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>P95:</Text>
          <Text style={styles.statValue}>{stats.p95.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>P99:</Text>
          <Text style={styles.statValue}>{stats.p99.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>StdDev:</Text>
          <Text style={styles.statValue}>{stats.stdDev.toFixed(3)}ms</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Nitro Geolocation Benchmarks</Text>
          <Text style={styles.subtitle}>
            Measure real-world performance using performance.now()
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Method Call Overhead</Text>
            <Text style={styles.sectionDescription}>
              Measures JSI method invocation speed (1000 iterations)
            </Text>
            <Button
              title={
                running === 'setRNConfiguration'
                  ? 'Running...'
                  : 'Benchmark setRNConfiguration'
              }
              onPress={benchmarkSetRNConfiguration}
              disabled={running !== null}
              color="#2196F3"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Async Callback Latency</Text>
            <Text style={styles.sectionDescription}>
              End-to-end latency including GPS (10 iterations)
            </Text>
            <Button
              title={
                running === 'getCurrentPosition'
                  ? 'Running...'
                  : 'Benchmark getCurrentPosition'
              }
              onPress={benchmarkGetCurrentPosition}
              disabled={running !== null}
              color="#4CAF50"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continuous Updates</Text>
            <Text style={styles.sectionDescription}>
              Callback interval measurement (20 samples)
            </Text>
            <Button
              title={
                running === 'watchPosition'
                  ? 'Running...'
                  : 'Benchmark watchPosition'
              }
              onPress={benchmarkWatchPosition}
              disabled={running !== null}
              color="#FF9800"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.resultsTitle}>Results</Text>
          {Object.keys(results).length === 0 && (
            <Text style={styles.noResults}>
              No results yet. Run a benchmark to see results.
            </Text>
          )}

          {results.setRNConfiguration &&
            renderStats('setRNConfiguration', results.setRNConfiguration)}
          {results.getCurrentPosition &&
            renderStats('getCurrentPosition', results.getCurrentPosition)}
          {results.watchPosition &&
            renderStats('watchPosition', results.watchPosition)}

          {Object.keys(results).length > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 Interpretation</Text>
              <Text style={styles.infoText}>
                • setRNConfiguration: Should be &lt;0.1ms (JSI direct call)
              </Text>
              <Text style={styles.infoText}>
                • getCurrentPosition: Includes GPS fix time (~50-5000ms)
              </Text>
              <Text style={styles.infoText}>
                • watchPosition: Interval between updates (~1000ms)
              </Text>
              <Text style={styles.infoText}>
                • P95/P99: 95th/99th percentile (tail latency)
              </Text>
              <Text style={styles.infoText}>
                • Lower is better for all metrics
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 24,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  noResults: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 32,
  },
  resultContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statsGrid: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'monospace',
  },
  statValueHighlight: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1565c0',
    marginVertical: 3,
    fontFamily: 'monospace',
  },
});
