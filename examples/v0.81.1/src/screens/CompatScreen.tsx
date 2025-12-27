import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
} from 'react-native';
import GeolocationCompat, {
  type GeolocationResponse,
} from 'react-native-nitro-geolocation/compat';

export default function CompatScreen() {
  const [permissionStatus, setPermissionStatus] = useState<string>('Unknown');
  const [currentPosition, setCurrentPosition] =
    useState<GeolocationResponse | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  const [watchId, setWatchId] = useState<number | null>(null);
  const [watchedPosition, setWatchedPosition] =
    useState<GeolocationResponse | null>(null);
  const [watchUpdateCount, setWatchUpdateCount] = useState(0);

  useEffect(() => {
    GeolocationCompat.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      locationProvider: 'auto',
    });
  }, []);

  const handleRequestAuthorization = () => {
    setPermissionStatus('Requesting...');
    GeolocationCompat.requestAuthorization(
      () => {
        setPermissionStatus('Granted ✅');
        Alert.alert('Success', 'Location permission granted!');
      },
      (error) => {
        setPermissionStatus(`Denied ❌ (Code: ${error.code})`);
        Alert.alert('Error', error.message);
      }
    );
  };

  const handleGetCurrentPosition = () => {
    setIsLoadingPosition(true);
    setCurrentPosition(null);

    GeolocationCompat.getCurrentPosition(
      (position) => {
        setIsLoadingPosition(false);
        setCurrentPosition(position);
      },
      (error) => {
        setIsLoadingPosition(false);
        Alert.alert('Error', `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const handleStartWatching = () => {
    if (watchId !== null) {
      Alert.alert('Info', 'Already watching position');
      return;
    }

    setWatchUpdateCount(0);
    setWatchedPosition(null);

    const id = GeolocationCompat.watchPosition(
      (position) => {
        setWatchedPosition(position);
        setWatchUpdateCount((count) => count + 1);
      },
      (error) => {
        Alert.alert('Watch Error', `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
      }
    );

    setWatchId(id);
  };

  const handleStopWatching = () => {
    if (watchId === null) {
      Alert.alert('Info', 'Not watching position');
      return;
    }

    GeolocationCompat.clearWatch(watchId);
    setWatchId(null);
  };

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
        {position.coords.altitude !== null && (
          <Text style={styles.positionText}>
            Altitude: {position.coords.altitude.toFixed(2)}m
          </Text>
        )}
        {position.coords.speed !== null && (
          <Text style={styles.positionText}>
            Speed: {position.coords.speed.toFixed(2)}m/s
          </Text>
        )}
        {position.coords.heading !== null && (
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compat API</Text>
        <Text style={styles.subtitle}>
          Legacy callback-based API compatible with @react-native-community/geolocation
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permission Status</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Permission Status:</Text>
          <Text style={styles.statusValue}>{permissionStatus}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title="Request Authorization"
            onPress={handleRequestAuthorization}
            color="#2196F3"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Get Current Position (One-time)</Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoadingPosition ? 'Loading...' : 'Get Current Position'}
            onPress={handleGetCurrentPosition}
            disabled={isLoadingPosition}
            color="#4CAF50"
          />
        </View>
        {renderPositionInfo(currentPosition, 'Current Position')}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Watch Position (Continuous)</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Watch Status:</Text>
          <Text style={styles.statusValue}>
            {watchId !== null ? `Watching 🟢 (ID: ${watchId})` : 'Not Watching 🔴'}
          </Text>
          {watchId !== null && (
            <Text style={styles.statusLabel}>Updates: {watchUpdateCount}</Text>
          )}
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.button}>
            <Button
              title="Start Watching"
              onPress={handleStartWatching}
              disabled={watchId !== null}
              color="#FF9800"
            />
          </View>
          <View style={styles.button}>
            <Button
              title="Stop Watching"
              onPress={handleStopWatching}
              disabled={watchId === null}
              color="#F44336"
            />
          </View>
        </View>
        {renderPositionInfo(watchedPosition, 'Watched Position (Live)')}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Features:</Text>
        <Text style={styles.footerText}>✅ setRNConfiguration</Text>
        <Text style={styles.footerText}>✅ requestAuthorization</Text>
        <Text style={styles.footerText}>✅ getCurrentPosition</Text>
        <Text style={styles.footerText}>✅ watchPosition / clearWatch</Text>
        <Text style={styles.footerText}>✅ stopObserving</Text>
        <Text style={styles.footerText}>
          ⚠️ Manual subscription management required
        </Text>
      </View>
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
    backgroundColor: '#FF9800',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFF3E0',
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
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '700',
    marginTop: 4,
  },
  buttonContainer: {
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  positionContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  positionText: {
    fontSize: 14,
    color: '#BF360C',
    marginVertical: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  footer: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    marginTop: 20,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#333',
    marginVertical: 3,
  },
});
