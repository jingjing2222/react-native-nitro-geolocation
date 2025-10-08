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
import NitroGeolocationHybridObject from 'react-native-nitro-geolocation';
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

interface BenchmarkResults {
  nitro?: BenchmarkStats;
  community?: BenchmarkStats;
}

export default function BenchmarkScreen() {
  const [results, setResults] = useState<BenchmarkResults>({});
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
    console.log(message);
  };

  const calculateStats = (latencies: number[]): BenchmarkStats => {
    if (latencies.length === 0) {
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

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;

    // Standard deviation
    const squaredDiffs = sorted.map(x => (x - avg) ** 2);
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

  const runNitroBenchmark = async () => {
    setRunning('nitro');
    addLog('🚀 Starting Nitro Geolocation benchmark...');

    try {
      // First, warm up and get cached location
      addLog('Warming up - getting initial location...');
      await new Promise<void>((resolve, reject) => {
        NitroGeolocationHybridObject.getCurrentPosition(
          () => {
            addLog('✓ Initial location cached');
            resolve();
          },
          error => {
            addLog(`✗ Failed to get initial location: ${error.message}`);
            reject(error);
          },
          { maximumAge: 60000, timeout: 10000 },
        );
      });

      // Run benchmark using getCurrentPosition
      const totalIterations = 1010; // 10 warmup + 100 actual
      const warmupCount = 10;
      const latencies: number[] = [];

      addLog(
        `Running ${totalIterations} getCurrentPosition calls (${warmupCount} warmup)...`,
      );

      for (let i = 0; i < totalIterations; i++) {
        const startTime = performance.now();

        await new Promise<void>((resolve, reject) => {
          NitroGeolocationHybridObject.getCurrentPosition(
            () => {
              const endTime = performance.now();
              const latency = endTime - startTime;

              // Skip warmup iterations
              if (i >= warmupCount) {
                latencies.push(latency);
              }
              resolve();
            },
            error => {
              addLog(`✗ Call ${i + 1} failed: ${error.message}`);
              reject(error);
            },
            { maximumAge: Infinity, timeout: 5000 }, // Use cached location
          );
        });

        if ((i + 1) % 20 === 0) {
          addLog(`Progress: ${i + 1}/${totalIterations}`);
        }
      }

      addLog(
        `✓ Completed ${totalIterations} iterations (${latencies.length} measured)`,
      );

      const stats = calculateStats(latencies);
      setResults(prev => ({ ...prev, nitro: stats }));

      console.log('='.repeat(60));
      console.log('📊 NITRO GEOLOCATION RESULTS');
      console.log('='.repeat(60));
      console.log(`Samples: ${stats.samples}`);
      console.log(`Min: ${stats.min.toFixed(3)}ms`);
      console.log(`Max: ${stats.max.toFixed(3)}ms`);
      console.log(`Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`Median: ${stats.median.toFixed(3)}ms`);
      console.log(`P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`P99: ${stats.p99.toFixed(3)}ms`);
      console.log(`Std Dev: ${stats.stdDev.toFixed(3)}ms`);
      console.log('='.repeat(60));
      Alert.alert(
        '✅ Nitro Benchmark Complete',
        `Avg: ${stats.avg.toFixed(3)}ms\nMedian: ${stats.median.toFixed(
          3,
        )}ms\nP95: ${stats.p95.toFixed(3)}ms\nP99: ${stats.p99.toFixed(3)}ms`,
      );
    } catch (error: any) {
      Alert.alert('❌ Nitro Benchmark Failed', error.message);
    } finally {
      setRunning(null);
    }
  };

  const runCommunityBenchmark = async () => {
    setRunning('community');
    addLog('🚀 Starting @react-native-community/geolocation benchmark...');

    try {
      // First, warm up and get cached location
      addLog('Warming up - getting initial location...');
      await new Promise<void>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          () => {
            addLog('✓ Initial location cached');
            resolve();
          },
          error => {
            addLog(`✗ Failed to get initial location: ${error.message}`);
            reject(error);
          },
          { maximumAge: 60000, timeout: 10000 },
        );
      });

      // Run benchmark using getCurrentPosition
      const totalIterations = 1010; // 10 warmup + 100 actual
      const warmupCount = 10;
      const latencies: number[] = [];

      addLog(
        `Running ${totalIterations} getCurrentPosition calls (${warmupCount} warmup)...`,
      );

      for (let i = 0; i < totalIterations; i++) {
        const startTime = performance.now();

        await new Promise<void>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            () => {
              const endTime = performance.now();
              const latency = endTime - startTime;

              // Skip warmup iterations
              if (i >= warmupCount) {
                latencies.push(latency);
              }
              resolve();
            },
            error => {
              addLog(`✗ Call ${i + 1} failed: ${error.message}`);
              reject(error);
            },
            { maximumAge: Infinity, timeout: 5000 }, // Use cached location
          );
        });

        if ((i + 1) % 20 === 0) {
          addLog(`Progress: ${i + 1}/${totalIterations}`);
        }
      }

      addLog(
        `✓ Completed ${totalIterations} iterations (${latencies.length} measured)`,
      );

      const stats = calculateStats(latencies);
      setResults(prev => ({ ...prev, community: stats }));

      console.log('='.repeat(60));
      console.log('📊 @REACT-NATIVE-COMMUNITY/GEOLOCATION RESULTS');
      console.log('='.repeat(60));
      console.log(`Samples: ${stats.samples}`);
      console.log(`Min: ${stats.min.toFixed(3)}ms`);
      console.log(`Max: ${stats.max.toFixed(3)}ms`);
      console.log(`Average: ${stats.avg.toFixed(3)}ms`);
      console.log(`Median: ${stats.median.toFixed(3)}ms`);
      console.log(`P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`P99: ${stats.p99.toFixed(3)}ms`);
      console.log(`Std Dev: ${stats.stdDev.toFixed(3)}ms`);
      console.log('='.repeat(60));
      Alert.alert(
        '✅ Community Benchmark Complete',
        `Avg: ${stats.avg.toFixed(3)}ms\nMedian: ${stats.median.toFixed(
          3,
        )}ms\nP95: ${stats.p95.toFixed(3)}ms\nP99: ${stats.p99.toFixed(3)}ms`,
      );
    } catch (error: any) {
      Alert.alert('❌ Community Benchmark Failed', error.message);
    } finally {
      setRunning(null);
    }
  };

  const renderStats = (label: string, stats: BenchmarkStats) => (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>{label}</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Average:</Text>
          <Text style={styles.statValueHighlight}>
            {stats.avg.toFixed(3)}ms
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Median:</Text>
          <Text style={styles.statValue}>{stats.median.toFixed(3)}ms</Text>
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
          <Text style={styles.statLabel}>P95:</Text>
          <Text style={styles.statValue}>{stats.p95.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>P99:</Text>
          <Text style={styles.statValue}>{stats.p99.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Std Dev:</Text>
          <Text style={styles.statValue}>{stats.stdDev.toFixed(3)}ms</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Samples:</Text>
          <Text style={styles.statValue}>{stats.samples}</Text>
        </View>
      </View>
    </View>
  );

  const renderComparison = () => {
    if (!results.nitro || !results.community) return null;

    const speedup = results.community.avg / results.nitro.avg;
    const improvement =
      ((results.community.avg - results.nitro.avg) / results.community.avg) *
      100;

    return (
      <View style={styles.comparisonContainer}>
        <Text style={styles.comparisonTitle}>📊 Performance Comparison</Text>

        <View style={styles.comparisonBox}>
          <Text style={styles.comparisonLabel}>Average Latency</Text>
          <Text style={styles.comparisonText}>
            Nitro: {results.nitro.avg.toFixed(3)}ms
            {'\n'}
            Community: {results.community.avg.toFixed(3)}ms
          </Text>
        </View>

        <View style={[styles.comparisonBox, styles.highlightBox]}>
          <Text style={styles.speedupText}>
            🚀 Nitro is {speedup.toFixed(2)}x faster
          </Text>
          <Text style={styles.improvementText}>
            ({improvement.toFixed(1)}% improvement)
          </Text>
        </View>

        <View style={styles.comparisonBox}>
          <Text style={styles.comparisonLabel}>P95 Latency</Text>
          <Text style={styles.comparisonText}>
            Nitro: {results.nitro.p95.toFixed(3)}ms
            {'\n'}
            Community: {results.community.p95.toFixed(3)}ms
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Bridge Latency Benchmark</Text>
          <Text style={styles.subtitle}>
            Measuring Native → JS bridge crossing time
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📌 What This Measures</Text>
            <Text style={styles.infoText}>
              • Pure native → JS bridge latency{'\n'}• Uses cached location (no
              GPS delay){'\n'}• 1000 iterations for statistical accuracy{'\n'}•
              Timestamps captured in native code
            </Text>
          </View>

          <View style={styles.buttonSection}>
            <Text style={styles.sectionTitle}>Run Benchmarks</Text>

            <View style={styles.buttonContainer}>
              <Button
                title={
                  running === 'nitro'
                    ? 'Running...'
                    : '🚀 Benchmark Nitro Geolocation'
                }
                onPress={runNitroBenchmark}
                disabled={running !== null}
                color="#2196F3"
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={
                  running === 'community'
                    ? 'Running...'
                    : '📦 Benchmark Community Geolocation'
                }
                onPress={runCommunityBenchmark}
                disabled={running !== null}
                color="#4CAF50"
              />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Results */}
          <Text style={styles.sectionTitle}>Results</Text>

          {!results.nitro && !results.community && (
            <Text style={styles.noResults}>
              No results yet. Run a benchmark to see results.
            </Text>
          )}

          {results.nitro && (
            <View style={styles.resultBox}>
              {renderStats('🚀 Nitro Geolocation', results.nitro)}
            </View>
          )}

          {results.community && (
            <View style={styles.resultBox}>
              {renderStats(
                '📦 @react-native-community/geolocation',
                results.community,
              )}
            </View>
          )}

          {renderComparison()}

          {/* Logs */}
          {logs.length > 0 && (
            <View style={styles.logsContainer}>
              <Text style={styles.logsTitle}>📋 Logs</Text>
              <ScrollView style={styles.logsScroll} nestedScrollEnabled>
                {logs
                  .slice(-20)
                  .reverse()
                  .map((log, index) => (
                    <Text key={index} style={styles.logText}>
                      {log}
                    </Text>
                  ))}
              </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 22,
  },
  buttonSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 24,
  },
  noResults: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 40,
  },
  resultBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsContainer: {
    width: '100%',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  statsGrid: {
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    color: '#000',
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  statValueHighlight: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  comparisonContainer: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  comparisonBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  highlightBox: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  comparisonText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  speedupText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 4,
  },
  improvementText: {
    fontSize: 14,
    color: '#388e3c',
    textAlign: 'center',
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#263238',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    maxHeight: 300,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  logsScroll: {
    maxHeight: 200,
  },
  logText: {
    fontSize: 12,
    color: '#b0bec5',
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 18,
  },
});
