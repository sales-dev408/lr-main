/**
 * Normalizes a user-supplied phone number to a canonical E.164-style string so
 * the same number always resolves to the same account regardless of how it was
 * typed. Returns null when the input cannot be a phone number.
 *
 * Numbers without a country code are assumed to be North American (+1), which
 * matches the Light Rail service area.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (hasPlus) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return `+${digits}`;
}
