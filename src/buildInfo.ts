/** Human label Rob can check in the footer. Bump this when a user-facing coach fix ships. */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'speak-r3'

export const APP_COMMIT = (import.meta.env.VITE_APP_COMMIT as string | undefined) || 'dev'

export function buildLabel(): string {
  return `${APP_VERSION} (${APP_COMMIT})`
}
