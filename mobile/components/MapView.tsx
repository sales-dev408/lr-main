import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Mapbox, {
  Camera,
  LocationPuck,
  MapView as MapboxMapView,
  MarkerView,
  type MapState,
} from '@rnmapbox/maps';
import { getMapboxAccessToken, getMapboxStyleUrl } from '@/lib/config';

const accessToken = getMapboxAccessToken();
if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapViewProps {
  style?: object;
  initialRegion?: Region;
  region?: Region;
  showsUserLocation?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
  children?: ReactNode;
}

function deltaToZoom(delta: number): number {
  return Math.max(1, Math.min(22, Math.round(Math.log2(360 / delta) - 1)));
}

export default function MapView({
  style,
  initialRegion,
  region,
  showsUserLocation,
  onRegionChangeComplete,
  children,
}: MapViewProps) {
  const centerRegion = region ?? initialRegion;
  const centerCoordinate = useMemo<[number, number] | undefined>(() => {
    if (!centerRegion) return undefined;
    return [centerRegion.longitude, centerRegion.latitude];
  }, [centerRegion]);
  const zoomLevel = useMemo(() => {
    if (!centerRegion) return 10;
    return deltaToZoom(centerRegion.longitudeDelta);
  }, [centerRegion]);

  function handleMapIdle(state: MapState) {
    if (!onRegionChangeComplete || !state.properties?.center) return;
    const [longitude, latitude] = state.properties.center as [number, number];
    const zoom = state.properties.zoom;
    const longitudeDelta = 360 / 2 ** zoom;
    const latitudeDelta = longitudeDelta;
    onRegionChangeComplete({ latitude, longitude, latitudeDelta, longitudeDelta });
  }

  if (!accessToken) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.text}>Mapbox access token is not configured.</Text>
      </View>
    );
  }

  return (
    <MapboxMapView
      style={style}
      styleURL={getMapboxStyleUrl()}
      onMapIdle={handleMapIdle}
      attributionEnabled
      logoEnabled
      scaleBarEnabled={false}
    >
      {centerCoordinate ? (
        <Camera
          centerCoordinate={centerCoordinate}
          zoomLevel={zoomLevel}
          animationMode="none"
          animationDuration={0}
        />
      ) : null}
      {showsUserLocation ? <LocationPuck puckBearingEnabled visible /> : null}
      {children}
    </MapboxMapView>
  );
}

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
}

export function Marker({ coordinate, title, onPress }: MarkerProps) {
  return (
    <MarkerView
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={{ x: 0.5, y: 1 }}
      allowOverlap
    >
      <Pressable onPress={onPress} style={styles.marker}>
        <View style={styles.markerDot} />
        {title ? <Text style={styles.markerLabel}>{title}</Text> : null}
      </Pressable>
    </MarkerView>
  );
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
  marker: {
    alignItems: 'center',
    minWidth: 80,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    textAlign: 'center',
  },
});
