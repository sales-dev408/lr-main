export function qrCodeUrl(text: string, size = 200): string {
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}`;
}

export function barcodeUrl(text: string, width = 320, height = 120): string {
  return `https://quickchart.io/barcode?type=code128&text=${encodeURIComponent(text)}&width=${width}&height=${height}`;
}
