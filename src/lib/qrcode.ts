import QRCode from 'qrcode';

/**
 * Generates a QR code as a base64 Data URI PNG image.
 * The QR encodes the guest's unique check-in URL.
 */
export async function generateQRCode(guestId: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const checkInUrl = `${appUrl}/checkin/${guestId}`;

  const dataUri = await QRCode.toDataURL(checkInUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: {
      dark: '#0f0f0f',
      light: '#fafaf8',
    },
  });

  return dataUri; // e.g. "data:image/png;base64,iVBOR..."
}

/**
 * Extracts the raw base64 bytes from a Data URI (for email attachments).
 */
export function dataUriToBase64(dataUri: string): string {
  return dataUri.split(',')[1];
}
