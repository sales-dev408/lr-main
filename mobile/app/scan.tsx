import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { AppButton, Banner, Card, FieldInput, Screen, SectionTitle } from '@/components/Ui';
import { useThemeColors } from '@/lib/useThemeColors';

export default function ScanScreen() {
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  function handleScan(data: string) {
    if (scanned) return;
    setScanned(true);
    router.push(`/discount?code=${encodeURIComponent(data.trim())}`);
  }

  function submitManual() {
    if (!manualCode.trim()) return;
    handleScan(manualCode.trim());
  }

  const isWeb = Platform.OS === 'web';

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Scan vendor code' }} />
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39'] }}
            onBarcodeScanned={({ data }) => handleScan(data)}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={[styles.permissionText, { color: colors.ink }]}>Camera permission is required to scan discount codes.</Text>
            <AppButton onPress={() => void requestPermission()}>Grant camera access</AppButton>
          </View>
        )}
        {isWeb ? (
          <View style={styles.webOverlay}>
            <Banner tone="info">Camera scanning is not available on web. Enter the vendor code below.</Banner>
            <Card>
              <SectionTitle title="Manual entry" subtitle="Type the code printed under the barcode." />
              <FieldInput value={manualCode} onChangeText={setManualCode} placeholder="Vendor discount code" autoCapitalize="none" />
              <AppButton onPress={() => void submitManual()}>Look up discount</AppButton>
            </Card>
          </View>
        ) : (
          <View style={styles.overlay}>
            <Text style={styles.hint}>Point the camera at the vendor’s in-store discount code.</Text>
            {scanned ? <ActivityIndicator color={colors.brand} /> : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permissionText: { textAlign: 'center' },
  overlay: { position: 'absolute', bottom: 40, left: 16, right: 16, alignItems: 'center', gap: 12 },
  hint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '0px 1px 4px rgba(0,0,0,0.6)' },
      default: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    }),
  },
  webOverlay: { position: 'absolute', bottom: 24, left: 16, right: 16, gap: 12 },
});
