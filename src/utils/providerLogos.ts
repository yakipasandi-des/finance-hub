/**
 * Provider logo URLs via Google's favicon service.
 * Maps Hebrew provider names → their website domain.
 */

const PROVIDER_DOMAINS: Record<string, string> = {
  'מור': 'mor-inv.co.il',
  'הראל': 'harel-group.co.il',
  'מגדל': 'migdal.co.il',
  'כלל': 'clalbit.co.il',
  'הפניקס': 'fnx.co.il',
  'מיטב': 'meitav.co.il',
  'אלטשולר שחם': 'as-invest.co.il',
  'פסגות': 'psagot.co.il',
  'מנורה': 'menoramivt.co.il',
}

/** Returns a favicon URL for a provider, or null if unknown. */
export function getProviderLogoUrl(provider: string, size = 32): string | null {
  const domain = PROVIDER_DOMAINS[provider]
  if (!domain) return null
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}
