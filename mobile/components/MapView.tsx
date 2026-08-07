import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Mapbox, {
  Camera,
  LocationPuck,
  MapView as RNMapboxMapView,
  MarkerView,
} from '@rnmapbox/maps';
import { getMapboxAccessToken, getMapboxStyleUrl } from '@/lib/config';

const token = getMapboxAccessToken();
if (token) {
  void Mapbox.setAccessToken(token);
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
}

interface MapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  region?: Region;
  showsUserLocation?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
  children?: React.ReactNode;
}

type Position = [number, number];

const DEFAULT_CENTER: Position = [-112.07, 33.45];
const DEFAULT_ZOOM = 11;

function deltaToZoom(delta: number): number {
  return Math.max(1, Math.min(22, Math.round(Math.log2(360 / Math.max(delta, 0.0001)))));
}

function regionsEqual(a: Region | null, b: Region | null): boolean {
  if (!a || !b) return false;
  const threshold = 0.0001;
  return (
    Math.abs(a.latitude - b.latitude) < threshold &&
    Math.abs(a.longitude - b.longitude) < threshold &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) < threshold &&
    Math.abs(a.longitudeDelta - b.longitudeDelta) < threshold
  );
}

export function Marker({ coordinate, title, onPress }: MarkerProps) {
  const position: Position = [coordinate.longitude, coordinate.latitude];
  return (
    <MarkerView coordinate={position} anchor={{ x: 0.5, y: 1 }} allowOverlap>
      <Pressable onPress={onPress} style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#ea580c',
            borderWidth: 2,
            borderColor: '#ffffff',
          }}
        />
        {title ? (
          <Text
            style={{
              fontSize: 10,
              color: '#0f172a',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 4,
              paddingHorizontal: 4,
              paddingVertical: 1,
              marginTop: 2,
              maxWidth: 120,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
      </Pressable>
    </MarkerView>
  );
}

export default function MapView({
  style,
  initialRegion,
  region,
  showsUserLocation,
  onRegionChangeComplete,
  children,
}: MapViewProps) {
  const initialCenter = initialRegion
    ? ([initialRegion.longitude, initialRegion.latitude] as Position)
    : DEFAULT_CENTER;
  const initialZoom = initialRegion ? deltaToZoom(initialRegion.longitudeDelta) : DEFAULT_ZOOM;

  const [camera, setCamera] = useState({ center: initialCenter, zoom: initialZoom });
  const lastRegionRef = useRef<Region | null>(null);

  useEffect(() => {
    if (region && !regionsEqual(region, lastRegionRef.current)) {
      lastRegionRef.current = region;
      setCamera({
        center: [region.longitude, region.latitude],
        zoom: deltaToZoom(region.longitudeDelta),
      });
    }
  }, [region]);

  return (
    <RNMapboxMapView
      style={style}
      styleURL={getMapboxStyleUrl() ?? 'mapbox://styles/mapbox/standard'}
      onRegionDidChange={
        onRegionChangeComplete
          ? (feature) => {
              const props = feature.properties;
              const [longitude, latitude] = feature.geometry.coordinates;
              const zoom = props?.zoomLevel ?? DEFAULT_ZOOM;
              const longitudeDelta = 360 / 2 ** zoom;
              const latitudeDelta = longitudeDelta;
              onRegionChangeComplete({
                latitude,
                longitude,
                latitudeDelta,
                longitudeDelta,
              });
            }
          : undefined
      }
    >
      <Camera
        centerCoordinate={camera.center}
        zoomLevel={camera.zoom}
        animationMode="flyTo"
        animationDuration={300}
        defaultSettings={{
          centerCoordinate: initialCenter,
          zoomLevel: initialZoom,
        }}
      />
      {showsUserLocation ? <LocationPuck /> : null}
      {children}
    </RNMapboxMapView>
  );
}
