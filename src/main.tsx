import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { diag } from './diagnostics'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    diag('sw', 'update available')
    const reload = () => updateSW(true)
    if ((window as Window & { __coachRecording?: boolean }).__coachRecording) {
      window.dispatchEvent(new CustomEvent('coach-sw-update', { detail: { reload } }))
    } else {
      reload()
    }
  },
  onOfflineReady() {
    diag('sw', 'offline ready')
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    window.setInterval(() => {
      registration.update().catch(() => {})
    }, 60_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
