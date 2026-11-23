/** True for iPhone/iPad (including iPadOS desktop UA). */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  const platform = navigator.platform || ''
  if (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true
  // Mobile Safari without the iPhone token still shows as Safari + Mobile.
  if (/Safari/i.test(ua) && /Mobile/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Android/i.test(ua)) return true
  return false
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|EdgiOS|Android/i.test(ua)
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  if (isIosDevice()) return true
  return /Android|Mobile/i.test(navigator.userAgent || '')
}

/** Tap-to-start / tap-to-stop: default on iOS and all mobile browsers. */
export function preferTapToTalk(): boolean {
  return isIosDevice() || isMobile()
}

/**
 * Live webkitSpeechRecognition shares the mic with getUserMedia and on iOS
 * often steals or ends the capture session mid-take. Only desktop Chromium
 * should use it during a recording.
 */
export function useLiveSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  if (isIosDevice() || isSafari() || isMobile()) return false
  return true
}
