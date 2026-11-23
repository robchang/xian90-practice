import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const wavRel = '/audio/test/silence4_line01.wav'
const wavAbs = path.join(root, 'public', wavRel.replace(/^\//, ''))

function ensureFixture() {
  fs.mkdirSync(path.dirname(wavAbs), { recursive: true })
  const line = path.join(root, 'public/audio/lines/line_01.mp3')
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono:d=4',
    '-i', line,
    '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono:d=2',
    '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]',
    '-map', '[a]',
    '-ar', '16000',
    '-ac', '1',
    wavAbs,
  ], { stdio: 'pipe' })
  const distWav = path.join(root, 'dist', wavRel.replace(/^\//, ''))
  fs.mkdirSync(path.dirname(distWav), { recursive: true })
  fs.copyFileSync(wavAbs, distWav)
}

test.beforeAll(() => {
  ensureFixture()
})

test('iPhone WebKit tap-to-talk does not end during 4s silence and scores the delayed line', async ({ page }) => {
  const phases: string[] = []
  await page.goto('/')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'))

  await page.evaluate((wavUrl) => {
    const w = window as Window & {
      webkitAudioContext?: typeof AudioContext
      __fakeStream?: MediaStream
      __playFakeMic?: () => Promise<void>
      __TEST_PREPARE_MIC?: () => Promise<{ stream: MediaStream; ctx: AudioContext }>
    }
    const AudioCtx = window.AudioContext || w.webkitAudioContext
    w.__TEST_PREPARE_MIC = async () => {
      if (!AudioCtx) throw new Error('no AudioContext')
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') await ctx.resume()
      const dest = ctx.createMediaStreamDestination()
      w.__fakeStream = dest.stream
      w.__playFakeMic = async () => {
        if (ctx.state === 'suspended') await ctx.resume()
        const res = await fetch(wavUrl)
        const buf = await ctx.decodeAudioData(await res.arrayBuffer())
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(dest)
        src.start(0)
      }
      return { stream: dest.stream, ctx }
    }
  }, wavRel)

  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('heading', { name: 'Speak coach' })).toBeVisible()

  const version = await page.locator('[data-testid="build-version"]').textContent()
  expect(version).toContain('speak-r3')

  const closeDiag = page.getByRole('button', { name: 'Close' })
  if (await closeDiag.count()) await closeDiag.click()

  page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[coach]')) console.log('BROWSER', msg.type(), msg.text())
  })

  await page.getByTestId('coach-start').click({ timeout: 10_000 })
  // If the example starts, skip it so we reach tap-to-speak quickly.
  const skip = page.getByRole('button', { name: 'Skip audio' })
  try {
    await skip.waitFor({ timeout: 4000 })
    await skip.click()
  } catch {
    /* already on your-turn */
  }
  await expect(page.getByTestId('coach-tap-start')).toBeVisible({ timeout: 8000 })

  await page.getByTestId('coach-tap-start').click()
  await expect(page.getByTestId('coach-stop')).toBeVisible({ timeout: 5000 })
  await page.evaluate(async () => {
    const w = window as Window & { __playFakeMic?: () => Promise<void> }
    if (w.__playFakeMic) await w.__playFakeMic()
  })

  const readPhase = () => page.evaluate(() => (window as Window & { __COACH_TEST__?: { getPhase: () => string } }).__COACH_TEST__?.getPhase() || '')

  // 4 seconds of silence must not end the take.
  const started = Date.now()
  while (Date.now() - started < 4000) {
    const phase = await readPhase()
    phases.push(phase)
    expect(phase, `take ended early at ${Date.now() - started}ms (phase=${phase})`).toBe('recording')
    await page.waitForTimeout(200)
  }

  // Line 1 is ~4.9s; wait for the full phrase after the 4s of lead-in silence.
  await page.waitForTimeout(5500)
  expect(await readPhase()).toBe('recording')
  await page.getByTestId('coach-stop').click()

  await expect(page.getByTestId('coach-result')).toBeVisible({ timeout: 150_000 })
  const score = await page.evaluate(() => (window as Window & { __COACH_TEST__?: { getScore: () => number | null } }).__COACH_TEST__?.getScore() ?? null)
  const reason = await page.evaluate(() => (window as Window & { __COACH_TEST__?: { getEndReason: () => string | null } }).__COACH_TEST__?.getEndReason() ?? null)
  expect(reason).toBe('user-stop')
  expect(score).not.toBeNull()
  expect(score as number).toBeGreaterThanOrEqual(70)
  expect(phases.every((p) => p === 'recording')).toBe(true)
})
