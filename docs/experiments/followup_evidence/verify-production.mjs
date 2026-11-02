import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const [root, evidence] = process.argv.slice(2)
const { chromium, expect } = await import(pathToFileURL(`${root}/frontend/node_modules/@playwright/test/index.mjs`))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ baseURL: 'http://127.0.0.1:15174', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const errors = [], httpErrors = [], routes = []
page.on('pageerror', error => errors.push(error.message))
page.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }) })
const result = { mode: 'production Vite preview', realApi: 'http://localhost:8000', injectedData: false, routes, errors, httpErrors }
async function capture(name) {
  await page.addStyleTag({ content: 'html, body, #root { height: auto !important; scroll-behavior: auto !important; }' })
  await page.evaluate(() => { document.body.scrollTop = 0; window.scrollTo(0, 0) })
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true, animations: 'disabled' })
}
try {
  for (const route of ['/', '/analysis', '/analysis/eda', '/analysis/feature', '/analysis/insight', '/analysis/problem', '/analysis/compare', '/analysis/strategy', '/analysis/model', '/analysis/explain', '/analysis/predict', '/campaign', '/dashboard', '/sustain', '/video']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.locator('.ui-feedback-loading')).toHaveCount(0)
    routes.push({ route, heading: await page.getByRole('heading', { level: 1 }).first().innerText() })
  }
  await page.goto('/analysis/eda')
  await expect(page.getByTestId('tdi-total')).toContainText('34,160')
  await capture('eda-desktop')
  await page.goto('/')
  await expect(page.getByTestId('home-observed-count')).toContainText('34,964')
  await capture('home-desktop')
  await page.goto('/campaign')
  await page.getByRole('button', { name: '샘플 조건 채우기' }).click()
  await page.getByRole('button', { name: '조건으로 계산하기', exact: true }).click()
  await expect(page.getByTestId('scenario-conversions')).toHaveText('20')
  await expect(page.getByTestId('scenario-cpa_won')).toHaveText('50,000')
  await capture('campaign-desktop')
  await page.goto('/analysis/model')
  await expect(page.getByTestId('seed-comparison').locator('tbody tr')).toHaveCount(5)
  await capture('evaluation-desktop')
  await page.addStyleTag({ content: 'nav { visibility: hidden !important; }' })
  await page.getByTestId('model-diagnostics').screenshot({ path: `${evidence}/diagnostics-desktop.png`, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/', '/analysis/eda', '/campaign', '/analysis/model', '/dashboard']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.locator('.ui-feedback-loading')).toHaveCount(0)
    if (route === '/analysis/model') await expect(page.getByTestId('seed-comparison')).toBeVisible()
    if (route === '/campaign') {
      await page.getByRole('button', { name: '샘플 조건 채우기' }).click()
      await page.getByRole('button', { name: '조건으로 계산하기', exact: true }).click()
      await expect(page.getByTestId('scenario-conversions')).toHaveText('20')
      await page.getByRole('button', { name: '다크 모드로 전환', exact: true }).click()
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    assert.equal(overflow, false, `Mobile document overflow: ${route}`)
    await capture(`${route.split('/').at(-1) || 'home'}-mobile`)
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(httpErrors, [])
  result.status = 'PASS'
  console.log(JSON.stringify({ status: result.status, routes: routes.length, mobileRoutes: 5, errors, httpErrors }))
} catch (error) {
  result.status = 'FAIL'; result.error = String(error.stack || error); throw error
} finally {
  await writeFile(`${evidence}/production-verification.json`, JSON.stringify(result, null, 2))
  await browser.close()
}
