import { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
} from 'react-native';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: { pageX: number; pageY: number }[]) {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * Tappable image that opens a full-screen viewer supporting pinch-to-zoom,
 * double-tap zoom, drag-to-pan, and +/- buttons. Pure JS: no native changes.
 */
export function ZoomableImage({
  source,
  label,
  height,
}: {
  source: ImageSourcePropType;
  label: string;
  height: number;
}) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });

  const viewRef = useRef(view);
  const gesture = useRef({ baseScale: 1, baseTx: 0, baseTy: 0, startDist: 0, startX: 0, startY: 0, moved: false, pinching: false });
  const lastTap = useRef(0);

  const clampPan = (tx: number, ty: number, scale: number) => ({
    tx: clamp(tx, -((scale - 1) * windowWidth) / 2, ((scale - 1) * windowWidth) / 2),
    ty: clamp(ty, -((scale - 1) * windowHeight) / 2, ((scale - 1) * windowHeight) / 2),
  });

  const commit = (scale: number, tx: number, ty: number) => {
    const next = { scale, tx, ty };
    viewRef.current = next;
    setView(next);
  };

  const applyScale = (nextScale: number) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (scale === MIN_SCALE) {
      commit(scale, 0, 0);
    } else {
      const p = clampPan(viewRef.current.tx, viewRef.current.ty, scale);
      commit(scale, p.tx, p.ty);
    }
  };

  const onResponderGrant = (evt: GestureResponderEvent) => {
    const g = gesture.current;
    g.moved = false;
    g.baseScale = viewRef.current.scale;
    g.baseTx = viewRef.current.tx;
    g.baseTy = viewRef.current.ty;
    g.startX = evt.nativeEvent.pageX;
    g.startY = evt.nativeEvent.pageY;
    g.pinching = false;
    if (evt.nativeEvent.touches.length >= 2) {
      g.pinching = true;
      g.startDist = touchDistance(evt.nativeEvent.touches);
    }
  };

  const onResponderMove = (evt: GestureResponderEvent) => {
    const touches = evt.nativeEvent.touches;
    const g = gesture.current;
    if (touches.length >= 2) {
      g.moved = true;
      const dist = touchDistance(touches);
      if (!g.pinching) {
        g.pinching = true;
        g.startDist = dist;
        g.baseScale = viewRef.current.scale;
        return;
      }
      if (g.startDist > 0) {
        applyScale(g.baseScale * (dist / g.startDist));
      }
      return;
    }
    if (g.pinching) {
      // just dropped from two fingers to one: rebase pan origin to avoid a jump
      g.pinching = false;
      g.startX = evt.nativeEvent.pageX;
      g.startY = evt.nativeEvent.pageY;
      g.baseTx = viewRef.current.tx;
      g.baseTy = viewRef.current.ty;
      return;
    }
    const dx = evt.nativeEvent.pageX - g.startX;
    const dy = evt.nativeEvent.pageY - g.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    if (viewRef.current.scale <= MIN_SCALE) return;
    const p = clampPan(g.baseTx + dx, g.baseTy + dy, viewRef.current.scale);
    commit(viewRef.current.scale, p.tx, p.ty);
  };

  const close = () => {
    setOpen(false);
    commit(1, 0, 0);
  };

  const buttonStyle = {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#ffffff26',
    paddingHorizontal: 14,
  };
  const buttonText = { color: '#fff', fontSize: 18 * effectiveScale, fontWeight: '700' as const };

  return (
    <View style={{ width: '100%' }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Double-tap to open zoomable map`}
        style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}
      >
        <Image
          source={source}
          style={{ width: '100%', height, backgroundColor: colors.panel }}
          resizeMode="contain"
          accessibilityLabel={label}
        />
        <View
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            backgroundColor: '#0b1a2cb3',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
            Tap to zoom
          </Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: '#000000e6' }}>
          <View
            style={{ flex: 1, overflow: 'hidden' }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={onResponderGrant}
            onResponderMove={onResponderMove}
            onResponderRelease={() => {
              const g = gesture.current;
              if (!g.moved) {
                const now = Date.now();
                if (now - lastTap.current < 300) {
                  applyScale(viewRef.current.scale > MIN_SCALE ? MIN_SCALE : 2.5);
                  lastTap.current = 0;
                } else {
                  lastTap.current = now;
                }
              }
            }}
          >
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }],
              }}
            >
              <Image
                source={source}
                style={{ width: windowWidth, height: windowHeight }}
                resizeMode="contain"
                accessibilityLabel={`${label}, zoomed`}
              />
            </View>
          </View>
          <View
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => applyScale(viewRef.current.scale / 1.4)}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              style={buttonStyle}
            >
              <Text style={buttonText} allowFontScaling={false}>−</Text>
            </Pressable>
            <Pressable
              onPress={() => applyScale(viewRef.current.scale * 1.4)}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              style={buttonStyle}
            >
              <Text style={buttonText} allowFontScaling={false}>+</Text>
            </Pressable>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close map"
              style={buttonStyle}
            >
              <Text style={[buttonText, { fontSize: 14 * effectiveScale }]} allowFontScaling={false}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
