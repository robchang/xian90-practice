/** Resolve a public-folder path against the Vite base (e.g. /xian90-practice/). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './'
  const cleaned = path.replace(/^\//, '')
  return base.endsWith('/') ? `${base}${cleaned}` : `${base}/${cleaned}`
}
