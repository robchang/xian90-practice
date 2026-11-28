import { expect, test } from '@playwright/test'

test('Know my characters marks a tile and the script shows pinyin only for it', async ({ page }) => {
  await page.goto('/?demo=chars')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'))
  await expect(page.getByTestId('chars-screen')).toBeVisible()
  const tiles = page.locator('.char-tile')
  await expect(tiles).toHaveCount(140)
  await expect(page.getByTestId('chars-count')).toContainText('0 of 140')
  await tiles.first().click()
  await expect(page.getByTestId('chars-count')).toContainText('1 of 140')
  await expect(tiles.first()).toHaveClass(/is-unknown/)

  await page.getByTestId('nav-speech').click()
  await expect(page.getByTestId('script-view')).toBeVisible()
  const unknownPy = page.locator('.script-char.is-unknown .script-py')
  await expect(unknownPy.first()).not.toHaveText(/\s*/, { timeout: 5000 }).catch(async () => {
    // pinyin should be a non-breaking-space-only or actual pinyin; assert it has letters
  })
  await expect(unknownPy.first()).toHaveText(/\S/)

  const knownPy = page.locator('.script-char:not(.is-unknown) .script-py').first()
  await expect(knownPy).toHaveText('\u00a0')

  await page.getByTestId('show-all-pinyin').check()
  await expect(page.locator('.script-char:not(.is-unknown) .script-py').first()).toHaveText(/\S/)
})

test('tricky words player lists every word with pinyin and English', async ({ page }) => {
  await page.goto('/?demo=tricky-words')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'))
  await expect(page.getByTestId('words-player')).toBeVisible()
  await expect(page.locator('.word-row')).toHaveCount(30)
  await expect(page.locator('.word-row').first().locator('.word-zh')).not.toBeEmpty()
  await expect(page.locator('.word-row').first().locator('.word-py')).not.toBeEmpty()
  await expect(page.locator('.word-row').first().locator('.word-en')).not.toBeEmpty()
})
