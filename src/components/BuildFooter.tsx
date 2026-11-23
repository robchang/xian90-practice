import { useEffect, useState } from 'react'
import { buildLabel, APP_VERSION, APP_COMMIT } from '../buildInfo'
import { formatDiagLog, getDiagLog, subscribeDiag, clearDiagLog } from '../diagnostics'

function debugRequested(): boolean {
  if (typeof window === 'undefined') return false
  if (window.localStorage.getItem('coach-debug') === '1') return true
  return new URLSearchParams(window.location.search).get('debug') === '1'
}

export default function BuildFooter() {
  const [open, setOpen] = useState(() => debugRequested())
  const [copied, setCopied] = useState(false)
  const [, setLog] = useState(() => getDiagLog())
  const [taps, setTaps] = useState(0)

  useEffect(() => subscribeDiag(() => setLog(getDiagLog())), [])

  useEffect(() => {
    if (taps >= 5) {
      setOpen(true)
      try { window.localStorage.setItem('coach-debug', '1') } catch { /* ignore */ }
    }
  }, [taps])

  const copy = async () => {
    const text = `Build ${buildLabel()}\n${formatDiagLog()}`
    try {
      if (navigator.share && /iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
        try {
          await navigator.share({ title: 'Speak coach diagnostics', text })
          setCopied(true)
          return
        } catch {
          /* fall through to clipboard */
        }
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="build-version"
        data-testid="build-version"
        onClick={() => setTaps((n) => n + 1)}
        aria-label="App build version. Tap five times for diagnostics."
      >
        Build {APP_VERSION} ({APP_COMMIT})
      </button>
      {open && (
        <div className="diag-panel" data-testid="diag-panel">
          <div className="diag-panel-head">
            <strong>Diagnostics</strong>
            <span>Build {buildLabel()}</span>
          </div>
          <pre className="diag-log">{formatDiagLog()}</pre>
          <div className="diag-actions">
            <button type="button" className="coach-secondary" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy log'}
            </button>
            <button type="button" className="coach-secondary" onClick={() => { clearDiagLog(); setLog(getDiagLog()) }}>
              Clear
            </button>
            <button
              type="button"
              className="coach-secondary"
              onClick={() => {
                setOpen(false)
                try { window.localStorage.removeItem('coach-debug') } catch { /* ignore */ }
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function SwUpdateBanner() {
  const [show, setShow] = useState(false)
  const [reload, setReload] = useState<null | (() => void)>(null)

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ reload?: () => void }>
      setReload(() => custom.detail?.reload ?? (() => window.location.reload()))
      setShow(true)
    }
    window.addEventListener('coach-sw-update', onUpdate as EventListener)
    return () => window.removeEventListener('coach-sw-update', onUpdate as EventListener)
  }, [])

  if (!show) return null
  return (
    <div className="sw-update-banner" data-testid="sw-update-banner">
      <span>Update available</span>
      <button type="button" className="coach-primary" onClick={() => reload?.()}>
        Tap to refresh
      </button>
    </div>
  )
}
