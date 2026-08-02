import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/Ui';
import { theme } from '@/lib/theme';

const PASSCREATOR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
  </style>
</head>
<body>
  <script src="https://app.passcreator.com/loader/lib/passcreator.load.js?landingpage=https://app.passcreator.com/en/l/lightraildeals?showMenu=false"></script>
</body>
</html>
`;

export default function PassSetupScreen() {
  const [loading, setLoading] = useState(true);

  return (
    <Screen>
      <View style={styles.container}>
        <WebView
          source={{ html: PASSCREATOR_HTML }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          startInLoadingState
          style={styles.web}
        />
        {loading ? (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  web: { flex: 1 },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
