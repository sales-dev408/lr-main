import { Linking, Platform, Share } from 'react-native';
import type { VendorListItem } from './types';
import { WEBSITE_URL } from './theme';

export async function shareDeal(vendor: VendorListItem): Promise<void> {
  const discount = vendor.discount?.label ?? 'a great discount';
  const message = `Check out ${discount} at ${vendor.name} with Light Rail Deals. Download the app: ${WEBSITE_URL}`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: vendor.name, text: message, url: WEBSITE_URL });
        return;
      } catch {
        // Fall back to opening the website.
      }
    }
    await Linking.openURL(WEBSITE_URL);
    return;
  }

  await Share.share({ message, title: vendor.name });
}
