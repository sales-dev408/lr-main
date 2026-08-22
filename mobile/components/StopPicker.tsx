import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import { groupStopsByCity } from '@/lib/stops';

export type StopPickerEntry = { stop: string; count: number; city?: string | null };

/**
 * Dropdown that lists every stop grouped by city, in route order, and jumps to the
 * selected stop's section.
 */
export function StopPicker({
  entries,
  onSelect,
  label = 'Jump to a stop',
  itemNoun = 'listing',
}: {
  entries: StopPickerEntry[];
  onSelect: (stop: string) => void;
  label?: string;
  itemNoun?: string;
}) {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => groupStopsByCity(entries), [entries]);
  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.count, 0), [entries]);

  function select(stop: string) {
    setOpen(false);
    onSelect(stop);
  }

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
          borderRadius: 16,
          paddingHorizontal: 15,
          paddingVertical: 13,
          backgroundColor: colors.panel,
          opacity: entries.length === 0 ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 15 * effectiveScale }} allowFontScaling={false}>
          {label}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14 * effectiveScale }} allowFontScaling={false}>
          {entries.length} stop{entries.length === 1 ? '' : 's'} ▾
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close stop list"
          style={{ flex: 1, backgroundColor: '#0b1a2c99', justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              maxHeight: '80%',
              backgroundColor: colors.panel,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{ color: colors.ink, fontSize: 18 * effectiveScale, fontWeight: '700' }}
                allowFontScaling={false}
              >
                {label}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                {total} {itemNoun}
                {total === 1 ? '' : 's'} in stop order
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {groups.map((group) => (
                <View key={group.city}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12 * effectiveScale,
                      fontWeight: '700',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 6,
                      backgroundColor: colors.brandSoft,
                    }}
                    allowFontScaling={false}
                  >
                    {group.city}
                  </Text>
                  {group.stops.map((stop) => (
                    <Pressable
                      key={`${group.city}-${stop.name}`}
                      onPress={() => select(stop.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`${stop.name}, ${stop.count} ${itemNoun}${stop.count === 1 ? '' : 's'}`}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        backgroundColor: pressed ? colors.brand + '12' : 'transparent',
                      })}
                    >
                      <Text
                        style={{ color: colors.ink, fontSize: 15 * effectiveScale, flex: 1 }}
                        allowFontScaling={false}
                      >
                        {stop.name}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                        {stop.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
