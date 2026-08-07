import React, { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import RNMapView, { Marker as RNMarker, type Region } from 'react-native-maps';

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

export type { Region };

export function Marker(props: MarkerProps) {
  return (
    <RNMarker
      coordinate={props.coordinate}
      title={props.title}
      description={props.description}
      onPress={props.onPress}
    />
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
  const mapRef = useRef<RNMapView>(null);

  useEffect(() => {
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 300);
    }
  }, [region]);

  return (
    <RNMapView
      ref={mapRef}
      style={style}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      onRegionChangeComplete={onRegionChangeComplete}
    >
      {children}
    </RNMapView>
  );
}
