import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

type MapViewProps = {
  style?: object;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
  children?: ReactNode;
};

export default function MapView({ style }: MapViewProps) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.text}>Map view is available in the iOS/Android app.</Text>
    </View>
  );
}

export function Marker() {
  return null;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    padding: 16,
  },
  text: {
    color: '#475569',
    textAlign: 'center',
  },
});
