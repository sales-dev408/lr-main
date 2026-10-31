import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, Text, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton, Banner, Card, Screen, Spinner } from '@/components/Ui';
import { LinkifiedText } from '@/components/LinkifiedText';
import { getAppState } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { ContentBlock } from '@/lib/types';

export default function ArticleScreen() {
  const colors = useThemeColors();
  const { effectiveScale } = useDynamicType();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<ContentBlock | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void getAppState().then((state) => {
      if (active) {
        setItem(state?.content.find((block) => block.id === params.id) ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, [params.id]);

  const imageHeight = Math.min(280, Math.max(160, width * 0.45));
  const externalUrl = item?.url && item.kind !== 'image' ? item.url : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 32, paddingTop: 4 }}>
        <AppButton variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}>
          ← Back to Discover
        </AppButton>

        {item === undefined ? <Spinner /> : null}
        {item === null ? <Banner tone="error">This content is no longer available.</Banner> : null}

        {item ? (
          <Card>
            <Text style={{ color: colors.ink, fontSize: 22 * effectiveScale, fontWeight: '800' }} allowFontScaling={false}>
              {item.title}
            </Text>
            {item.kind === 'image' && item.url ? (
              <Image
                source={{ uri: item.url }}
                style={{ width: '100%', height: imageHeight, borderRadius: 16, backgroundColor: colors.panel }}
                resizeMode="cover"
                accessibilityLabel={item.title}
              />
            ) : null}
            {item.body ? (
              <LinkifiedText
                text={item.body}
                style={{ color: colors.ink, lineHeight: 24 * effectiveScale, fontSize: 15 * effectiveScale }}
                allowFontScaling={false}
              />
            ) : null}
            {externalUrl ? (
              <AppButton
                variant="secondary"
                onPress={() => {
                  const url = externalUrl as string;
                  void Linking.openURL(url.includes('://') ? url : `https://${url}`);
                }}
              >
                {item.kind === 'file' ? 'Open file' : 'Open link'}
              </AppButton>
            ) : null}
            <Text style={{ color: colors.subtle, fontSize: 12 * effectiveScale }} allowFontScaling={false}>
              {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
