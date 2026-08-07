import type { ReactNode } from 'react';
import { Children, isValidElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxAccessToken } from '@/lib/config';

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

export interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
}

const DEFAULT_REGION: Region = { latitude: 33.45, longitude: -112.07, latitudeDelta: 0.5, longitudeDelta: 0.5 };

function deltaToZoom(delta: number): number {
  return Math.max(1, Math.min(22, Math.round(Math.log2(360 / delta) - 1)));
}

function regionFromMap(map: mapboxgl.Map): Region {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const longitudeDelta = 360 / 2 ** zoom;
  const latitudeDelta = longitudeDelta;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta,
  };
}

function regionsEqual(a: Region, b: Region): boolean {
  const threshold = 0.0001;
  return (
    Math.abs(a.latitude - b.latitude) < threshold &&
    Math.abs(a.longitude - b.longitude) < threshold &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) < threshold &&
    Math.abs(a.longitudeDelta - b.longitudeDelta) < threshold
  );
}

function mapStyleFromProp(style: object | undefined): React.CSSProperties {
  const result: React.CSSProperties = { width: '100%', height: '100%' };
  if (!style || typeof style !== 'object') return result;
  const s = style as Record<string, unknown>;
  if (s.borderRadius != null) result.borderRadius = Number(s.borderRadius);
  if (s.flex === 1 || s.flex === '1') result.flex = '1 1 auto';
  return result;
}

export default function MapView({
  style,
  initialRegion,
  region,
  showsUserLocation,
  onRegionChangeComplete,
  children,
}: MapViewProps) {
  const accessToken = getMapboxAccessToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const lastRegionRef = useRef<Region | null>(null);

  const mapContainerStyle = useMemo(() => mapStyleFromProp(style), [style]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !accessToken) return;

    const centerRegion = initialRegion ?? region ?? DEFAULT_REGION;
    const center: [number, number] = [centerRegion.longitude, centerRegion.latitude];
    const zoom = deltaToZoom(centerRegion.longitudeDelta);

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Use the default public Mapbox Standard style so web builds don't 404 on
      // custom-font requests when a Studio style references fonts that haven't
      // been uploaded to the Mapbox account.
      style: 'mapbox://styles/mapbox/standard',
      center,
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    if (showsUserLocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setCenter([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {
          // ignore errors; user can still pan
        },
      );
    }

    map.on('moveend', () => {
      const r = regionFromMap(map);
      lastRegionRef.current = r;
      onRegionChangeComplete?.(r);
    });

    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !region) return;
    if (lastRegionRef.current && regionsEqual(lastRegionRef.current, region)) return;

    const target: [number, number] = [region.longitude, region.latitude];
    const zoom = deltaToZoom(region.longitudeDelta);
    map.easeTo({ center: target, zoom, duration: 300 });
  }, [region]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      if ((child.type as { displayName?: string } | undefined)?.displayName !== 'Marker') return;
      const props = child.props as MarkerProps;
      if (!props?.coordinate) return;

      const el = document.createElement('div');
      el.className = 'lr-map-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#2563eb';
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.25)';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el).setLngLat([props.coordinate.longitude, props.coordinate.latitude]);

      if (props.title || props.description) {
        const popup = new mapboxgl.Popup({ offset: 8 }).setHTML(
          `<strong>${escapeHtml(props.title ?? '')}</strong>${props.description ? `<br/>${escapeHtml(props.description)}` : ''}`,
        );
        marker.setPopup(popup);
      }

      if (props.onPress) {
        el.addEventListener('click', props.onPress);
      }

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [children]);

  if (!accessToken) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.text}>Mapbox access token is not configured.</Text>
      </View>
    );
  }

  return <div ref={containerRef} style={mapContainerStyle} />;
}

export function Marker(_props: MarkerProps) {
  return null;
}
Marker.displayName = 'Marker';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
