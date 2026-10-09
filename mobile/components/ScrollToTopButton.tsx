import { Pressable, Text } from 'react-native';
import { useThemeColors } from '@/lib/useThemeColors';

// Floating "back to top" arrow shown in the lower corner once a long list has
// been scrolled. Parent tracks visibility from its onScroll handler and passes
// the scroll-to-top action.
export function ScrollToTopButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  if (!visible) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Scroll back to top"
      style={({ pressed }) => ({
        position: 'absolute',
        bottom: 20,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brand,
        borderWidth: 1,
        borderColor: colors.border,
        zIndex: 30,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: -2 }} allowFontScaling={false}>
        ↑
      </Text>
    </Pressable>
  );
}
