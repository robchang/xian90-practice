/** True for iPhone/iPad (including iPadOS desktop UA). Used to pick tap-to-talk defaults. */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  const platform = navigator.platform || ''
  if (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true
  return false
}

export function preferTapToTalk(): boolean {
  return isIosDevice()
}
