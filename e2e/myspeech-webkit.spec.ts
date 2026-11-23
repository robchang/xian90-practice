import { expect, test } from '@playwright/test'

test('editing a line in My Speech shows up in the Speak coach', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('BROWSER', msg.text())
  })
  await page.goto('/')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'))
  const closeDiag = page.getByRole('button', { name: 'Close' })
  if (await closeDiag.count()) await closeDiag.click()

  await page.getByTestId('nav-myspeech').click()
  await expect(page.getByTestId('my-speech')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My Speech' })).toBeVisible()

  await page.getByTestId('speech-simple-0').click()
  await expect(page.getByTestId('simple-list-0')).toBeVisible()
  await page.getByTestId('apply-simple-0').first().click()
  await expect(page.getByTestId('speech-line-0')).toContainText('各位领导、各位朋友：大家好！')
  await page.getByTestId('speech-save').click()
  await expect(page.getByText('Saved on this phone.')).toBeVisible()

  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('heading', { name: 'Speak coach' })).toBeVisible()
  await expect(page.getByTestId('coach-prompt')).toContainText('各位领导、各位朋友：大家好！')
})
