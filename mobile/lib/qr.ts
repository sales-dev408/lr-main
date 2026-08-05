export function qrCodeUrl(text: string, size = 200): string {
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}`;
}

const barcodeTypeMap: Record<string, string> = {
  Codabar: 'codabar',
  'Code 11': 'code11',
  'Code 128': 'code128',
  'Code 39': 'code39',
  'Extended Code 39': 'code39ext',
  'Code 93': 'code93',
  'EAN-13': 'ean13',
  'EAN-8': 'ean8',
  'Industrial 2 of 5': 'industrial2of5',
  'Interleaved 2 of 5': 'interleaved2of5',
  'ITF-14': 'itf14',
  'MSI (MSI Plessey)': 'msi',
  Plessey: 'plessey',
  'SCC-14': 'ean14',
  'Standard 2 of 5': 'code2of5',
  'UCC/EAN-128': 'gs1-128',
  'UCC/EAN Shipping Container Code': 'ean14',
  'UPC-A': 'upca',
  'Australia Postal Code': 'auspost',
  'Aztec Code': 'azteccode',
  'Composite Code': 'gs1-cc',
  DataMatrix: 'datamatrix',
  Maxicode: 'maxicode',
  'PDF-417': 'pdf417',
  Postnet: 'postnet',
  'QR Code': 'qrcode',
};

export function barcodeUrl(text: string, width = 320, height = 120, format = 'Code 128'): string {
  const type = barcodeTypeMap[format] ?? 'code128';
  return `https://quickchart.io/barcode?type=${encodeURIComponent(type)}&text=${encodeURIComponent(text)}&width=${width}&height=${height}`;
}
