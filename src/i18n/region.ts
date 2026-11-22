/**
 * First-launch language by region.
 * 1. A language the player chose by hand always wins.
 * 2. Device time zone in Uzbekistan → Uzbek.
 * 3. Telegram app set to Uzbek (Uzbeks living abroad) → Uzbek.
 * 4. Everyone else → English.
 */
export type RegionLang = 'uz' | 'en';

const UZ_ZONES = new Set(['Asia/Tashkent', 'Asia/Samarkand']);

export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function detectLang(
  saved: string | null | undefined,
  timeZone: string | null | undefined,
  telegramCode: string | null | undefined,
): RegionLang {
  if (saved === 'uz' || saved === 'en') return saved;
  if (timeZone && UZ_ZONES.has(timeZone)) return 'uz';
  if (telegramCode && telegramCode.toLowerCase().startsWith('uz')) return 'uz';
  return 'en';
}
