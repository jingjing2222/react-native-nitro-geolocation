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
import Geolocation from '@react-native-community/geolocation';

// Polyfill for performance.now() type
declare const performance: {
  now: () => number;
};

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

interface LibraryResults {
  setRNConfiguration?: BenchmarkStats;
  getCurrentPosition?: BenchmarkStats;
  watchPosition?: BenchmarkStats;
}

interface BenchmarkResults {
  nitro?: LibraryResults;
  community?: LibraryResults;
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

  const runSetRNConfigBenchmark = async (
    fn: (config: any) => void,
  ): Promise<BenchmarkStats> => {
    const iterations = 1000;
    const measurements: number[] = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      fn({ skipPermissionRequests: false });
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        locationProvider: 'auto',
      });
      const end = performance.now();
      measurements.push(end - start);
    }

    return calculateStats(measurements);
  };

  const runGetCurrentPositionBenchmark = async (
    fn: (
      success: (position: any) => void,
      error: (error: any) => void,
      options?: any,
    ) => void,
  ): Promise<BenchmarkStats> => {
    const iterations = 10;
    const measurements: number[] = [];

    // Warmup (1 call)
    await new Promise((resolve, reject) => {
      fn(resolve, reject, {
        timeout: 5000,
        maximumAge: 0,
        enableHighAccuracy: true,
      });
    });

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await new Promise(resolve => {
        fn(
          () => {
            const end = performance.now();
            measurements.push(end - start);
            resolve(null);
          },
          () => {
            const end = performance.now();
            measurements.push(end - start);
            resolve(null);
          },
          {
            timeout: 5000,
            maximumAge: 60000, // Accept cached location
            enableHighAccuracy: true,
          },
        );
      });

      // Wait between calls
      await new Promise<void>(resolve => setTimeout(resolve, 500));
    }

    return calculateStats(measurements);
  };

  const runWatchPositionBenchmark = async (
    watchFn: (
      success: (position: any) => void,
      error: (error: any) => void,
      options?: any,
    ) => number,
    clearFn: (watchId: number) => void,
    label: string,
  ): Promise<BenchmarkStats> => {
    const targetSamples = 20;
    const measurements: number[] = [];
    let lastUpdate = performance.now();
    let sampleCount = 0;

    await new Promise<void>(resolve => {
      const watchId = watchFn(
        () => {
          const now = performance.now();
          const latency = now - lastUpdate;

          // Skip first sample (cold start)
          if (sampleCount > 0) {
            measurements.push(latency);
          }

          sampleCount++;
          lastUpdate = now;

          console.log(
            `${label} watchPosition sample ${sampleCount}: ${latency.toFixed(
              2,
            )}ms`,
          );

          if (sampleCount >= targetSamples) {
            clearFn(watchId);
            resolve();
          }
        },
        error => {
          clearFn(watchId);
          throw error;
        },
        {
          enableHighAccuracy: true,
          interval: 1000,
          distanceFilter: 0, // Accept any movement
        },
      );
    });

    return calculateStats(measurements);
  };

  const benchmarkNitro = async () => {
    setRunning('nitro');
    // 1. setRNConfiguration
    const setRNConfigStats = await runSetRNConfigBenchmark(setRNConfiguration);

    // 2. getCurrentPosition
    const getCurrentStats = await runGetCurrentPositionBenchmark(
      getCurrentPosition,
    );

    // 3. watchPosition
    const watchStats = await runWatchPositionBenchmark(
      watchPosition,
      clearWatch,
      'Nitro',
    );

    setResults(prev => ({
      ...prev,
      nitro: {
        setRNConfiguration: setRNConfigStats,
        getCurrentPosition: getCurrentStats,
        watchPosition: watchStats,
      },
    }));

    Alert.alert(
      'Success',
      `Nitro Benchmark Completed\n\n` +
        `setRNConfiguration: ${setRNConfigStats.avg.toFixed(3)}ms\n` +
        `getCurrentPosition: ${getCurrentStats.avg.toFixed(2)}ms\n` +
        `watchPosition: ${watchStats.avg.toFixed(1)}ms`,
    );
  };

  const benchmarkCommunity = async () => {
    setRunning('community');

    // 1. setRNConfiguration
    const setRNConfigStats = await runSetRNConfigBenchmark(
      Geolocation.setRNConfiguration,
    );

    // 2. getCurrentPosition
    const getCurrentStats = await runGetCurrentPositionBenchmark(
      Geolocation.getCurrentPosition,
    );

    // 3. watchPosition
    const watchStats = await runWatchPositionBenchmark(
      Geolocation.watchPosition,
      Geolocation.clearWatch,
      'Community',
    );

    setResults(prev => ({
      ...prev,
      community: {
        setRNConfiguration: setRNConfigStats,
        getCurrentPosition: getCurrentStats,
        watchPosition: watchStats,
      },
    }));

    Alert.alert(
      'Success',
      `Community Benchmark Completed\n\n` +
        `setRNConfiguration: ${setRNConfigStats.avg.toFixed(3)}ms\n` +
        `getCurrentPosition: ${getCurrentStats.avg.toFixed(2)}ms\n` +
        `watchPosition: ${watchStats.avg.toFixed(1)}ms`,
    );
  };

  const renderMethodStats = (
    methodName: string,
    benchmarkStats: BenchmarkStats,
  ) => (
    <View key={methodName} style={styles.methodSection}>
      <Text style={styles.methodTitle}>{methodName}</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Avg:</Text>
          <Text style={styles.statValueHighlight}>
            {benchmarkStats.avg.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Min:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.min.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Max:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.max.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Median:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.median.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>P95:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.p95.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>P99:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.p99.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>StdDev:</Text>
          <Text style={styles.statValue}>
            {benchmarkStats.stdDev.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Samples:</Text>
          <Text style={styles.statValue}>{benchmarkStats.samples}</Text>
        </View>
      </View>
    </View>
  );

  const renderLibraryStats = (library: string, stats: LibraryResults) => (
    <View key={library} style={styles.resultContainer}>
      <Text style={styles.resultTitle}>
        {library === 'nitro'
          ? 'Nitro Geolocation'
          : '@react-native-community/geolocation'}
      </Text>

      {stats.setRNConfiguration &&
        renderMethodStats('setRNConfiguration', stats.setRNConfiguration)}
      {stats.getCurrentPosition &&
        renderMethodStats('getCurrentPosition', stats.getCurrentPosition)}
      {stats.watchPosition &&
        renderMethodStats('watchPosition', stats.watchPosition)}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Geolocation Library Comparison</Text>
          <Text style={styles.subtitle}>
            Nitro vs @react-native-community/geolocation
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Run Full Benchmark</Text>
            <Text style={styles.sectionDescription}>
              Test all 3 methods: 1k setRNConfig, 10 getCurrentPos, 20 watchPos
              samples
            </Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonContainer}>
                <Button
                  title={
                    running === 'nitro' ? 'Running...' : 'Nitro Geolocation'
                  }
                  onPress={benchmarkNitro}
                  disabled={running !== null}
                  color="#2196F3"
                />
              </View>
              <View style={styles.buttonContainer}>
                <Button
                  title={
                    running === 'community'
                      ? 'Running...'
                      : '@RN Community Geolocation'
                  }
                  onPress={benchmarkCommunity}
                  disabled={running !== null}
                  color="#4CAF50"
                />
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.resultsTitle}>Results</Text>
          {Object.keys(results).length === 0 && (
            <Text style={styles.noResults}>
              No results yet. Run a benchmark to see results.
            </Text>
          )}

          {results.nitro && renderLibraryStats('nitro', results.nitro)}
          {results.community &&
            renderLibraryStats('community', results.community)}

          {/* Comparison Summary */}
          {results.nitro && results.community && (
            <View style={styles.comparisonContainer}>
              <Text style={styles.comparisonMainTitle}>
                📊 Performance Comparison
              </Text>

              {results.nitro.setRNConfiguration &&
                results.community.setRNConfiguration && (
                  <View style={styles.comparisonBox}>
                    <Text style={styles.comparisonTitle}>
                      setRNConfiguration
                    </Text>
                    <Text style={styles.comparisonText}>
                      Nitro: {results.nitro.setRNConfiguration.avg.toFixed(3)}ms
                      vs Community:{' '}
                      {results.community.setRNConfiguration.avg.toFixed(3)}ms
                      {'\n'}
                      {results.nitro.setRNConfiguration.avg <
                      results.community.setRNConfiguration.avg ? (
                        <Text style={styles.faster}>
                          ⚡{' '}
                          {(
                            ((results.community.setRNConfiguration.avg -
                              results.nitro.setRNConfiguration.avg) /
                              results.community.setRNConfiguration.avg) *
                            100
                          ).toFixed(1)}
                          % faster
                        </Text>
                      ) : (
                        <Text style={styles.slower}>
                          🐌{' '}
                          {(
                            ((results.nitro.setRNConfiguration.avg -
                              results.community.setRNConfiguration.avg) /
                              results.community.setRNConfiguration.avg) *
                            100
                          ).toFixed(1)}
                          % slower
                        </Text>
                      )}
                    </Text>
                  </View>
                )}

              {results.nitro.getCurrentPosition &&
                results.community.getCurrentPosition && (
                  <View style={styles.comparisonBox}>
                    <Text style={styles.comparisonTitle}>
                      getCurrentPosition
                    </Text>
                    <Text style={styles.comparisonText}>
                      Nitro: {results.nitro.getCurrentPosition.avg.toFixed(2)}ms
                      vs Community:{' '}
                      {results.community.getCurrentPosition.avg.toFixed(2)}ms
                      {'\n'}
                      {results.nitro.getCurrentPosition.avg <
                      results.community.getCurrentPosition.avg ? (
                        <Text style={styles.faster}>
                          ⚡{' '}
                          {(
                            ((results.community.getCurrentPosition.avg -
                              results.nitro.getCurrentPosition.avg) /
                              results.community.getCurrentPosition.avg) *
                            100
                          ).toFixed(1)}
                          % faster
                        </Text>
                      ) : (
                        <Text style={styles.slower}>
                          🐌{' '}
                          {(
                            ((results.nitro.getCurrentPosition.avg -
                              results.community.getCurrentPosition.avg) /
                              results.community.getCurrentPosition.avg) *
                            100
                          ).toFixed(1)}
                          % slower
                        </Text>
                      )}
                    </Text>
                  </View>
                )}

              {results.nitro.watchPosition &&
                results.community.watchPosition && (
                  <View style={styles.comparisonBox}>
                    <Text style={styles.comparisonTitle}>watchPosition</Text>
                    <Text style={styles.comparisonText}>
                      Nitro: {results.nitro.watchPosition.avg.toFixed(1)}ms vs
                      Community:{' '}
                      {results.community.watchPosition.avg.toFixed(1)}ms
                      {'\n'}
                      {results.nitro.watchPosition.avg <
                      results.community.watchPosition.avg ? (
                        <Text style={styles.faster}>
                          ⚡{' '}
                          {(
                            ((results.community.watchPosition.avg -
                              results.nitro.watchPosition.avg) /
                              results.community.watchPosition.avg) *
                            100
                          ).toFixed(1)}
                          % faster
                        </Text>
                      ) : (
                        <Text style={styles.slower}>
                          🐌{' '}
                          {(
                            ((results.nitro.watchPosition.avg -
                              results.community.watchPosition.avg) /
                              results.community.watchPosition.avg) *
                            100
                          ).toFixed(1)}
                          % slower
                        </Text>
                      )}
                    </Text>
                  </View>
                )}
            </View>
          )}

          {Object.keys(results).length > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 Interpretation</Text>
              <Text style={styles.infoText}>
                • setRNConfiguration: Sync method call overhead
              </Text>
              <Text style={styles.infoText}>
                • getCurrentPosition: Async callback latency (includes GPS)
              </Text>
              <Text style={styles.infoText}>
                • watchPosition: Update interval measurement
              </Text>
              <Text style={styles.infoText}>
                • P95/P99: 95th/99th percentile (tail latency)
              </Text>
              <Text style={styles.infoText}>
                • Nitro JSI = Direct C++ calls, Bridge = Async message passing
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
    marginBottom: 16,
  },
  mockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  mockLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonContainer: {
    flex: 1,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  methodSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
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
  comparisonContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  comparisonMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  comparisonBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 4,
  },
  comparisonText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  faster: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  slower: {
    color: '#F44336',
    fontWeight: '700',
  },
});
