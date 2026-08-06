import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Card, SectionTitle, Spinner } from '@/components/Ui';
import { listAds } from '@/lib/api';
import { useThemeColors } from '@/lib/useThemeColors';
import { useDynamicType } from '@/lib/dynamicType';
import type { Ad } from '@/lib/types';

export function AdBanner() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { effectiveScale } = useDynamicType();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listAds()
      .then((data) => {
        if (mounted) setAds(data.slice(0, 3));
      })
      .catch(() => {
        // Ads are optional; fail silently so the home screen still loads.
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <SectionTitle title="Sponsors" subtitle="Loading…" />
        <Spinner />
      </Card>
    );
  }

  if (ads.length === 0) {
    return null;
  }

  const itemWidth = Math.min(width - 48 * effectiveScale, 320 * effectiveScale);
  const itemHeight = itemWidth * 0.5;

  return (
    <Card>
      <SectionTitle title="Sponsors" subtitle="Featured partners" />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 * effectiveScale, paddingVertical: 4 * effectiveScale }}
      >
        {ads.map((ad) => (
          <Pressable
            key={ad.id}
            onPress={() => {
              if (ad.link_url) {
                void Linking.openURL(ad.link_url);
              }
            }}
            style={{
              width: itemWidth,
              height: itemHeight,
              borderRadius: 16 * effectiveScale,
              backgroundColor: colors.panel,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Image
              source={{ uri: ad.image_url }}
              style={{ width: itemWidth, height: itemHeight }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}
