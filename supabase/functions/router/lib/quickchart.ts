export function qrCodeUrl(text: string, size = 200): string {
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}`;
}
