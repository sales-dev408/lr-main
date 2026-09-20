import { useMemo, useRef } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { BrandHeader, Screen, SectionTitle } from '@/components/Ui';
import { AZ_ADMISSION_COLORS, AZ_ADMISSION_LABELS, AZ_EVENT_MONTHS, type AzAdmission, type AzEvent } from '@/lib/azEvents';
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

  const sections = useMemo<MonthSection[]>(
    () => AZ_EVENT_MONTHS.map((m, index) => ({ title: m.month, index, data: m.events })),
    [],
  );

  function scrollToMonth(index: number) {
    try {
      listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, animated: true });
    } catch {
      // Ignore out-of-range scroll requests while the list is still laying out.
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
        {sections.map((section) => (
          <Pressable
            key={section.title}
            onPress={() => scrollToMonth(section.index)}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${section.title}`}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.panel,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
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
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item, index) => `${item.name}-${item.date}-${index}`}
        stickySectionHeadersEnabled
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
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
