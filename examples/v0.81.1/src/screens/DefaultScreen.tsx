import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Button,
  Switch,
} from 'react-native';
import {
  useRequestPermission,
  useGetCurrentPosition,
  useWatchPosition,
} from 'react-native-nitro-geolocation';
import type { GeolocationResponse } from 'react-native-nitro-geolocation';

export default function DefaultScreen() {
  // Hooks
  const requestPermission = useRequestPermission();
  const getCurrentPosition = useGetCurrentPosition();

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);

  // Current position state
  const [currentPosition, setCurrentPosition] = useState<GeolocationResponse | null>(null);
  const [isCurrentPositionLoading, setIsCurrentPositionLoading] = useState(false);
  const [currentPositionError, setCurrentPositionError] = useState<string | null>(null);

  // Watch position hook (continuous)
  const [watchEnabled, setWatchEnabled] = useState(false);
  const {
    data: watchedPosition,
    isWatching,
  } = useWatchPosition({
    enabled: watchEnabled,
    enableHighAccuracy: true,
    distanceFilter: 10,
    interval: 5000,
  });

  const handleRequestPermission = async () => {
    setIsPermissionLoading(true);
    try {
      const status = await requestPermission();
      setPermissionStatus(status);
    } catch (err) {
      setPermissionStatus('error');
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handleFetchPosition = async () => {
    setIsCurrentPositionLoading(true);
    setCurrentPositionError(null);
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      });
      setCurrentPosition(position);
    } catch (err: any) {
      setCurrentPositionError(err?.message || 'Unknown error');
    } finally {
      setIsCurrentPositionLoading(false);
    }
  };

  const renderPermissionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Permission Status</Text>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>
          {permissionStatus || 'Unknown'}
          {permissionStatus === 'granted' && ' ✅'}
          {permissionStatus === 'denied' && ' ❌'}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title={isPermissionLoading ? 'Loading...' : 'Request Permission'}
          onPress={handleRequestPermission}
          disabled={isPermissionLoading}
          color="#4CAF50"
        />
      </View>
    </View>
  );

  const renderPositionInfo = (position: GeolocationResponse | null, title: string) => {
    if (!position) return null;

    return (
      <View style={styles.positionContainer}>
        <Text style={styles.positionTitle}>{title}</Text>
        <Text style={styles.positionText}>
          Latitude: {position.coords.latitude.toFixed(6)}
        </Text>
        <Text style={styles.positionText}>
          Longitude: {position.coords.longitude.toFixed(6)}
        </Text>
        <Text style={styles.positionText}>
          Accuracy: {position.coords.accuracy.toFixed(2)}m
        </Text>
        {position.coords.altitude !== null && position.coords.altitude !== undefined && (
          <Text style={styles.positionText}>
            Altitude: {position.coords.altitude.toFixed(2)}m
          </Text>
        )}
        {position.coords.speed !== null && position.coords.speed !== undefined && (
          <Text style={styles.positionText}>
            Speed: {position.coords.speed.toFixed(2)}m/s
          </Text>
        )}
        {position.coords.heading !== null && position.coords.heading !== undefined && (
          <Text style={styles.positionText}>
            Heading: {position.coords.heading.toFixed(2)}°
          </Text>
        )}
        <Text style={styles.positionText}>
          Time: {new Date(position.timestamp).toLocaleString()}
        </Text>
      </View>
    );
  };

  const renderCurrentPositionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Get Current Position (On Demand)</Text>
      {currentPositionError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {currentPositionError}</Text>
        </View>
      )}
      <View style={styles.buttonContainer}>
        <Button
          title={isCurrentPositionLoading ? 'Loading...' : 'Get Position'}
          onPress={handleFetchPosition}
          disabled={isCurrentPositionLoading}
          color="#4CAF50"
        />
      </View>
      {renderPositionInfo(currentPosition, 'Current Position')}
    </View>
  );

  const renderWatchPositionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Watch Position (Continuous)</Text>
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Enable Watching:</Text>
        <Switch value={watchEnabled} onValueChange={setWatchEnabled} />
      </View>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>
          {isWatching ? 'Watching 🟢' : 'Not Watching 🔴'}
        </Text>
      </View>
      {renderPositionInfo(watchedPosition, 'Watched Position (Live)')}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Default API</Text>
        <Text style={styles.subtitle}>
          Declarative hooks-based API with automatic cleanup
        </Text>
      </View>

      {renderPermissionSection()}
      <View style={styles.divider} />
      {renderCurrentPositionSection()}
      <View style={styles.divider} />
      {renderWatchPositionSection()}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#E3F2FD',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statusContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '700',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  buttonContainer: {
    marginVertical: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  positionContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  positionText: {
    fontSize: 14,
    color: '#1B5E20',
    marginVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
});
