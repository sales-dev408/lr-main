import { useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { AppButton, Banner, BrandHeader, Screen, SectionTitle } from '@/components/Ui';
import {
  AZ_ADMISSION_COLORS,
  AZ_ADMISSION_LABELS,
  AZ_EVENT_MONTHS,
  azEventMatchesMode,
  type AzAdmission,
  type AzEvent,
  type AzViewMode,
} from '@/lib/azEvents';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';

interface MonthSection {
  title: string;
  index: number;
  data: AzEvent[];
}

const LEGEND: { kind: AzAdmission; label: string }[] = [
  { kind: 'free', label: 'Free / primarily free' },
  { kind: 'paid', label: 'Paid' },
  { kind: 'mixed', label: 'Mixed / free portions' },
  { kind: 'tbd', label: 'TBD' },
];

const VIEW_MODES: { value: AzViewMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function AdmissionDot({ kind }: { kind: AzAdmission }) {
  return (
    <View
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: AZ_ADMISSION_COLORS[kind] }}
      accessibilityLabel={AZ_ADMISSION_LABELS[kind]}
    />
  );
}

export default function AzEventsScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const listRef = useRef<SectionList<AzEvent, MonthSection>>(null);
  const pendingSection = useRef<number | null>(null);
  const [viewMode, setViewMode] = useState<AzViewMode>('all');

  const sections = useMemo<MonthSection[]>(
    () =>
      AZ_EVENT_MONTHS.map((m) => ({
        title: m.month,
        index: 0,
        data: m.events.filter((event) => azEventMatchesMode(event, m.month, viewMode)),
      }))
        .filter((s) => s.data.length > 0)
        .map((s, index) => ({ ...s, index })),
    [viewMode],
  );

  function scrollToMonth(index: number) {
    pendingSection.current = index;
    try {
      listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 0, animated: true });
    } catch {
      // SectionList throws while sections are still laying out; the
      // onScrollToIndexFailed / retry below covers that window.
    }
  }

  const header = (
    <View style={{ gap: 14, paddingBottom: 4 }}>
      <BrandHeader subtitle="Events around Arizona" />
      <SectionTitle title="Arizona Master Events Calendar" subtitle="September 2026 – August 2027 · statewide" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {LEGEND.map((entry) => (
          <View key={entry.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AdmissionDot kind={entry.kind} />
            <Text style={{ color: colors.muted, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VIEW_MODES.map((mode) => (
          <AppButton
            key={mode.value}
            variant={viewMode === mode.value ? 'primary' : 'secondary'}
            onPress={() => setViewMode(mode.value)}
            style={{ flexBasis: '45%', flexGrow: 1 }}
          >
            {mode.label}
          </AppButton>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sections.map((section) => (
          <Pressable
            key={section.title}
            onPress={() => scrollToMonth(section.index)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${section.title}`}
            style={({ pressed }) => ({
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.brand : colors.panel,
              paddingHorizontal: 12,
              paddingVertical: 6,
            })}
          >
            <Text style={{ color: colors.ink, fontSize: 12 * effectiveScale, fontWeight: '600' }} allowFontScaling={false}>
              {section.title.replace(/ \d{4}$/, '')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      {sections.length === 0 ? (
        <Banner tone="info">No statewide events match this time filter.</Banner>
      ) : null}
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item, index) => `${item.name}-${item.date}-${index}`}
        stickySectionHeadersEnabled
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        onScrollToIndexFailed={() => {
          const target = pendingSection.current;
          if (target != null) {
            setTimeout(() => scrollToMonth(target), 250);
          }
        }}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: colors.bg, paddingVertical: 8 }}>
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 18 * effectiveScale }} allowFontScaling={false}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ paddingTop: 4 }}>
              <AdmissionDot kind={item.admission} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 15 * effectiveScale }} allowFontScaling={false}>
                {item.name}
              </Text>
              <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                {item.date}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 * effectiveScale }} allowFontScaling={false}>
                {item.location} · {item.category}
              </Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
