import { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Spinner } from '@/components/Ui';
import { useThemeColors } from '@/lib/useThemeColors';

const DEALS_URL = 'https://lightraildeals.com';

export default function DealsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.bg }}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <WebView
          source={{ uri: DEALS_URL }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setError('Unable to load Light Rail Deals right now.')}
          style={{ flex: 1 }}
        />
        {loading ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: colors.bg,
            }}
          >
            <Spinner />
          </View>
        ) : null}
      </View>
    </View>
  );
}
