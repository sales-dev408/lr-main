import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useThemeColors } from '@/lib/useThemeColors';
import { useAppColorScheme } from '@/lib/colorScheme';
import { useDynamicType } from '@/lib/dynamicType';

export type SimpleListPickerEntry = { value: string; label: string; count: number };

/**
 * Flat-list dropdown modal used for simple single-value filters (e.g. city,
 * sport, event type). Visually and behaviorally matches StopPicker so filter
 * dropdowns feel consistent across the app.
 */
export function SimpleListPicker({
  entries,
  selected,
  onSelect,
  label,
  itemNoun = 'item',
  allLabel = 'All',
}: {
  entries: SimpleListPickerEntry[];
  selected: string;
  onSelect: (value: string) => void;
  label: string;
  itemNoun?: string;
  allLabel?: string;
}) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { scheme } = useAppColorScheme();
  const [open, setOpen] = useState(false);

  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.count, 0), [entries]);
  const selectedEntry = useMemo(() => entries.find((e) => e.value === selected), [entries, selected]);

  function select(value: string) {
    setOpen(false);
    onSelect(value);
  }

  const modalContent = (
    <>
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '700' }} allowFontScaling={false}>
          {label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
          {total} {itemNoun}
          {total === 1 ? '' : 's'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        <Pressable
          onPress={() => select('')}
          accessibilityRole="button"
          accessibilityLabel={allLabel}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: pressed || selected === '' ? colors.brand + '12' : 'transparent',
          })}
        >
          <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale, flex: 1, fontWeight: selected === '' ? '700' : '400' }} allowFontScaling={false}>
            {allLabel}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
            {total}
          </Text>
        </Pressable>
        {entries.map((entry) => (
          <Pressable
            key={entry.value}
            onPress={() => select(entry.value)}
            accessibilityRole="button"
            accessibilityLabel={`${entry.label}, ${entry.count} ${itemNoun}${entry.count === 1 ? '' : 's'}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: pressed || selected === entry.value ? colors.brand + '12' : 'transparent',
            })}
          >
            <Text
              style={{ color: colors.ink, fontSize: 15 * effectiveScale, flex: 1, fontWeight: selected === entry.value ? '700' : '400' }}
              allowFontScaling={false}
            >
              {entry.label}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
              {entry.count}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={entries.length === 0}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: colors.panel,
          opacity: entries.length === 0 ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale }} allowFontScaling={false}>
          {selectedEntry ? `${label}: ${selectedEntry.label}` : label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
          {entries.length} ▾
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel={`Close ${label.toLowerCase()} list`}
          style={{ flex: 1, backgroundColor: '#0b1a2c99', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              maxHeight: '80%',
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {isLiquidGlassSupported ? (
              <LiquidGlassView effect="regular" colorScheme={scheme} style={{ flexShrink: 1 }}>
                {modalContent}
              </LiquidGlassView>
            ) : Platform.OS === 'ios' ? (
              <BlurView intensity={100} tint={scheme} style={{ flexShrink: 1 }}>
                {modalContent}
              </BlurView>
            ) : (
              <View style={{ backgroundColor: colors.panel, flexShrink: 1 }}>{modalContent}</View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
