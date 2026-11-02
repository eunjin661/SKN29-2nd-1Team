import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'

async function ready(page) {
  await page.goto('/campaign')
  await expect(page.getByRole('button', { name: '샘플 조건 채우기' })).toBeEnabled()
}
async function sample(page) { await page.getByRole('button', { name: '샘플 조건 채우기' }).click() }
async function submit(page) { await page.getByRole('button', { name: '조건으로 계산하기', exact: true }).click() }

test('REAL scenario: starts empty, sample fills only, explicit arithmetic and CSV match assumptions', async ({ page }) => {
  let posts = 0
  page.on('request', request => { if (request.url().endsWith('/campaign/scenario') && request.method() === 'POST') posts++ })
  await ready(page)
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
  await sample(page)
  expect(posts).toBe(0)
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
  await submit(page)
  await expect(page.getByTestId('scenario-impressions')).toHaveText('100,000')
  await expect(page.getByTestId('scenario-clicks')).toHaveText('1,000')
  await expect(page.getByTestId('scenario-conversions')).toHaveText('20')
  await expect(page.getByTestId('scenario-cpa_won')).toHaveText('50,000')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '가정·결과 CSV 다운로드' }).click()
  const csv = await fs.readFile(await (await downloadPromise).path(), 'utf8')
  expect(csv).toContain('"source","user_assumptions"')
  expect(csv).toContain('"ctr_percent_per_impression","1"')
  expect(csv).toContain('1000000')
  await page.getByLabel('총예산 (원)', { exact: true }).fill('2000000')
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('총예산 (원)', { exact: true })).toHaveValue('')
})

test('REAL zero conversions: zero is kept and CPA is unavailable', async ({ page }) => {
  await ready(page); await sample(page)
  await page.getByLabel('전환율 CVR · 클릭 대비 (%)', { exact: true }).fill('0')
  await submit(page)
  await expect(page.getByTestId('scenario-conversions')).toHaveText('0')
  await expect(page.getByTestId('scenario-cpa_won')).toHaveText('계산 불가')
})

test('Scenario validation blocks blank, zero CPM, out-of-range rates and incomplete allocation', async ({ page }) => {
  await ready(page); await submit(page)
  await expect(page.getByRole('alert')).toContainText('예산')
  await sample(page)
  await page.getByLabel('CPM · 노출 1,000회당 비용 (원)', { exact: true }).fill('0')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('CPM')
  await sample(page)
  await page.getByLabel('클릭률 CTR · 노출 대비 (%)', { exact: true }).fill('101')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('클릭률')
  await sample(page)
  await page.getByRole('spinbutton', { name: /예산 배분/ }).first().fill('99.99')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('100%')
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
})

test('INJECTED scenario failure: no invented result, retry reaches real arithmetic', async ({ page }) => {
  await ready(page); await sample(page)
  await page.route('**/campaign/scenario', route => route.fulfill({ status: 503, json: { detail: 'unavailable' } }))
  await submit(page)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
  await page.unroute('**/campaign/scenario')
  await submit(page)
  await expect(page.getByTestId('scenario-conversions')).toHaveText('20')
})

test('Scenario delayed request: duplicate submit is blocked and input editing cancels old result', async ({ page }) => {
  await ready(page); await sample(page)
  let release
  let posts = 0
  await page.route('**/campaign/scenario', async route => { posts++; await new Promise(resolve => { release = resolve }); await route.continue().catch(() => {}) })
  await submit(page)
  await expect(page.getByRole('button', { name: '계산 중…' })).toBeDisabled()
  expect(posts).toBe(1)
  await page.getByLabel('총예산 (원)', { exact: true }).fill('2000000')
  release()
  await page.unroute('**/campaign/scenario')
  await expect(page.getByTestId('scenario-result')).toHaveCount(0)
  await submit(page)
  await expect(page.getByTestId('scenario-conversions')).toHaveText('40')
  await expect(page.getByTestId('scenario-snapshot')).toContainText('2,000,000')
})

test('Campaign mobile: user assumptions are readable without document overflow or ROI forecast cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page); await sample(page); await submit(page)
  await expect(page.getByTestId('scenario-result')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy()
  await expect(page.getByText('ROI INDEX', { exact: true })).toHaveCount(0)
  await expect(page.getByText('FINAL DECISION', { exact: true })).toHaveCount(0)
})

test('Campaign dark mode keeps typed assumption inputs readable', async ({ page }) => {
  await ready(page); await sample(page)
  await page.getByRole('button', { name: '다크 모드로 전환', exact: true }).click()
  await submit(page)
  await expect(page.getByTestId('scenario-conversions')).toHaveText('20')
  for (const target of [page.getByLabel('총예산 (원)', { exact: true }), page.getByRole('button', { name: '샘플 조건 채우기', exact: true }), page.getByRole('button', { name: '가정·결과 CSV 다운로드', exact: true })]) {
  const colors = await target.evaluate(element => {
    const style = getComputedStyle(element)
    const luminance = color => {
      const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722
    }
    return { foreground: luminance(style.color), background: luminance(style.backgroundColor) }
  })
  expect((Math.max(colors.foreground, colors.background) + .05) / (Math.min(colors.foreground, colors.background) + .05)).toBeGreaterThanOrEqual(4.5)
  }
})
