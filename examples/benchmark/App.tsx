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

interface LibraryBenchmarkStats {
  nitro?: BenchmarkStats;
  community?: BenchmarkStats;
}

interface BenchmarkResults {
  setRNConfiguration?: LibraryBenchmarkStats;
  getCurrentPosition?: LibraryBenchmarkStats;
  watchPosition?: LibraryBenchmarkStats;
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

    try {
      // Benchmark Nitro
      const nitroMeasurements: number[] = [];

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
        nitroMeasurements.push(end - start);
      }

      const nitroStats = calculateStats(nitroMeasurements);

      // Benchmark Community
      const communityMeasurements: number[] = [];

      // Warmup
      for (let i = 0; i < 10; i++) {
        Geolocation.setRNConfiguration({ skipPermissionRequests: false });
      }

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        Geolocation.setRNConfiguration({
          skipPermissionRequests: false,
          authorizationLevel: 'whenInUse',
          locationProvider: 'auto',
        });
        const end = performance.now();
        communityMeasurements.push(end - start);
      }

      const communityStats = calculateStats(communityMeasurements);

      setResults(prev => ({
        ...prev,
        setRNConfiguration: { nitro: nitroStats, community: communityStats },
      }));
      Alert.alert(
        'Success',
        `setRNConfiguration completed\nNitro: ${nitroStats.avg.toFixed(
          3,
        )}ms\nCommunity: ${communityStats.avg.toFixed(3)}ms`,
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

    try {
      // Benchmark Nitro
      const nitroMeasurements: number[] = [];

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
              nitroMeasurements.push(end - start);
              resolve(null);
            },
            error => {
              const end = performance.now();
              nitroMeasurements.push(end - start);
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
        await new Promise<void>(resolve => setTimeout(resolve, 500));
      }

      const nitroStats = calculateStats(nitroMeasurements);

      // Wait before switching to Community
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      // Benchmark Community
      const communityMeasurements: number[] = [];

      // Warmup (1 call)
      await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 0,
          enableHighAccuracy: true,
        });
      });

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        await new Promise((resolve, reject) => {
          Geolocation.getCurrentPosition(
            () => {
              const end = performance.now();
              communityMeasurements.push(end - start);
              resolve(null);
            },
            error => {
              const end = performance.now();
              communityMeasurements.push(end - start);
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
        await new Promise<void>(resolve => setTimeout(resolve, 500));
      }

      const communityStats = calculateStats(communityMeasurements);

      setResults(prev => ({
        ...prev,
        getCurrentPosition: { nitro: nitroStats, community: communityStats },
      }));
      Alert.alert(
        'Success',
        `getCurrentPosition completed\nNitro: ${nitroStats.avg.toFixed(
          1,
        )}ms\nCommunity: ${communityStats.avg.toFixed(1)}ms`,
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

    // Benchmark Nitro
    const nitroMeasurements: number[] = [];
    let nitroLastUpdate = performance.now();
    let nitroSampleCount = 0;

    await new Promise<void>(resolve => {
      const watchId = watchPosition(
        position => {
          const now = performance.now();
          const latency = now - nitroLastUpdate;

          // Skip first sample (cold start)
          if (nitroSampleCount > 0) {
            nitroMeasurements.push(latency);
          }

          nitroSampleCount++;
          nitroLastUpdate = now;

          console.log(
            `Nitro watchPosition sample ${nitroSampleCount}: ${latency.toFixed(
              3,
            )}ms`,
          );

          if (nitroSampleCount >= targetSamples) {
            clearWatch(watchId);
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

    const nitroStats = calculateStats(nitroMeasurements);

    // Wait before switching to Community
    await new Promise<void>(resolve => setTimeout(resolve, 2000));

    // Benchmark Community
    const communityMeasurements: number[] = [];
    let communityLastUpdate = performance.now();
    let communitySampleCount = 0;

    await new Promise<void>(resolve => {
      const watchId = Geolocation.watchPosition(
        () => {
          const now = performance.now();
          const latency = now - communityLastUpdate;

          // Skip first sample (cold start)
          if (communitySampleCount > 0) {
            communityMeasurements.push(latency);
          }

          communitySampleCount++;
          communityLastUpdate = now;

          console.log(
            `Community watchPosition sample ${communitySampleCount}: ${latency.toFixed(
              3,
            )}ms`,
          );

          if (communitySampleCount >= targetSamples) {
            Geolocation.clearWatch(watchId);
            resolve();
          }
        },
        error => {
          Geolocation.clearWatch(watchId);
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

    const communityStats = calculateStats(communityMeasurements);

    setResults(prev => ({
      ...prev,
      watchPosition: { nitro: nitroStats, community: communityStats },
    }));
    setRunning(null);

    Alert.alert(
      'Success',
      `watchPosition completed\nNitro: ${nitroStats.avg.toFixed(
        0,
      )}ms\nCommunity: ${communityStats.avg.toFixed(0)}ms`,
    );
  };

  const renderComparisonStats = (
    name: string,
    libStats: LibraryBenchmarkStats,
  ) => (
    <View key={name} style={styles.resultContainer}>
      <Text style={styles.resultTitle}>{name}</Text>

      {/* Nitro Results */}
      {libStats.nitro && (
        <View style={styles.librarySection}>
          <Text style={styles.libraryTitle}>Nitro Geolocation</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Samples:</Text>
              <Text style={styles.statValue}>{libStats.nitro.samples}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Min:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.min.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Max:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.max.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg:</Text>
              <Text style={styles.statValueHighlight}>
                {libStats.nitro.avg.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Median:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.median.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P95:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.p95.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P99:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.p99.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>StdDev:</Text>
              <Text style={styles.statValue}>
                {libStats.nitro.stdDev.toFixed(3)}ms
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Community Results */}
      {libStats.community && (
        <View
          style={[
            styles.librarySection,
            { borderBottomWidth: 0, paddingBottom: 8 },
          ]}
        >
          <Text style={styles.libraryTitle}>
            @react-native-community/geolocation
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Samples:</Text>
              <Text style={styles.statValue}>{libStats.community.samples}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Min:</Text>
              <Text style={styles.statValue}>
                {libStats.community.min.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Max:</Text>
              <Text style={styles.statValue}>
                {libStats.community.max.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg:</Text>
              <Text style={styles.statValueHighlight}>
                {libStats.community.avg.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Median:</Text>
              <Text style={styles.statValue}>
                {libStats.community.median.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P95:</Text>
              <Text style={styles.statValue}>
                {libStats.community.p95.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>P99:</Text>
              <Text style={styles.statValue}>
                {libStats.community.p99.toFixed(3)}ms
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>StdDev:</Text>
              <Text style={styles.statValue}>
                {libStats.community.stdDev.toFixed(3)}ms
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Comparison Summary */}
      {libStats.nitro && libStats.community && (
        <View style={styles.comparisonBox}>
          <Text style={styles.comparisonTitle}>📊 Comparison</Text>
          <Text style={styles.comparisonText}>
            Nitro is{' '}
            {libStats.nitro.avg < libStats.community.avg ? (
              <Text style={styles.faster}>
                {(
                  ((libStats.community.avg - libStats.nitro.avg) /
                    libStats.community.avg) *
                  100
                ).toFixed(1)}
                % faster
              </Text>
            ) : (
              <Text style={styles.slower}>
                {(
                  ((libStats.nitro.avg - libStats.community.avg) /
                    libStats.community.avg) *
                  100
                ).toFixed(1)}
                % slower
              </Text>
            )}{' '}
            (avg)
          </Text>
        </View>
      )}
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
            <Text style={styles.sectionTitle}>Method Call Overhead</Text>
            <Text style={styles.sectionDescription}>
              Compare both libraries - method invocation (1000 iterations each)
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
              Compare both libraries - end-to-end latency (10 iterations each)
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
              Compare both libraries - callback interval (20 samples each)
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
            renderComparisonStats(
              'setRNConfiguration',
              results.setRNConfiguration,
            )}
          {results.getCurrentPosition &&
            renderComparisonStats(
              'getCurrentPosition',
              results.getCurrentPosition,
            )}
          {results.watchPosition &&
            renderComparisonStats('watchPosition', results.watchPosition)}

          {Object.keys(results).length > 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 Interpretation</Text>
              <Text style={styles.infoText}>
                • setRNConfiguration: Pure method call overhead (&lt;0.1ms)
              </Text>
              <Text style={styles.infoText}>
                • getCurrentPosition: Callback latency (includes GPS fix)
              </Text>
              <Text style={styles.infoText}>
                • watchPosition: Update intervals (~1000ms)
              </Text>
              <Text style={styles.infoText}>
                • P95/P99: 95th/99th percentile (tail latency)
              </Text>
              <Text style={styles.infoText}>
                • Lower latency = better performance
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
  librarySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  libraryTitle: {
    fontSize: 14,
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
  comparisonBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
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
